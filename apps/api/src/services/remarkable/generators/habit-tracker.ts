/**
 * Habit Tracker Generator
 * Creates a monthly habit tracking grid optimized for reMarkable.
 */

import PdfMake from "pdfmake/build/pdfmake.js";
import PdfFonts from "pdfmake/build/vfs_fonts.js";
import { format, startOfMonth, endOfMonth, getDaysInMonth } from "date-fns";
import type { RemarkableTemplateConfig } from "@openframe/database/schema";
import type {
  TemplateGenerator,
  TemplateOptions,
  TemplateResult,
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
 * Default habits if none configured
 */
const DEFAULT_HABITS = [
  "Exercise",
  "Reading",
  "Meditation",
  "Hydration",
  "Sleep 7+ hrs",
  "Healthy eating",
  "No social media",
  "Journaling",
];

/**
 * Generate header with month/year
 */
function generateHeader(date: Date): Content {
  return {
    columns: [
      {
        width: "*",
        stack: [
          {
            text: format(date, "MMMM yyyy"),
            style: "title",
          },
          {
            text: "Habit Tracker",
            style: "subtitle",
          },
        ],
      },
    ],
    margin: [0, 0, 0, 20] as Margins,
  };
}

/**
 * Generate the habit tracking grid
 */
function generateHabitGrid(date: Date, habits: string[]): Content {
  const daysInMonth = getDaysInMonth(date);

  // Create header row with day numbers
  const headerRow: Content[] = [
    { text: "Habit", style: "tableHeader", alignment: "left" as Alignment },
  ];

  for (let day = 1; day <= daysInMonth; day++) {
    headerRow.push({
      text: String(day),
      style: "dayHeader",
      alignment: "center" as Alignment,
    });
  }

  // Create rows for each habit
  const tableBody: Content[][] = [headerRow];

  for (const habit of habits) {
    const habitRow: Content[] = [
      { text: habit, style: "habitName", alignment: "left" as Alignment },
    ];

    for (let day = 1; day <= daysInMonth; day++) {
      // Empty checkbox cell
      habitRow.push({
        text: "",
        style: "checkboxCell",
        alignment: "center" as Alignment,
      });
    }

    tableBody.push(habitRow);
  }

  // Calculate column widths
  const habitColumnWidth = 80;
  const dayColumnWidth = (750 - habitColumnWidth - 60) / daysInMonth; // Landscape width minus margins

  const widths = [
    habitColumnWidth,
    ...Array(daysInMonth).fill(Math.max(dayColumnWidth, 15)),
  ];

  return {
    table: {
      headerRows: 1,
      widths,
      body: tableBody,
    },
    layout: {
      hLineWidth: (i: number, node: unknown) => {
        const tableNode = node as { table: { body: unknown[][] } };
        return i === 0 || i === 1 || i === tableNode.table.body.length ? 1 : 0.3;
      },
      vLineWidth: (i: number) => (i === 0 || i === 1 ? 1 : 0.3),
      hLineColor: (i: number) => (i === 0 || i === 1 ? "#333333" : "#cccccc"),
      vLineColor: (i: number) => (i === 0 || i === 1 ? "#333333" : "#cccccc"),
      paddingLeft: () => 4,
      paddingRight: () => 4,
      paddingTop: () => 6,
      paddingBottom: () => 6,
    },
  };
}

/**
 * Generate notes section
 */
function generateNotesSection(): Content {
  return {
    stack: [
      {
        text: "Monthly Notes",
        style: "sectionHeader",
        margin: [0, 20, 0, 10] as Margins,
      },
      ...Array(5)
        .fill(null)
        .map(() => ({
          canvas: [
            {
              type: "line",
              x1: 0,
              y1: 0,
              x2: 750,
              y2: 0,
              lineWidth: 0.3,
              lineColor: "#cccccc",
            },
          ],
          margin: [0, 15, 0, 0] as Margins,
        })),
    ],
  };
}

/**
 * Generate streak tracking section
 */
function generateStreakSection(habits: string[]): Content {
  const halfLength = Math.ceil(habits.length / 2);
  const leftHabits = habits.slice(0, halfLength);
  const rightHabits = habits.slice(halfLength);

  const createStreakColumn = (habitList: string[]) => ({
    width: "*",
    stack: habitList.map((habit) => ({
      columns: [
        { text: habit, width: 120, style: "streakLabel" },
        { text: "Streak: ____  Best: ____", style: "streakValue" },
      ],
      margin: [0, 0, 0, 8] as Margins,
    })),
  });

  return {
    stack: [
      {
        text: "Streak Tracker",
        style: "sectionHeader",
        margin: [0, 20, 0, 10] as Margins,
      },
      {
        columns: [
          createStreakColumn(leftHabits),
          createStreakColumn(rightHabits),
        ],
        columnGap: 30,
      },
    ],
  };
}

/**
 * Document styles
 */
const styles: StyleDictionary = {
  title: {
    fontSize: 24,
    bold: true,
    color: "#333333",
  },
  subtitle: {
    fontSize: 14,
    color: "#666666",
    margin: [0, 3, 0, 0],
  },
  tableHeader: {
    fontSize: 9,
    bold: true,
    color: "#333333",
  },
  dayHeader: {
    fontSize: 8,
    bold: true,
    color: "#555555",
  },
  habitName: {
    fontSize: 9,
    color: "#333333",
  },
  checkboxCell: {
    fontSize: 8,
  },
  sectionHeader: {
    fontSize: 12,
    bold: true,
    color: "#333333",
  },
  streakLabel: {
    fontSize: 9,
    color: "#444444",
  },
  streakValue: {
    fontSize: 9,
    color: "#666666",
  },
};

export class HabitTrackerGenerator implements TemplateGenerator {
  async generate(options: TemplateOptions): Promise<TemplateResult> {
    const { date, config } = options;

    const habits = config.habits?.length ? config.habits : DEFAULT_HABITS;
    const targetMonth = config.trackerMonth
      ? new Date(config.trackerMonth + "-01")
      : startOfMonth(date);

    const content: Content[] = [];

    // Header
    content.push(generateHeader(targetMonth));

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

    // Habit grid
    content.push(generateHabitGrid(targetMonth, habits));

    // Streak section
    content.push(generateStreakSection(habits));

    // Notes section
    content.push(generateNotesSection());

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
      filename: `Habit Tracker ${format(targetMonth, "yyyy-MM")}`,
      pageCount: 1,
    };
  }

  getDefaultConfig(): RemarkableTemplateConfig {
    return {
      habits: DEFAULT_HABITS,
    };
  }

  validateConfig(config: RemarkableTemplateConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.habits !== undefined) {
      if (!Array.isArray(config.habits)) {
        errors.push("habits must be an array of strings");
      } else if (config.habits.length === 0) {
        errors.push("habits array cannot be empty");
      } else if (config.habits.length > 15) {
        errors.push("Maximum 15 habits allowed per tracker");
      }
    }

    if (config.trackerMonth !== undefined) {
      const monthRegex = /^\d{4}-\d{2}$/;
      if (!monthRegex.test(config.trackerMonth)) {
        errors.push("trackerMonth must be in YYYY-MM format");
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
