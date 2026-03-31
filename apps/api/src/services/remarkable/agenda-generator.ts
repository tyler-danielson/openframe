/**
 * Daily Agenda PDF Generator
 * Generates a PDF agenda using PDFKit (Node.js native PDF library).
 * Optimized for reMarkable's e-ink display.
 */

import { format } from "date-fns";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require("pdfkit");

export interface AgendaEvent {
  title: string;
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
  location?: string | null;
  description?: string | null;
  calendarName?: string;
  calendarColor?: string;
}

export interface AgendaOptions {
  date: Date;
  events: AgendaEvent[];
  showLocation?: boolean;
  showDescription?: boolean;
  notesLines?: number;
  templateStyle?: "default" | "minimal" | "detailed";
}

function formatTime(date: Date): string {
  return format(date, "h:mm a");
}

function formatTimeRange(start: Date, end: Date): string {
  return `${formatTime(start)} - ${formatTime(end)}`;
}

/**
 * Generate a daily agenda PDF
 */
export async function generateAgendaPdf(options: AgendaOptions): Promise<Buffer> {
  const {
    date,
    events,
    showLocation = true,
    showDescription = false,
    notesLines = 20,
  } = options;

  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "LETTER",
        margins: { top: 40, bottom: 40, left: 40, right: 40 },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const pageWidth = 612 - 80; // LETTER width minus margins

      // === HEADER ===
      doc.fontSize(24).font("Helvetica-Bold").text(format(date, "EEEE"), { continued: false });
      doc.fontSize(14).font("Helvetica").fillColor("#666666").text(format(date, "MMMM d, yyyy"));
      doc.moveUp(2);
      doc.fontSize(12).fillColor("#999999").text("Daily Agenda", { align: "right" });
      doc.fillColor("#000000");

      // Horizontal rule
      doc.moveDown(0.5);
      const lineY = doc.y;
      doc.moveTo(40, lineY).lineTo(40 + pageWidth, lineY).lineWidth(2).strokeColor("#333333").stroke();
      doc.moveDown(1);

      // === EVENTS ===
      if (events.length === 0) {
        doc.fontSize(12).font("Helvetica-Oblique").fillColor("#888888")
          .text("No events scheduled for today.", { align: "left" });
        doc.fillColor("#000000").font("Helvetica");
        doc.moveDown(2);
      } else {
        // Sort events: all-day first, then by start time
        const sortedEvents = [...events].sort((a, b) => {
          if (a.isAllDay && !b.isAllDay) return -1;
          if (!a.isAllDay && b.isAllDay) return 1;
          return a.startTime.getTime() - b.startTime.getTime();
        });

        // Table header
        const col1Width = 120;
        const col2Width = showLocation ? pageWidth - col1Width - 120 : pageWidth - col1Width;
        const col3Width = 120;

        const headerY = doc.y;
        doc.rect(40, headerY, pageWidth, 22).fill("#f0f0f0");
        doc.fillColor("#333333").fontSize(10).font("Helvetica-Bold");
        doc.text("Time", 48, headerY + 6, { width: col1Width });
        doc.text("Event", 48 + col1Width, headerY + 6, { width: col2Width });
        if (showLocation) {
          doc.text("Location", 48 + col1Width + col2Width, headerY + 6, { width: col3Width });
        }
        doc.y = headerY + 22;

        // Separator line
        doc.moveTo(40, doc.y).lineTo(40 + pageWidth, doc.y).lineWidth(1).strokeColor("#cccccc").stroke();

        // Event rows
        for (const event of sortedEvents) {
          const rowY = doc.y + 6;

          // Check if we need a new page
          if (rowY > 700) {
            doc.addPage();
          }

          const timeText = event.isAllDay ? "All day" : formatTimeRange(event.startTime, event.endTime);

          doc.fillColor("#444444").fontSize(10).font("Helvetica");
          doc.text(timeText, 48, rowY, { width: col1Width });

          const eventY = rowY;
          doc.fillColor("#000000").fontSize(11).font("Helvetica-Bold");
          doc.text(event.title, 48 + col1Width, eventY, { width: col2Width });

          let detailY = doc.y;
          if (event.calendarName) {
            doc.fillColor("#666666").fontSize(9).font("Helvetica");
            doc.text(event.calendarName, 48 + col1Width, detailY, { width: col2Width });
            detailY = doc.y;
          }

          if (showDescription && event.description) {
            doc.fillColor("#888888").fontSize(9).font("Helvetica-Oblique");
            doc.text(event.description, 48 + col1Width, detailY, { width: col2Width });
          }

          if (showLocation && event.location) {
            doc.fillColor("#666666").fontSize(10).font("Helvetica");
            doc.text(event.location, 48 + col1Width + col2Width, eventY, { width: col3Width });
          }

          doc.y = Math.max(doc.y, rowY + 20) + 4;

          // Row separator
          doc.moveTo(40, doc.y).lineTo(40 + pageWidth, doc.y).lineWidth(0.5).strokeColor("#cccccc").stroke();
        }

        doc.moveDown(2);
      }

      // === NOTES SECTION ===
      doc.fillColor("#333333").fontSize(14).font("Helvetica-Bold").text("Notes");
      doc.moveDown(0.5);

      const notesStartY = doc.y;
      const lineSpacing = 25;

      for (let i = 0; i < notesLines; i++) {
        const y = notesStartY + (i * lineSpacing);
        if (y > 740) break; // Don't overflow past page
        doc.moveTo(40, y).lineTo(40 + pageWidth, y).lineWidth(0.5).strokeColor("#cccccc").stroke();
      }

      // === FOOTER ===
      doc.fontSize(8).fillColor("#aaaaaa").font("Helvetica");
      doc.text("Generated by OpenFrame Calendar", 40, 750, { align: "center", width: pageWidth });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generate agenda filename based on date
 */
export function getAgendaFilename(date: Date): string {
  return `Agenda ${format(date, "yyyy-MM-dd")}`;
}
