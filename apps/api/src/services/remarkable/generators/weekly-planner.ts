/**
 * Weekly Planner Generator
 * Creates a 7-day planner layout optimized for reMarkable.
 */

import PdfMake from "pdfmake/build/pdfmake.js";
import PdfFonts from "pdfmake/build/vfs_fonts.js";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import type { RemarkableTemplateConfig } from "@openframe/database/schema";
import type {
  TemplateGenerator,
  TemplateOptions,
  TemplateResult,
  TemplateEvent,
} from "../template-engine.js";

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

type Content = Record<string, unknown>;

interface TDocumentDefinitions {
  pageSize?: string | { width: number; height: number };
  pageOrientation?: "portrait" | "landscape";
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
 * Format time for display (e.g., "9:00 AM")
 */
function formatTime(date: Date): string {
  return format(date, "h:mm a");
}

/**
 * Get events for a specific day
 */
function getEventsForDay(events: TemplateEvent[], day: Date): TemplateEvent[] {
  return events
    .filter((event) => isSameDay(event.startTime, day))
    .sort((a, b) => {
      if (a.isAllDay && !b.isAllDay) return -1;
      if (!a.isAllDay && b.isAllDay) return 1;
      return a.startTime.getTime() - b.startTime.getTime();
    });
}

/**
 * Generate header with week range
 */
function generateHeader(weekStart: Date): Content {
  const weekEnd = addDays(weekStart, 6);
  const weekRange = `${format(weekStart, "MMMM d")} - ${format(weekEnd, "MMMM d, yyyy")}`;

  return {
    columns: [
      {
        width: "*",
        stack: [
          {
            text: "Weekly Planner",
            style: "title",
          },
          {
            text: weekRange,
            style: "weekRange",
          },
        ],
      },
      {
        width: "auto",
        text: `Week ${format(weekStart, "w")}`,
        style: "weekNumber",
        alignment: "right" as const,
      },
    ],
    margin: [0, 0, 0, 15] as Margins,
  };
}

/**
 * Generate a day cell for the planner
 */
function generateDayCell(
  day: Date,
  events: TemplateEvent[],
  isToday: boolean,
  showNotes: boolean
): Content {
  const dayEvents = getEventsForDay(events, day);

  const cellContent: Content[] = [
    {
      text: format(day, "EEE"),
      style: isToday ? "dayNameToday" : "dayName",
    },
    {
      text: format(day, "d"),
      style: isToday ? "dayNumberToday" : "dayNumber",
      margin: [0, 0, 0, 5] as Margins,
    },
  ];

  // Add events (limit to 5 per day to fit)
  const displayEvents = dayEvents.slice(0, 5);
  for (const event of displayEvents) {
    const timeStr = event.isAllDay ? "" : `${formatTime(event.startTime)} `;
    cellContent.push({
      text: `${timeStr}${event.title}`,
      style: "eventItem",
      margin: [0, 2, 0, 0] as Margins,
    });
  }

  if (dayEvents.length > 5) {
    cellContent.push({
      text: `+${dayEvents.length - 5} more`,
      style: "moreEvents",
      margin: [0, 2, 0, 0] as Margins,
    });
  }

  // Add note lines if enabled
  if (showNotes && displayEvents.length < 4) {
    const noteLines = 4 - displayEvents.length;
    for (let i = 0; i < noteLines; i++) {
      cellContent.push({
        canvas: [
          {
            type: "line",
            x1: 0,
            y1: 0,
            x2: 100,
            y2: 0,
            lineWidth: 0.3,
            lineColor: "#dddddd",
          },
        ],
        margin: [0, 8, 0, 0] as Margins,
      });
    }
  }

  return {
    stack: cellContent,
    style: isToday ? "dayCellToday" : "dayCell",
  };
}

/**
 * Generate the week grid
 */
function generateWeekGrid(
  weekStart: Date,
  events: TemplateEvent[],
  showNotes: boolean
): Content {
  const today = new Date();
  const days: Content[] = [];

  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStart, i);
    const isToday = isSameDay(day, today);
    days.push(generateDayCell(day, events, isToday, showNotes));
  }

  // First row: Mon-Thu (or Sun-Wed depending on weekStartsOn)
  // Second row: Fri-Sun (or Thu-Sat) + notes
  return {
    stack: [
      {
        columns: days.slice(0, 4).map((day) => ({
          width: "*",
          ...day,
        })),
        columnGap: 10,
        margin: [0, 0, 0, 10] as Margins,
      },
      {
        columns: [
          ...days.slice(4).map((day) => ({
            width: "*",
            ...day,
          })),
          {
            width: "*",
            stack: [
              { text: "Week Notes", style: "notesHeader" },
              ...Array(8)
                .fill(null)
                .map(() => ({
                  canvas: [
                    {
                      type: "line",
                      x1: 0,
                      y1: 0,
                      x2: 130,
                      y2: 0,
                      lineWidth: 0.3,
                      lineColor: "#cccccc",
                    },
                  ],
                  margin: [0, 12, 0, 0] as Margins,
                })),
            ],
            style: "notesCell",
          },
        ],
        columnGap: 10,
      },
    ],
  };
}

/**
 * Document styles
 */
const styles: StyleDictionary = {
  title: {
    fontSize: 20,
    bold: true,
    color: "#333333",
  },
  weekRange: {
    fontSize: 12,
    color: "#666666",
    margin: [0, 3, 0, 0],
  },
  weekNumber: {
    fontSize: 14,
    color: "#888888",
    margin: [0, 5, 0, 0],
  },
  dayCell: {
    fontSize: 10,
  },
  dayCellToday: {
    fontSize: 10,
  },
  dayName: {
    fontSize: 11,
    bold: true,
    color: "#666666",
  },
  dayNameToday: {
    fontSize: 11,
    bold: true,
    color: "#2563eb",
  },
  dayNumber: {
    fontSize: 18,
    bold: true,
    color: "#333333",
  },
  dayNumberToday: {
    fontSize: 18,
    bold: true,
    color: "#2563eb",
  },
  eventItem: {
    fontSize: 8,
    color: "#444444",
  },
  moreEvents: {
    fontSize: 8,
    color: "#888888",
    italics: true,
  },
  notesHeader: {
    fontSize: 11,
    bold: true,
    color: "#666666",
    margin: [0, 0, 0, 5],
  },
  notesCell: {
    fontSize: 10,
  },
};

export class WeeklyPlannerGenerator implements TemplateGenerator {
  async generate(options: TemplateOptions): Promise<TemplateResult> {
    const { date, events, config } = options;

    const weekStartsOn = config.weekStartsOn ?? 1; // Default to Monday
    const showNotes = config.showNotes ?? true;

    const weekStart = startOfWeek(date, { weekStartsOn });
    const weekEnd = addDays(weekStart, 6);

    const content: Content[] = [];

    // Header
    content.push(generateHeader(weekStart));

    // Horizontal rule
    content.push({
      canvas: [
        {
          type: "line",
          x1: 0,
          y1: 0,
          x2: 750,
          y2: 0,
          lineWidth: 1.5,
          lineColor: "#333333",
        },
      ],
      margin: [0, 0, 0, 15] as Margins,
    });

    // Week grid
    content.push(generateWeekGrid(weekStart, events, showNotes));

    // Footer
    content.push({
      text: "Generated by OpenFrame Calendar",
      style: {
        fontSize: 8,
        color: "#aaaaaa",
      },
      alignment: "center" as Alignment,
      margin: [0, 30, 0, 0] as Margins,
    });

    const docDefinition: TDocumentDefinitions = {
      pageSize: "LETTER",
      pageOrientation: "landscape",
      pageMargins: [30, 30, 30, 30],
      content,
      styles,
      defaultStyle: {
        font: "Roboto",
        fontSize: 10,
      },
    };

    const buffer = await new Promise<Buffer>((resolve, reject) => {
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

    return {
      buffer,
      filename: `Weekly Planner ${format(weekStart, "yyyy-MM-dd")} to ${format(weekEnd, "yyyy-MM-dd")}`,
      pageCount: 1,
    };
  }

  getDefaultConfig(): RemarkableTemplateConfig {
    return {
      weekStartsOn: 1, // Monday
      showNotes: true,
      notesPosition: "shared",
    };
  }

  validateConfig(config: RemarkableTemplateConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.weekStartsOn !== undefined) {
      if (![0, 1, 6].includes(config.weekStartsOn)) {
        errors.push("weekStartsOn must be 0 (Sunday), 1 (Monday), or 6 (Saturday)");
      }
    }

    if (config.notesPosition !== undefined) {
      if (!["per-day", "shared"].includes(config.notesPosition)) {
        errors.push("notesPosition must be 'per-day' or 'shared'");
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
