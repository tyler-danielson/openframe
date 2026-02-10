/**
 * reMarkable Note Processor
 * Downloads documents from reMarkable cloud, extracts handwritten content,
 * runs OCR, and parses into calendar events.
 */

import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import { setHours, setMinutes, addHours, startOfDay, endOfDay } from "date-fns";
import {
  remarkableDocuments,
  remarkableEventSource,
  remarkableAgendaSettings,
  events,
  calendars,
} from "@openframe/database/schema";
import { getRemarkableClient } from "./client.js";
import { getCategorySettings } from "../../routes/settings/index.js";

export interface ProcessedNote {
  documentId: string;
  documentName: string;
  recognizedText: string;
  parsedEvents: ParsedEventResult[];
  createdEventIds: string[];
}

export interface ParsedEventResult {
  title: string;
  startTime: Date | null;
  endTime: Date | null;
  isAllDay: boolean;
  created: boolean;
  eventId?: string;
  error?: string;
}

// Time pattern matchers (same as frontend parseEventText.ts)
const TIME_PATTERNS = {
  atTime: /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i,
  standaloneTime: /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i,
  timeRange:
    /\b(?:from\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|-)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i,
  militaryTime: /\b([01]?\d|2[0-3]):([0-5]\d)\b/,
};

/**
 * Parse hours and optional minutes from matched groups
 */
function parseTime(
  hourStr: string,
  minuteStr: string | undefined,
  ampm: string | undefined
): { hours: number; minutes: number } | null {
  let hours = parseInt(hourStr, 10);
  const minutes = minuteStr ? parseInt(minuteStr, 10) : 0;

  if (isNaN(hours) || hours < 0 || hours > 23) {
    return null;
  }

  if (ampm) {
    const isPM = ampm.toLowerCase() === "pm";
    if (hours === 12) {
      hours = isPM ? 12 : 0;
    } else if (isPM) {
      hours += 12;
    }
  } else if (hours <= 12 && hours >= 1) {
    if (hours >= 1 && hours <= 6) {
      hours += 12;
    }
  }

  return { hours, minutes };
}

/**
 * Parse natural language text into event details
 */
function parseEventText(
  text: string,
  targetDate: Date
): { title: string; startTime: Date | null; endTime: Date | null } {
  let workingText = text.trim();
  let startTime: Date | null = null;
  let endTime: Date | null = null;

  // Try to match time range first
  const rangeMatch = workingText.match(TIME_PATTERNS.timeRange);
  if (rangeMatch && rangeMatch[1] && rangeMatch[4]) {
    const startParsed = parseTime(rangeMatch[1], rangeMatch[2], rangeMatch[3]);
    const endParsed = parseTime(rangeMatch[4], rangeMatch[5], rangeMatch[6]);

    if (startParsed && endParsed) {
      startTime = setMinutes(
        setHours(targetDate, startParsed.hours),
        startParsed.minutes
      );
      endTime = setMinutes(
        setHours(targetDate, endParsed.hours),
        endParsed.minutes
      );

      if (endTime <= startTime) {
        endTime = addHours(endTime, 12);
        if (endTime <= startTime) {
          endTime = addHours(startTime, 1);
        }
      }
    }

    workingText = workingText.replace(TIME_PATTERNS.timeRange, "").trim();
  }

  // Try "at X" pattern
  if (!startTime) {
    const atMatch = workingText.match(TIME_PATTERNS.atTime);
    if (atMatch && atMatch[1]) {
      const parsed = parseTime(atMatch[1], atMatch[2], atMatch[3]);
      if (parsed) {
        startTime = setMinutes(
          setHours(targetDate, parsed.hours),
          parsed.minutes
        );
        endTime = addHours(startTime, 1);
      }
      workingText = workingText.replace(TIME_PATTERNS.atTime, "").trim();
    }
  }

  // Try standalone time
  if (!startTime) {
    const standaloneMatch = workingText.match(TIME_PATTERNS.standaloneTime);
    if (standaloneMatch && standaloneMatch[1]) {
      const parsed = parseTime(
        standaloneMatch[1],
        standaloneMatch[2],
        standaloneMatch[3]
      );
      if (parsed) {
        startTime = setMinutes(
          setHours(targetDate, parsed.hours),
          parsed.minutes
        );
        endTime = addHours(startTime, 1);
      }
      workingText = workingText.replace(TIME_PATTERNS.standaloneTime, "").trim();
    }
  }

  // Try military time
  if (!startTime) {
    const militaryMatch = workingText.match(TIME_PATTERNS.militaryTime);
    if (militaryMatch && militaryMatch[1] && militaryMatch[2]) {
      const hours = parseInt(militaryMatch[1], 10);
      const minutes = parseInt(militaryMatch[2], 10);
      startTime = setMinutes(setHours(targetDate, hours), minutes);
      endTime = addHours(startTime, 1);
      workingText = workingText.replace(TIME_PATTERNS.militaryTime, "").trim();
    }
  }

  // Clean up the title
  let title = workingText
    .replace(/\s+/g, " ")
    .replace(/^[-–—,.\s]+|[-–—,.\s]+$/g, "")
    .trim();

  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }

  if (!title) {
    title = text.trim();
    if (title.length > 0) {
      title = title.charAt(0).toUpperCase() + title.slice(1);
    }
  }

  return { title, startTime, endTime };
}

/**
 * Split recognized text into individual event lines
 */
function splitIntoEventLines(text: string): string[] {
  // Split by newlines and filter empty lines
  return text
    .split(/[\n\r]+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    // Filter out lines that are likely headers or decorative
    .filter((line) => !line.match(/^[-=_]+$/))
    .filter((line) => line.length >= 3); // Minimum meaningful length
}

/**
 * Run handwriting recognition on image data
 */
async function recognizeHandwriting(
  fastify: FastifyInstance,
  imageDataUrl: string
): Promise<string> {
  const settings = await getCategorySettings(fastify.db, "handwriting");
  const provider = (settings.provider as string) || "tesseract";

  if (provider === "tesseract") {
    // Tesseract runs client-side, can't use it here
    throw new Error("Server-side handwriting recognition requires OpenAI, Claude, Gemini, or Google Vision");
  }

  // Use the same recognition logic as handwriting routes
  let text: string;

  switch (provider) {
    case "openai": {
      const apiKey = settings.openai_api_key;
      if (!apiKey) {
        throw new Error("OpenAI API key not configured");
      }
      text = await recognizeWithOpenAI(imageDataUrl, apiKey);
      break;
    }

    case "claude": {
      const apiKey = settings.anthropic_api_key;
      if (!apiKey) {
        throw new Error("Anthropic API key not configured");
      }
      text = await recognizeWithClaude(imageDataUrl, apiKey);
      break;
    }

    case "gemini": {
      const apiKey = settings.gemini_api_key;
      if (!apiKey) {
        throw new Error("Gemini API key not configured");
      }
      text = await recognizeWithGemini(imageDataUrl, apiKey);
      break;
    }

    case "google_vision": {
      const apiKey = settings.google_vision_api_key;
      if (!apiKey) {
        throw new Error("Google Vision API key not configured");
      }
      text = await recognizeWithGoogleVision(imageDataUrl, apiKey);
      break;
    }

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }

  return text;
}

// OpenAI GPT-4o Vision
async function recognizeWithOpenAI(imageDataUrl: string, apiKey: string): Promise<string> {
  // Check if it's a PDF or image
  const isPdf = imageDataUrl.startsWith("data:application/pdf");

  // For PDFs, we need to use the file input approach
  // For images, we can use image_url directly
  const contentParts = isPdf
    ? [
        {
          type: "text" as const,
          text: "Extract all handwritten text from this PDF document. Return each line of text on a separate line. Focus on recognizing event-like entries (appointments, meetings, tasks with times).",
        },
        {
          type: "image_url" as const,
          image_url: { url: imageDataUrl },
        },
      ]
    : [
        {
          type: "text" as const,
          text: "Extract all handwritten text from this image. Return each line of text on a separate line. Focus on recognizing event-like entries (appointments, meetings, tasks with times).",
        },
        {
          type: "image_url" as const,
          image_url: { url: imageDataUrl },
        },
      ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: contentParts,
        },
      ],
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(errorData.error?.message || `OpenAI API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  return data.choices[0]?.message?.content?.trim() || "";
}

// Anthropic Claude Vision
async function recognizeWithClaude(imageDataUrl: string, apiKey: string): Promise<string> {
  // Support both image and PDF formats
  const base64Match = imageDataUrl.match(/^data:(image\/\w+|application\/pdf);base64,(.+)$/);
  if (!base64Match) {
    throw new Error("Invalid data URL format");
  }
  const [, mimeType, base64Data] = base64Match;

  // Determine content type for Claude API
  const isPdf = mimeType === "application/pdf";
  const contentBlock = isPdf
    ? {
        type: "document" as const,
        source: {
          type: "base64" as const,
          media_type: "application/pdf" as const,
          data: base64Data,
        },
      }
    : {
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: mimeType as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
          data: base64Data,
        },
      };

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: [
            contentBlock,
            {
              type: "text",
              text: "Extract all handwritten text from this document. Return each line of text on a separate line. Focus on recognizing event-like entries (appointments, meetings, tasks with times).",
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(errorData.error?.message || `Claude API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
  };

  const textContent = data.content.find((c) => c.type === "text");
  return textContent?.text?.trim() || "";
}

// Google Gemini Vision
async function recognizeWithGemini(imageDataUrl: string, apiKey: string): Promise<string> {
  // Support both image and PDF formats
  const base64Match = imageDataUrl.match(/^data:(image\/\w+|application\/pdf);base64,(.+)$/);
  if (!base64Match) {
    throw new Error("Invalid data URL format");
  }
  const [, mimeType, base64Data] = base64Match;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: "Extract all handwritten text from this document. Return each line of text on a separate line. Focus on recognizing event-like entries (appointments, meetings, tasks with times).",
              },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Data,
                },
              },
            ],
          },
        ],
      }),
    }
  );

  const data = (await response.json()) as {
    candidates?: Array<{
      content: { parts: Array<{ text?: string }> };
    }>;
    error?: { message?: string };
  };

  if (!response.ok || data.error) {
    throw new Error(data.error?.message || `Gemini API error: ${response.status}`);
  }

  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
}

// Google Cloud Vision
async function recognizeWithGoogleVision(imageDataUrl: string, apiKey: string): Promise<string> {
  const base64Match = imageDataUrl.match(/^data:image\/\w+;base64,(.+)$/);
  if (!base64Match) {
    throw new Error("Invalid image data URL format");
  }
  const base64Data = base64Match[1];

  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: base64Data },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const errorData = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(errorData.error?.message || `Google Vision API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    responses: Array<{
      fullTextAnnotation?: { text: string };
      error?: { message: string };
    }>;
  };

  if (data.responses[0]?.error) {
    throw new Error(data.responses[0].error.message);
  }

  return data.responses[0]?.fullTextAnnotation?.text?.trim() || "";
}

/**
 * Process a reMarkable document: download, OCR, parse, and create events
 */
export async function processRemarkableNote(
  fastify: FastifyInstance,
  userId: string,
  documentId: string,
  options: {
    targetDate?: Date;
    autoCreate?: boolean;
    calendarId?: string;
  } = {}
): Promise<ProcessedNote> {
  const { targetDate = new Date(), autoCreate = true, calendarId } = options;

  const client = getRemarkableClient(fastify, userId);

  // Get document info from database
  const [docRecord] = await fastify.db
    .select()
    .from(remarkableDocuments)
    .where(
      and(
        eq(remarkableDocuments.userId, userId),
        eq(remarkableDocuments.documentId, documentId)
      )
    )
    .limit(1);

  if (!docRecord) {
    throw new Error("Document not found in database");
  }

  // Download the document with annotations as PDF
  // rmapi's "geta" command renders handwritten notes into the PDF
  fastify.log.info({ documentId }, "Downloading document from reMarkable with annotations...");
  const docBuffer = await client.downloadDocumentWithAnnotations(documentId);

  // The document is now a PDF with annotations rendered
  // Convert to base64 for OCR processing
  const imageDataUrl = `data:application/pdf;base64,${docBuffer.toString("base64")}`;

  // Run handwriting recognition
  fastify.log.info({ documentId }, "Running handwriting recognition...");
  let recognizedText: string;

  try {
    recognizedText = await recognizeHandwriting(fastify, imageDataUrl);
  } catch (error) {
    fastify.log.error({ err: error, documentId }, "Handwriting recognition failed");
    throw error;
  }

  // Parse the recognized text into event lines
  const eventLines = splitIntoEventLines(recognizedText);
  fastify.log.info({ documentId, lineCount: eventLines.length }, "Parsed event lines");

  // Get the user's primary calendar
  let targetCalendarId = calendarId;
  if (!targetCalendarId) {
    const [primaryCalendar] = await fastify.db
      .select()
      .from(calendars)
      .where(and(eq(calendars.userId, userId), eq(calendars.isPrimary, true)))
      .limit(1);

    if (!primaryCalendar) {
      const [anyCalendar] = await fastify.db
        .select()
        .from(calendars)
        .where(eq(calendars.userId, userId))
        .limit(1);

      if (!anyCalendar) {
        throw new Error("No calendars available");
      }
      targetCalendarId = anyCalendar.id;
    } else {
      targetCalendarId = primaryCalendar.id;
    }
  }

  // Parse each line and create events
  const parsedEvents: ParsedEventResult[] = [];
  const createdEventIds: string[] = [];

  for (const line of eventLines) {
    const parsed = parseEventText(line, targetDate);

    const result: ParsedEventResult = {
      title: parsed.title,
      startTime: parsed.startTime,
      endTime: parsed.endTime,
      isAllDay: !parsed.startTime,
      created: false,
    };

    if (autoCreate && parsed.title) {
      try {
        // Create the event
        const startTime = parsed.startTime || startOfDay(targetDate);
        const endTime = parsed.endTime || (parsed.startTime ? addHours(parsed.startTime, 1) : endOfDay(targetDate));

        const [newEvent] = await fastify.db
          .insert(events)
          .values({
            calendarId: targetCalendarId,
            externalId: `remarkable_${crypto.randomUUID()}`,
            title: parsed.title,
            startTime,
            endTime,
            isAllDay: !parsed.startTime,
            metadata: {
              source: "remarkable",
              documentId: docRecord.id,
              originalText: line,
            },
          })
          .returning();

        if (newEvent) {
          result.created = true;
          result.eventId = newEvent.id;
          createdEventIds.push(newEvent.id);

          // Link event to source document
          await fastify.db.insert(remarkableEventSource).values({
            eventId: newEvent.id,
            documentId: docRecord.id,
            extractedText: line,
          });
        }
      } catch (error) {
        result.error = error instanceof Error ? error.message : "Failed to create event";
      }
    }

    parsedEvents.push(result);
  }

  // Update document record
  await fastify.db
    .update(remarkableDocuments)
    .set({
      isProcessed: true,
      processedAt: new Date(),
      recognizedText,
      updatedAt: new Date(),
    })
    .where(eq(remarkableDocuments.id, docRecord.id));

  return {
    documentId,
    documentName: docRecord.documentName,
    recognizedText,
    parsedEvents,
    createdEventIds,
  };
}

/**
 * Sync documents from reMarkable and update local database
 */
export async function syncRemarkableDocuments(
  fastify: FastifyInstance,
  userId: string
): Promise<{ added: number; updated: number; removed: number }> {
  const client = getRemarkableClient(fastify, userId);

  // Get settings to find the notes folder
  const [settings] = await fastify.db
    .select()
    .from(remarkableAgendaSettings)
    .where(eq(remarkableAgendaSettings.userId, userId))
    .limit(1);

  const notesFolderPath = "/Calendar/Notes";

  // Get documents from reMarkable
  const remoteDocuments = await client.getDocuments(notesFolderPath);

  // Get existing documents from database
  const existingDocs = await fastify.db
    .select()
    .from(remarkableDocuments)
    .where(eq(remarkableDocuments.userId, userId));

  const existingMap = new Map(existingDocs.map((d) => [d.documentId, d]));
  const remoteIds = new Set(remoteDocuments.map((d) => d.id));

  let added = 0;
  let updated = 0;
  let removed = 0;

  // Add/update documents
  for (const doc of remoteDocuments) {
    if (doc.type !== "DocumentType") continue;

    const existing = existingMap.get(doc.id);

    if (!existing) {
      // Add new document
      await fastify.db.insert(remarkableDocuments).values({
        userId,
        documentId: doc.id,
        documentVersion: doc.version,
        documentName: doc.name,
        documentType: "notebook",
        folderPath: notesFolderPath,
        lastModifiedAt: new Date(doc.lastModified),
        isAgenda: false,
        isProcessed: false,
      });
      added++;
    } else if (existing.documentVersion !== doc.version) {
      // Update existing document
      await fastify.db
        .update(remarkableDocuments)
        .set({
          documentVersion: doc.version,
          documentName: doc.name,
          lastModifiedAt: new Date(doc.lastModified),
          isProcessed: false, // Mark for re-processing
          updatedAt: new Date(),
        })
        .where(eq(remarkableDocuments.id, existing.id));
      updated++;
    }
  }

  // Remove documents that no longer exist
  for (const existing of existingDocs) {
    if (!remoteIds.has(existing.documentId) && !existing.isAgenda) {
      await fastify.db
        .delete(remarkableDocuments)
        .where(eq(remarkableDocuments.id, existing.id));
      removed++;
    }
  }

  return { added, updated, removed };
}
