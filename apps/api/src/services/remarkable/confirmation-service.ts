/**
 * Confirmation Service for reMarkable
 * Generates and pushes confirmation summaries after processing notes.
 */

import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import PdfMake from "pdfmake/build/pdfmake.js";
import PdfFonts from "pdfmake/build/vfs_fonts.js";
import { format } from "date-fns";
import {
  remarkableDocuments,
  remarkableProcessedConfirmations,
  remarkableAgendaSettings,
  type ConfirmedEventSummary,
} from "@openframe/database/schema";
import { getRemarkableClient } from "./client.js";

// Type definitions for pdfmake
type Margins = [number, number, number, number] | [number, number] | number;
type Alignment = "left" | "right" | "center" | "justify";

interface Style {
  fontSize?: number;
  bold?: boolean;
  italics?: boolean;
  color?: string;
  margin?: Margins;
  font?: string;
  alignment?: Alignment;
}

interface StyleDictionary {
  [name: string]: Style;
}

type Content = Record<string, unknown>;

interface TDocumentDefinitions {
  pageSize?: string | { width: number; height: number };
  pageMargins?: Margins;
  content: Content[];
  styles?: StyleDictionary;
  defaultStyle?: Style;
}

// Initialize pdfmake with embedded fonts
const pdfMakeInstance = PdfMake as unknown as { vfs: Record<string, string> };
const fontsData = PdfFonts as unknown as { pdfMake?: { vfs: Record<string, string> }; vfs?: Record<string, string> };
pdfMakeInstance.vfs = fontsData.pdfMake?.vfs ?? fontsData.vfs ?? {};

/**
 * Confirmation settings
 */
export interface ConfirmationSettings {
  enabled: boolean;
  folderPath: string;
  includeEventDetails: boolean;
  autoDelete: boolean; // Delete confirmation after X days
  autoDeleteDays: number;
}

/**
 * Default confirmation settings
 */
export const DEFAULT_CONFIRMATION_SETTINGS: ConfirmationSettings = {
  enabled: true,
  folderPath: "/Calendar/Processed",
  includeEventDetails: true,
  autoDelete: true,
  autoDeleteDays: 7,
};

/**
 * Generate confirmation PDF content
 */
function generateConfirmationContent(
  documentName: string,
  events: ConfirmedEventSummary[],
  settings: ConfirmationSettings
): Content[] {
  const content: Content[] = [];

  // Header
  content.push({
    columns: [
      {
        width: "*",
        stack: [
          {
            text: "Notes Processed",
            style: "title",
          },
          {
            text: format(new Date(), "MMMM d, yyyy 'at' h:mm a"),
            style: "timestamp",
          },
        ],
      },
      {
        width: "auto",
        text: "✓",
        style: "checkmark",
        alignment: "right" as Alignment,
      },
    ],
    margin: [0, 0, 0, 20] as Margins,
  });

  // Horizontal rule
  content.push({
    canvas: [
      {
        type: "line",
        x1: 0,
        y1: 0,
        x2: 515,
        y2: 0,
        lineWidth: 1.5,
        lineColor: "#22c55e",
      },
    ],
    margin: [0, 0, 0, 20] as Margins,
  });

  // Source document info
  content.push({
    stack: [
      {
        text: "Source Document",
        style: "sectionHeader",
      },
      {
        text: documentName,
        style: "documentName",
        margin: [0, 5, 0, 15] as Margins,
      },
    ],
  });

  // Events created
  if (events.length === 0) {
    content.push({
      text: "No events were created from this document.",
      style: "noEvents",
      margin: [0, 10, 0, 20] as Margins,
    });
  } else {
    content.push({
      text: `${events.length} Event${events.length > 1 ? "s" : ""} Created`,
      style: "sectionHeader",
      margin: [0, 0, 0, 10] as Margins,
    });

    // Event list
    const eventRows: Content[] = events.map((event, index) => {
      const timeStr = event.isAllDay
        ? "All day"
        : event.endTime
          ? `${format(new Date(event.startTime), "h:mm a")} - ${format(new Date(event.endTime), "h:mm a")}`
          : format(new Date(event.startTime), "h:mm a");

      const dateStr = format(new Date(event.startTime), "EEE, MMM d");

      return {
        columns: [
          {
            width: 25,
            text: `${index + 1}.`,
            style: "eventNumber",
          },
          {
            width: "*",
            stack: [
              { text: event.title, style: "eventTitle" },
              {
                text: `${dateStr} • ${timeStr}`,
                style: "eventTime",
              },
            ],
          },
          {
            width: 20,
            text: "✓",
            style: "eventCheck",
            alignment: "center" as Alignment,
          },
        ],
        margin: [0, 0, 0, 10] as Margins,
      };
    });

    content.push({
      stack: eventRows,
      margin: [0, 0, 0, 20] as Margins,
    });
  }

  // Instructions
  content.push({
    stack: [
      {
        canvas: [
          {
            type: "line",
            x1: 0,
            y1: 0,
            x2: 515,
            y2: 0,
            lineWidth: 0.5,
            lineColor: "#cccccc",
          },
        ],
        margin: [0, 0, 0, 15] as Margins,
      },
      {
        text: "What's Next?",
        style: "instructionsHeader",
      },
      {
        ul: [
          "Your events have been added to your calendar",
          "You can view and edit them in OpenFrame Calendar",
          "This confirmation can be safely deleted",
        ],
        style: "instructionsList",
        margin: [0, 5, 0, 0] as Margins,
      },
    ],
  });

  // Footer
  content.push({
    text: "Generated by OpenFrame Calendar",
    style: "footer",
    alignment: "center" as Alignment,
    margin: [0, 30, 0, 0] as Margins,
  });

  return content;
}

/**
 * Document styles for confirmation PDF
 */
const confirmationStyles: StyleDictionary = {
  title: {
    fontSize: 22,
    bold: true,
    color: "#22c55e",
  },
  timestamp: {
    fontSize: 10,
    color: "#666666",
    margin: [0, 3, 0, 0],
  },
  checkmark: {
    fontSize: 36,
    bold: true,
    color: "#22c55e",
  },
  sectionHeader: {
    fontSize: 12,
    bold: true,
    color: "#333333",
  },
  documentName: {
    fontSize: 14,
    color: "#555555",
    italics: true,
  },
  noEvents: {
    fontSize: 11,
    color: "#888888",
    italics: true,
  },
  eventNumber: {
    fontSize: 11,
    color: "#888888",
  },
  eventTitle: {
    fontSize: 11,
    bold: true,
    color: "#333333",
  },
  eventTime: {
    fontSize: 9,
    color: "#666666",
  },
  eventCheck: {
    fontSize: 12,
    color: "#22c55e",
    bold: true,
  },
  instructionsHeader: {
    fontSize: 11,
    bold: true,
    color: "#444444",
  },
  instructionsList: {
    fontSize: 10,
    color: "#666666",
  },
  footer: {
    fontSize: 8,
    color: "#aaaaaa",
  },
};

/**
 * Generate confirmation PDF
 */
async function generateConfirmationPdf(
  documentName: string,
  events: ConfirmedEventSummary[],
  settings: ConfirmationSettings
): Promise<Buffer> {
  const content = generateConfirmationContent(documentName, events, settings);

  const docDefinition: TDocumentDefinitions = {
    pageSize: "LETTER",
    pageMargins: [40, 40, 40, 40],
    content,
    styles: confirmationStyles,
    defaultStyle: {
      font: "Roboto",
      fontSize: 10,
    },
  };

  return new Promise((resolve, reject) => {
    try {
      const pdfMakeCreate = PdfMake as unknown as {
        createPdf: (docDefinition: TDocumentDefinitions) => {
          getBuffer: (callback: (buffer: Buffer) => void) => void;
        };
      };
      const pdfDoc = pdfMakeCreate.createPdf(docDefinition);

      pdfDoc.getBuffer((buf: Buffer) => {
        resolve(buf);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Send confirmation for a processed note
 */
export async function sendConfirmation(
  fastify: FastifyInstance,
  userId: string,
  documentId: string,
  events: ConfirmedEventSummary[],
  settings?: Partial<ConfirmationSettings>
): Promise<{ confirmationId: string; confirmationDocumentId: string }> {
  const confirmSettings = { ...DEFAULT_CONFIRMATION_SETTINGS, ...settings };

  if (!confirmSettings.enabled) {
    throw new Error("Confirmations are disabled");
  }

  // Get the document info
  const [document] = await fastify.db
    .select()
    .from(remarkableDocuments)
    .where(eq(remarkableDocuments.id, documentId))
    .limit(1);

  if (!document) {
    throw new Error("Document not found");
  }

  // Generate confirmation PDF
  const pdfBuffer = await generateConfirmationPdf(
    document.documentName,
    events,
    confirmSettings
  );

  // Upload to reMarkable
  const client = getRemarkableClient(fastify, userId);
  const filename = `Processed - ${document.documentName} - ${format(new Date(), "yyyy-MM-dd HHmm")}`;
  const confirmationDocumentId = await client.uploadPdf(
    pdfBuffer,
    filename,
    confirmSettings.folderPath
  );

  // Record the confirmation
  const [confirmation] = await fastify.db
    .insert(remarkableProcessedConfirmations)
    .values({
      userId,
      documentId,
      confirmationType: "events_created",
      confirmationDocumentId,
      eventsConfirmed: events,
    })
    .returning();

  return {
    confirmationId: confirmation!.id,
    confirmationDocumentId,
  };
}

/**
 * Get confirmation settings for a user
 */
export async function getConfirmationSettings(
  fastify: FastifyInstance,
  userId: string
): Promise<ConfirmationSettings> {
  // For now, we store confirmation settings in the agenda settings
  // In a future version, this could be a separate table
  const [settings] = await fastify.db
    .select()
    .from(remarkableAgendaSettings)
    .where(eq(remarkableAgendaSettings.userId, userId))
    .limit(1);

  if (!settings) {
    return DEFAULT_CONFIRMATION_SETTINGS;
  }

  // Use default settings for now, can be extended later
  return DEFAULT_CONFIRMATION_SETTINGS;
}

/**
 * Get confirmations for a user
 */
export async function getConfirmations(
  fastify: FastifyInstance,
  userId: string,
  limit = 50
): Promise<Array<{
  id: string;
  documentId: string;
  documentName: string;
  confirmationType: string;
  confirmationDocumentId: string | null;
  eventsConfirmed: ConfirmedEventSummary[] | null;
  createdAt: Date;
}>> {
  const confirmations = await fastify.db
    .select({
      id: remarkableProcessedConfirmations.id,
      documentId: remarkableProcessedConfirmations.documentId,
      confirmationType: remarkableProcessedConfirmations.confirmationType,
      confirmationDocumentId: remarkableProcessedConfirmations.confirmationDocumentId,
      eventsConfirmed: remarkableProcessedConfirmations.eventsConfirmed,
      createdAt: remarkableProcessedConfirmations.createdAt,
      documentName: remarkableDocuments.documentName,
    })
    .from(remarkableProcessedConfirmations)
    .innerJoin(
      remarkableDocuments,
      eq(remarkableProcessedConfirmations.documentId, remarkableDocuments.id)
    )
    .where(eq(remarkableProcessedConfirmations.userId, userId))
    .orderBy(remarkableProcessedConfirmations.createdAt)
    .limit(limit);

  return confirmations;
}
