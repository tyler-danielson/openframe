/**
 * Daily Agenda PDF Generator
 * Generates a PDF agenda for reMarkable tablet with events and note-taking area.
 *
 * Uses pdfmake for PDF generation - optimized for reMarkable's e-ink display.
 */

import PdfMake from "pdfmake/build/pdfmake.js";
import PdfFonts from "pdfmake/build/vfs_fonts.js";
import { format } from "date-fns";

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
}

interface StyleDictionary {
  [name: string]: Style;
}

interface ContentText {
  text: string;
  style?: string | Style;
  alignment?: Alignment;
  margin?: Margins;
}

interface ContentStack {
  stack: Content[];
  margin?: Margins;
}

interface ContentColumns {
  columns: Content[];
  margin?: Margins;
}

interface ContentTable {
  table: {
    headerRows?: number;
    widths?: (number | string)[];
    body: TableCell[][];
  };
  layout?: TableLayout;
  margin?: Margins;
}

interface ContentCanvas {
  canvas: CanvasElement[];
  margin?: Margins;
}

interface CanvasElement {
  type: "line" | "rect" | "ellipse" | "polyline";
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  lineWidth?: number;
  lineColor?: string;
}

interface TableLayout {
  hLineWidth?: (i: number, node: unknown) => number;
  vLineWidth?: (i: number, node: unknown) => number;
  hLineColor?: (i: number, node: unknown) => string;
  paddingLeft?: (i: number, node: unknown) => number;
  paddingRight?: (i: number, node: unknown) => number;
  paddingTop?: (i: number, node: unknown) => number;
  paddingBottom?: (i: number, node: unknown) => number;
}

type TableCell = ContentText | ContentStack | { text: string; style?: string; fillColor?: string };
type Content = ContentText | ContentStack | ContentColumns | ContentTable | ContentCanvas | { width: string | number | "auto" | "*"; stack?: Content[]; text?: string; style?: string; alignment?: Alignment; margin?: Margins };

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

/**
 * Format time for display (e.g., "9:00 AM")
 */
function formatTime(date: Date): string {
  return format(date, "h:mm a");
}

/**
 * Format time range (e.g., "9:00 AM - 10:30 AM")
 */
function formatTimeRange(start: Date, end: Date): string {
  return `${formatTime(start)} - ${formatTime(end)}`;
}

/**
 * Generate the header section with date
 */
function generateHeader(date: Date): Content {
  return {
    columns: [
      {
        width: "*",
        stack: [
          {
            text: format(date, "EEEE"),
            style: "dayOfWeek",
          },
          {
            text: format(date, "MMMM d, yyyy"),
            style: "date",
          },
        ],
      },
      {
        width: "auto",
        text: "Daily Agenda",
        style: "title",
        alignment: "right" as const,
        margin: [0, 10, 0, 0],
      },
    ],
    margin: [0, 0, 0, 20] as [number, number, number, number],
  };
}

/**
 * Generate the events table
 */
function generateEventsTable(
  events: AgendaEvent[],
  options: { showLocation?: boolean; showDescription?: boolean }
): Content {
  if (events.length === 0) {
    return {
      text: "No events scheduled for today.",
      style: "noEvents",
      margin: [0, 20, 0, 20] as [number, number, number, number],
    };
  }

  // Sort events: all-day first, then by start time
  const sortedEvents = [...events].sort((a, b) => {
    if (a.isAllDay && !b.isAllDay) return -1;
    if (!a.isAllDay && b.isAllDay) return 1;
    return a.startTime.getTime() - b.startTime.getTime();
  });

  const tableBody: TableCell[][] = [];

  // Header row
  const headerRow: TableCell[] = [
    { text: "Time", style: "tableHeader", fillColor: "#f0f0f0" },
    { text: "Event", style: "tableHeader", fillColor: "#f0f0f0" },
  ];

  if (options.showLocation) {
    headerRow.push({ text: "Location", style: "tableHeader", fillColor: "#f0f0f0" });
  }

  tableBody.push(headerRow);

  // Event rows
  for (const event of sortedEvents) {
    const timeText = event.isAllDay
      ? "All day"
      : formatTimeRange(event.startTime, event.endTime);

    const eventDetails: Content[] = [{ text: event.title, style: "eventTitle" }];

    if (event.calendarName) {
      eventDetails.push({
        text: event.calendarName,
        style: "calendarName",
        margin: [0, 2, 0, 0] as [number, number, number, number],
      });
    }

    if (options.showDescription && event.description) {
      eventDetails.push({
        text: event.description,
        style: "eventDescription",
        margin: [0, 2, 0, 0] as [number, number, number, number],
      });
    }

    const row: TableCell[] = [
      { text: timeText, style: "timeCell" },
      { stack: eventDetails },
    ];

    if (options.showLocation) {
      row.push({ text: event.location || "", style: "locationCell" });
    }

    tableBody.push(row);
  }

  return {
    table: {
      headerRows: 1,
      widths: options.showLocation
        ? ["auto", "*", "auto"]
        : ["auto", "*"],
      body: tableBody,
    },
    layout: {
      hLineWidth: (i: number) => (i === 0 || i === 1 ? 1 : 0.5),
      vLineWidth: () => 0,
      hLineColor: () => "#cccccc",
      paddingLeft: () => 8,
      paddingRight: () => 8,
      paddingTop: () => 6,
      paddingBottom: () => 6,
    },
    margin: [0, 0, 0, 30] as [number, number, number, number],
  };
}

/**
 * Generate lined note-taking area
 */
function generateNotesSection(lineCount: number): Content {
  const lines: Content[] = [];

  // Notes header
  lines.push({
    text: "Notes",
    style: "sectionHeader",
    margin: [0, 0, 0, 10] as [number, number, number, number],
  });

  // Generate horizontal lines for writing
  const lineSpacing = 25; // pixels between lines

  for (let i = 0; i < lineCount; i++) {
    lines.push({
      canvas: [
        {
          type: "line",
          x1: 0,
          y1: 0,
          x2: 515, // Full page width minus margins
          y2: 0,
          lineWidth: 0.5,
          lineColor: "#cccccc",
        },
      ],
      margin: [0, lineSpacing, 0, 0] as [number, number, number, number],
    });
  }

  return {
    stack: lines,
  };
}

/**
 * Define document styles
 */
const styles: StyleDictionary = {
  dayOfWeek: {
    fontSize: 24,
    bold: true,
  },
  date: {
    fontSize: 14,
    color: "#666666",
    margin: [0, 5, 0, 0],
  },
  title: {
    fontSize: 12,
    color: "#999999",
  },
  sectionHeader: {
    fontSize: 14,
    bold: true,
    color: "#333333",
  },
  tableHeader: {
    fontSize: 10,
    bold: true,
    color: "#333333",
  },
  eventTitle: {
    fontSize: 11,
    bold: true,
  },
  calendarName: {
    fontSize: 9,
    color: "#666666",
  },
  eventDescription: {
    fontSize: 9,
    color: "#888888",
    italics: true,
  },
  timeCell: {
    fontSize: 10,
    color: "#444444",
  },
  locationCell: {
    fontSize: 10,
    color: "#666666",
  },
  noEvents: {
    fontSize: 12,
    color: "#888888",
    italics: true,
  },
};

/**
 * Generate a daily agenda PDF
 *
 * @param options - Configuration options for the agenda
 * @returns Buffer containing the PDF data
 */
export async function generateAgendaPdf(options: AgendaOptions): Promise<Buffer> {
  const {
    date,
    events,
    showLocation = true,
    showDescription = false,
    notesLines = 20,
  } = options;

  const content: Content[] = [];

  // Header with date
  content.push(generateHeader(date));

  // Horizontal rule
  content.push({
    canvas: [
      {
        type: "line",
        x1: 0,
        y1: 0,
        x2: 515,
        y2: 0,
        lineWidth: 2,
        lineColor: "#333333",
      },
    ],
    margin: [0, 0, 0, 20] as [number, number, number, number],
  });

  // Events section
  content.push(generateEventsTable(events, { showLocation, showDescription }));

  // Notes section
  content.push(generateNotesSection(notesLines));

  // Footer with generation info
  content.push({
    text: `Generated by OpenFrame Calendar`,
    style: {
      fontSize: 8,
      color: "#aaaaaa",
    },
    alignment: "center" as const,
    margin: [0, 20, 0, 0] as [number, number, number, number],
  });

  const docDefinition: TDocumentDefinitions = {
    pageSize: "LETTER",
    pageMargins: [40, 40, 40, 40],
    content,
    styles,
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

      pdfDoc.getBuffer((buffer: Buffer) => {
        resolve(buffer);
      });
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
