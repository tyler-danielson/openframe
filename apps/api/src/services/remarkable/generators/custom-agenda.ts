/**
 * Custom Agenda Generator
 * Creates customizable agenda layouts with multiple style options.
 */

import PdfMake from "pdfmake/build/pdfmake.js";
import PdfFonts from "pdfmake/build/vfs_fonts.js";
import { format, differenceInMinutes } from "date-fns";
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
  alignment?: Alignment;
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
 * Format time for display
 */
function formatTime(date: Date): string {
  return format(date, "h:mm a");
}

/**
 * Generate header based on layout
 */
function generateHeader(date: Date, layout: string): Content {
  const headerStyles: Record<string, Style> = {
    timeline: { fontSize: 20, bold: true, color: "#333333" },
    list: { fontSize: 22, bold: true, color: "#222222" },
    blocks: { fontSize: 18, bold: true, color: "#444444" },
  };

  return {
    columns: [
      {
        width: "*",
        stack: [
          {
            text: format(date, "EEEE, MMMM d"),
            style: headerStyles[layout] || headerStyles.list,
          },
          {
            text: format(date, "yyyy"),
            style: {
              fontSize: 12,
              color: "#888888",
              margin: [0, 2, 0, 0],
            },
          },
        ],
      },
    ],
    margin: [0, 0, 0, 20] as Margins,
  };
}

/**
 * Timeline Layout - Hour-by-hour with event blocks
 */
function generateTimelineLayout(
  events: TemplateEvent[],
  config: RemarkableTemplateConfig
): Content {
  const hours = [];
  const startHour = 6; // Start at 6 AM
  const endHour = 22; // End at 10 PM

  for (let hour = startHour; hour <= endHour; hour++) {
    const hourLabel = format(new Date().setHours(hour, 0, 0, 0), "h a");

    // Find events that overlap with this hour
    const hourEvents = events.filter((event) => {
      if (event.isAllDay) return false;
      const eventHour = event.startTime.getHours();
      return eventHour === hour;
    });

    const hourContent: Content[] = [];

    if (hourEvents.length > 0) {
      for (const event of hourEvents) {
        const duration = differenceInMinutes(event.endTime, event.startTime);
        const durationStr = duration >= 60
          ? `${Math.floor(duration / 60)}h ${duration % 60 ? duration % 60 + "m" : ""}`
          : `${duration}m`;

        hourContent.push({
          stack: [
            {
              text: event.title,
              style: "timelineEventTitle",
            },
            {
              text: `${formatTime(event.startTime)} - ${formatTime(event.endTime)} (${durationStr})`,
              style: "timelineEventTime",
            },
            ...(config.showLocation && event.location
              ? [{ text: event.location, style: "timelineEventLocation" }]
              : []),
          ],
          margin: [10, 0, 0, 0] as Margins,
        });
      }
    }

    hours.push({
      columns: [
        {
          width: 50,
          text: hourLabel,
          style: "timelineHour",
        },
        {
          width: "*",
          stack: hourContent.length > 0 ? hourContent : [{ text: "", margin: [0, 8, 0, 8] as Margins }],
        },
      ],
      margin: [0, 0, 0, 2] as Margins,
    });

    // Add separator line
    hours.push({
      canvas: [
        {
          type: "line",
          x1: 50,
          y1: 0,
          x2: 515,
          y2: 0,
          lineWidth: 0.3,
          lineColor: "#dddddd",
        },
      ],
    });
  }

  // Add all-day events at the top
  const allDayEvents = events.filter((e) => e.isAllDay);
  const content: Content[] = [];

  if (allDayEvents.length > 0) {
    content.push({
      stack: [
        { text: "All Day", style: "allDayHeader" },
        ...allDayEvents.map((event) => ({
          text: `• ${event.title}`,
          style: "allDayEvent",
          margin: [10, 2, 0, 2] as Margins,
        })),
      ],
      margin: [0, 0, 0, 15] as Margins,
    });
  }

  content.push({ stack: hours });

  return { stack: content };
}

/**
 * List Layout - Simple vertical list of events
 */
function generateListLayout(
  events: TemplateEvent[],
  config: RemarkableTemplateConfig
): Content {
  // Sort events
  const sortedEvents = [...events].sort((a, b) => {
    if (a.isAllDay && !b.isAllDay) return -1;
    if (!a.isAllDay && b.isAllDay) return 1;
    return a.startTime.getTime() - b.startTime.getTime();
  });

  if (sortedEvents.length === 0) {
    return {
      text: "No events scheduled",
      style: "noEvents",
      margin: [0, 20, 0, 20] as Margins,
    };
  }

  const eventItems: Content[] = [];

  for (const event of sortedEvents) {
    const timeStr = event.isAllDay
      ? "All day"
      : `${formatTime(event.startTime)} - ${formatTime(event.endTime)}`;

    const eventStack: Content[] = [
      {
        columns: [
          {
            width: 120,
            text: timeStr,
            style: "listEventTime",
          },
          {
            width: "*",
            text: event.title,
            style: "listEventTitle",
          },
        ],
      },
    ];

    if (config.showLocation && event.location) {
      eventStack.push({
        text: `📍 ${event.location}`,
        style: "listEventLocation",
        margin: [120, 2, 0, 0] as Margins,
      });
    }

    if (config.showDescription && event.description) {
      eventStack.push({
        text: event.description,
        style: "listEventDescription",
        margin: [120, 2, 0, 0] as Margins,
      });
    }

    eventItems.push({
      stack: eventStack,
      margin: [0, 0, 0, 12] as Margins,
    });

    // Add subtle separator
    eventItems.push({
      canvas: [
        {
          type: "line",
          x1: 0,
          y1: 0,
          x2: 515,
          y2: 0,
          lineWidth: 0.2,
          lineColor: "#eeeeee",
        },
      ],
      margin: [0, 0, 0, 12] as Margins,
    });
  }

  return { stack: eventItems };
}

/**
 * Blocks Layout - Time blocks with visual representation
 */
function generateBlocksLayout(
  events: TemplateEvent[],
  config: RemarkableTemplateConfig
): Content {
  // Separate all-day and timed events
  const allDayEvents = events.filter((e) => e.isAllDay);
  const timedEvents = events
    .filter((e) => !e.isAllDay)
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  const content: Content[] = [];

  // All-day section
  if (allDayEvents.length > 0) {
    content.push({
      stack: [
        { text: "ALL DAY", style: "blocksAllDayHeader" },
        {
          columns: allDayEvents.slice(0, 3).map((event) => ({
            width: "*",
            stack: [
              { text: event.title, style: "blocksAllDayTitle" },
              ...(event.location ? [{ text: event.location, style: "blocksAllDayLocation" }] : []),
            ],
            margin: [0, 0, 10, 0] as Margins,
          })),
        },
      ],
      margin: [0, 0, 0, 20] as Margins,
    });
  }

  // Timed events as blocks
  if (timedEvents.length === 0) {
    content.push({
      text: "No timed events",
      style: "noEvents",
      alignment: "center" as Alignment,
      margin: [0, 30, 0, 0] as Margins,
    });
  } else {
    // Create morning, afternoon, evening sections
    const morning = timedEvents.filter((e) => e.startTime.getHours() < 12);
    const afternoon = timedEvents.filter((e) => e.startTime.getHours() >= 12 && e.startTime.getHours() < 17);
    const evening = timedEvents.filter((e) => e.startTime.getHours() >= 17);

    const createBlockSection = (title: string, sectionEvents: TemplateEvent[]) => {
      if (sectionEvents.length === 0) return null;

      return {
        stack: [
          { text: title, style: "blocksTimeOfDay" },
          ...sectionEvents.map((event) => ({
            table: {
              widths: [80, "*"],
              body: [
                [
                  {
                    text: formatTime(event.startTime),
                    style: "blocksEventTime",
                    border: [false, false, false, false],
                  },
                  {
                    stack: [
                      { text: event.title, style: "blocksEventTitle" },
                      { text: `until ${formatTime(event.endTime)}`, style: "blocksEventEnd" },
                      ...(config.showLocation && event.location
                        ? [{ text: event.location, style: "blocksEventLocation" }]
                        : []),
                    ],
                    border: [true, true, true, true],
                    margin: [8, 6, 8, 6] as Margins,
                  },
                ],
              ],
            },
            layout: {
              hLineWidth: () => 0.5,
              vLineWidth: (i: number) => (i === 0 ? 0 : 0.5),
              hLineColor: () => "#cccccc",
              vLineColor: () => "#cccccc",
            },
            margin: [0, 0, 0, 8] as Margins,
          })),
        ],
        margin: [0, 0, 0, 15] as Margins,
      };
    };

    const morningSection = createBlockSection("MORNING", morning);
    const afternoonSection = createBlockSection("AFTERNOON", afternoon);
    const eveningSection = createBlockSection("EVENING", evening);

    if (morningSection) content.push(morningSection);
    if (afternoonSection) content.push(afternoonSection);
    if (eveningSection) content.push(eveningSection);
  }

  return { stack: content };
}

/**
 * Generate custom sections
 */
function generateCustomSections(
  sections: { name: string; position: "top" | "bottom" }[],
  position: "top" | "bottom"
): Content[] {
  const positionSections = sections.filter((s) => s.position === position);

  return positionSections.map((section) => ({
    stack: [
      { text: section.name, style: "customSectionHeader" },
      ...Array(4)
        .fill(null)
        .map(() => ({
          canvas: [
            {
              type: "line",
              x1: 0,
              y1: 0,
              x2: 515,
              y2: 0,
              lineWidth: 0.3,
              lineColor: "#cccccc",
            },
          ],
          margin: [0, 12, 0, 0] as Margins,
        })),
    ],
    margin: [0, 15, 0, 0] as Margins,
  }));
}

/**
 * Document styles
 */
const styles: StyleDictionary = {
  // Timeline styles
  timelineHour: {
    fontSize: 10,
    color: "#666666",
    bold: true,
  },
  timelineEventTitle: {
    fontSize: 10,
    bold: true,
    color: "#333333",
  },
  timelineEventTime: {
    fontSize: 8,
    color: "#666666",
  },
  timelineEventLocation: {
    fontSize: 8,
    color: "#888888",
    italics: true,
  },
  allDayHeader: {
    fontSize: 10,
    bold: true,
    color: "#555555",
  },
  allDayEvent: {
    fontSize: 10,
    color: "#333333",
  },

  // List styles
  listEventTime: {
    fontSize: 10,
    color: "#555555",
  },
  listEventTitle: {
    fontSize: 11,
    bold: true,
    color: "#333333",
  },
  listEventLocation: {
    fontSize: 9,
    color: "#666666",
  },
  listEventDescription: {
    fontSize: 9,
    color: "#888888",
    italics: true,
  },
  noEvents: {
    fontSize: 12,
    color: "#888888",
    italics: true,
  },

  // Blocks styles
  blocksAllDayHeader: {
    fontSize: 10,
    bold: true,
    color: "#666666",
    margin: [0, 0, 0, 8],
  },
  blocksAllDayTitle: {
    fontSize: 10,
    bold: true,
    color: "#333333",
  },
  blocksAllDayLocation: {
    fontSize: 8,
    color: "#666666",
  },
  blocksTimeOfDay: {
    fontSize: 10,
    bold: true,
    color: "#888888",
    margin: [0, 0, 0, 8],
  },
  blocksEventTime: {
    fontSize: 11,
    bold: true,
    color: "#333333",
  },
  blocksEventTitle: {
    fontSize: 11,
    bold: true,
    color: "#333333",
  },
  blocksEventEnd: {
    fontSize: 9,
    color: "#666666",
  },
  blocksEventLocation: {
    fontSize: 9,
    color: "#888888",
    margin: [0, 2, 0, 0],
  },

  // Custom section styles
  customSectionHeader: {
    fontSize: 11,
    bold: true,
    color: "#444444",
  },
};

export class CustomAgendaGenerator implements TemplateGenerator {
  async generate(options: TemplateOptions): Promise<TemplateResult> {
    const { date, events, config } = options;

    const layout = config.layout || "list";
    const customSections = config.customSections || [];

    const content: Content[] = [];

    // Header
    content.push(generateHeader(date, layout));

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
          lineColor: "#333333",
        },
      ],
      margin: [0, 0, 0, 15] as Margins,
    });

    // Top custom sections
    content.push(...generateCustomSections(customSections, "top"));

    // Main layout
    switch (layout) {
      case "timeline":
        content.push(generateTimelineLayout(events, config));
        break;
      case "blocks":
        content.push(generateBlocksLayout(events, config));
        break;
      case "list":
      default:
        content.push(generateListLayout(events, config));
        break;
    }

    // Bottom custom sections
    content.push(...generateCustomSections(customSections, "bottom"));

    // Footer
    content.push({
      text: "Generated by OpenFrame Calendar",
      style: {
        fontSize: 8,
        color: "#aaaaaa",
      },
      alignment: "center" as Alignment,
      margin: [0, 20, 0, 0] as Margins,
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
      filename: `Custom Agenda ${format(date, "yyyy-MM-dd")}`,
      pageCount: 1,
    };
  }

  getDefaultConfig(): RemarkableTemplateConfig {
    return {
      layout: "list",
      showLocation: true,
      showDescription: false,
      customSections: [],
    };
  }

  validateConfig(config: RemarkableTemplateConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.layout !== undefined) {
      if (!["timeline", "list", "blocks"].includes(config.layout)) {
        errors.push("layout must be 'timeline', 'list', or 'blocks'");
      }
    }

    if (config.customSections !== undefined) {
      if (!Array.isArray(config.customSections)) {
        errors.push("customSections must be an array");
      } else {
        for (const section of config.customSections) {
          if (!section.name || typeof section.name !== "string") {
            errors.push("Each custom section must have a name");
          }
          if (!["top", "bottom"].includes(section.position)) {
            errors.push("Custom section position must be 'top' or 'bottom'");
          }
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
