/**
 * User Template Generator
 * Loads user-uploaded PDFs and overlays text at defined merge fields using pdf-lib.
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { format } from "date-fns";
import type { RemarkableTemplateConfig, RemarkableMergeField } from "@openframe/database/schema";
import type {
  TemplateGenerator,
  TemplateOptions,
  TemplateResult,
  TemplateEvent,
} from "../template-engine.js";

/**
 * Format a value based on field type
 */
function formatFieldValue(
  field: RemarkableMergeField,
  options: TemplateOptions
): string {
  switch (field.type) {
    case "date": {
      const dateFormat = field.format || "MMMM d, yyyy";
      return format(options.date, dateFormat);
    }

    case "events": {
      // Format events as a list
      const events = options.events;
      if (events.length === 0) {
        return "No events scheduled";
      }

      return events
        .slice(0, 10) // Limit to 10 events
        .map((event) => {
          if (event.isAllDay) {
            return `• ${event.title} (All day)`;
          }
          const time = format(event.startTime, "h:mm a");
          return `• ${time} - ${event.title}`;
        })
        .join("\n");
    }

    case "weather": {
      if (!options.weather) {
        return "Weather unavailable";
      }
      return `${options.weather.temp}° - ${options.weather.description}`;
    }

    case "text": {
      return field.format || "";
    }

    case "custom": {
      // Custom fields can use format as a template
      return field.format || "";
    }

    default:
      return "";
  }
}

/**
 * Calculate text height based on content
 */
function calculateTextHeight(
  text: string,
  fontSize: number,
  lineHeight = 1.2
): number {
  const lines = text.split("\n").length;
  return lines * fontSize * lineHeight;
}

export class UserTemplateGenerator implements TemplateGenerator {
  async generate(options: TemplateOptions): Promise<TemplateResult> {
    const { date, pdfTemplate, mergeFields } = options;

    if (!pdfTemplate) {
      throw new Error("User template requires a PDF template");
    }

    if (!mergeFields || mergeFields.length === 0) {
      // If no merge fields, just return the template as-is
      return {
        buffer: pdfTemplate,
        filename: `Custom Template ${format(date, "yyyy-MM-dd")}`,
        pageCount: 1,
      };
    }

    // Load the PDF template
    const pdfDoc = await PDFDocument.load(pdfTemplate);
    const pages = pdfDoc.getPages();

    if (pages.length === 0) {
      throw new Error("PDF template has no pages");
    }

    const firstPage = pages[0]!;
    const { height } = firstPage.getSize();

    // Embed font for text overlay
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Process each merge field
    for (const field of mergeFields) {
      const value = formatFieldValue(field, options);
      const fontSize = field.fontSize || 12;

      // Convert from top-left coordinates to PDF bottom-left
      const yPos = height - field.y - fontSize;

      // Handle multi-line text
      const lines = value.split("\n");
      let currentY = yPos;

      for (const line of lines) {
        // Choose font based on field type
        const textFont = field.type === "date" ? fontBold : font;

        firstPage.drawText(line, {
          x: field.x,
          y: currentY,
          size: fontSize,
          font: textFont,
          color: rgb(0.2, 0.2, 0.2),
        });

        currentY -= fontSize * 1.3; // Line spacing
      }
    }

    // Serialize the modified PDF
    const pdfBytes = await pdfDoc.save();
    const buffer = Buffer.from(pdfBytes);

    return {
      buffer,
      filename: `Custom Template ${format(date, "yyyy-MM-dd")}`,
      pageCount: pages.length,
    };
  }

  getDefaultConfig(): RemarkableTemplateConfig {
    return {};
  }

  validateConfig(config: RemarkableTemplateConfig): { valid: boolean; errors: string[] } {
    // User templates have minimal config validation
    return { valid: true, errors: [] };
  }
}

/**
 * Validate merge fields for a user template
 */
export function validateMergeFields(
  mergeFields: RemarkableMergeField[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!Array.isArray(mergeFields)) {
    return { valid: false, errors: ["mergeFields must be an array"] };
  }

  for (let i = 0; i < mergeFields.length; i++) {
    const field = mergeFields[i];
    if (!field) continue;

    if (!field.name || typeof field.name !== "string") {
      errors.push(`Field ${i}: name is required`);
    }

    if (!field.type || !["date", "events", "weather", "text", "custom"].includes(field.type)) {
      errors.push(`Field ${i}: type must be 'date', 'events', 'weather', 'text', or 'custom'`);
    }

    if (typeof field.x !== "number" || field.x < 0) {
      errors.push(`Field ${i}: x position must be a positive number`);
    }

    if (typeof field.y !== "number" || field.y < 0) {
      errors.push(`Field ${i}: y position must be a positive number`);
    }

    if (field.fontSize !== undefined && (typeof field.fontSize !== "number" || field.fontSize < 6 || field.fontSize > 72)) {
      errors.push(`Field ${i}: fontSize must be between 6 and 72`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Extract page dimensions from a PDF template
 */
export async function getPdfTemplateDimensions(
  pdfBuffer: Buffer
): Promise<{ width: number; height: number; pageCount: number }> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();

  if (pages.length === 0) {
    throw new Error("PDF has no pages");
  }

  const firstPage = pages[0]!;
  const { width, height } = firstPage.getSize();

  return {
    width,
    height,
    pageCount: pages.length,
  };
}
