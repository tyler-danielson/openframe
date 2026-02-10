/**
 * Planner PDF Generator Service
 * Generates PDF documents from widget-based planner layouts for reMarkable delivery
 */

import PdfMakeModule from "pdfmake/build/pdfmake.js";
import PdfFonts from "pdfmake/build/vfs_fonts.js";
import { format, startOfWeek, addDays, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from "date-fns";
import type { PlannerLayoutConfig, PlannerWidgetInstance, PlannerWidgetType } from "@openframe/shared";

// Type definitions for pdfmake
type Margins = [number, number, number, number] | [number, number] | number;
type Alignment = "left" | "right" | "center" | "justify";

interface ContentText {
  text: string;
  style?: string;
  fontSize?: number;
  bold?: boolean;
  alignment?: Alignment;
  margin?: Margins;
  color?: string;
}

interface ContentStack {
  stack: Content[];
  margin?: Margins;
}

interface ContentColumns {
  columns: Content[];
  margin?: Margins;
  columnGap?: number;
}

interface ContentTable {
  table: {
    headerRows?: number;
    widths?: (number | string)[];
    heights?: (number | string)[] | number | string;
    body: TableCell[][];
  };
  layout?: TableLayout | string;
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
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  r?: number;
  lineWidth?: number;
  lineColor?: string;
  dash?: { length: number; space: number };
}

interface TableLayout {
  hLineWidth?: (i: number, node: unknown) => number;
  vLineWidth?: (i: number, node: unknown) => number;
  hLineColor?: (i: number, node: unknown) => string;
  vLineColor?: (i: number, node: unknown) => string;
  paddingLeft?: (i: number, node: unknown) => number;
  paddingRight?: (i: number, node: unknown) => number;
  paddingTop?: (i: number, node: unknown) => number;
  paddingBottom?: (i: number, node: unknown) => number;
}

type TableCell = ContentText | ContentStack | { text: string; style?: string; fillColor?: string; alignment?: Alignment };
type Content = ContentText | ContentStack | ContentColumns | ContentTable | ContentCanvas | string;

interface TDocumentDefinitions {
  pageSize?: string | { width: number; height: number };
  pageOrientation?: "portrait" | "landscape";
  pageMargins?: Margins;
  content: Content[];
  styles?: Record<string, unknown>;
  defaultStyle?: Record<string, unknown>;
}

// Type for pdfmake instance
interface PdfMakeType {
  vfs: Record<string, string>;
  createPdf: (docDefinition: TDocumentDefinitions) => {
    getBuffer: (callback: (buffer: Buffer) => void) => void;
  };
}

// Initialize pdfmake with embedded fonts
const PdfMake = PdfMakeModule as unknown as PdfMakeType;
const fontsData = PdfFonts as unknown as { pdfMake?: { vfs: Record<string, string> }; vfs?: Record<string, string> };
PdfMake.vfs = fontsData.pdfMake?.vfs ?? fontsData.vfs ?? {};

// Page sizes
const PAGE_SIZES: Record<string, { width: number; height: number }> = {
  remarkable: { width: 1404, height: 1872 }, // reMarkable 2 screen size
  letter: { width: 612, height: 792 }, // 8.5" x 11" at 72 DPI
  a4: { width: 595, height: 842 }, // A4 at 72 DPI
};

// Scale factor for remarkable (it uses higher resolution)
const REMARKABLE_SCALE = 0.4; // Scale down for reasonable PDF

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
  location?: string;
  description?: string;
  calendarName?: string;
  color?: string;
}

export interface TaskItem {
  id: string;
  title: string;
  dueDate?: Date;
  completed: boolean;
}

export interface NewsItem {
  id: string;
  title: string;
  source?: string;
  publishedAt?: Date;
}

export interface WeatherData {
  current: {
    temp: number;
    description: string;
    icon: string;
  };
  forecast: Array<{
    date: Date;
    high: number;
    low: number;
    icon: string;
  }>;
}

export interface PlannerGeneratorOptions {
  date: Date;
  events: CalendarEvent[];
  tasks: TaskItem[];
  news: NewsItem[];
  weather?: WeatherData;
  habits?: string[];
}

/**
 * Process template variables in text (e.g., {{date:MMMM d, yyyy}})
 * Note: Converts common legacy format tokens to date-fns v4 compatible tokens
 */
function processTemplateText(text: string, date: Date): string {
  return text.replace(/\{\{date(?::([^}]+))?\}\}/g, (match, formatStr) => {
    let safeFormat = formatStr || "MMMM d, yyyy";
    // Convert legacy format tokens to date-fns v4 compatible tokens:
    // D -> d (day of month, not day of year)
    // YYYY -> yyyy (calendar year)
    // DD -> dd (zero-padded day)
    safeFormat = safeFormat
      .replace(/\bD\b/g, "d")      // Single D -> d (day of month)
      .replace(/\bDD\b/g, "dd")    // DD -> dd (zero-padded day of month)
      .replace(/\bYYYY\b/g, "yyyy") // YYYY -> yyyy
      .replace(/\bYY\b/g, "yy")    // YY -> yy
      .replace(/\bW\b/g, "'W'")    // W -> escaped 'W' (literal W, not week number)
      .replace(/\bWW\b/g, "II")    // WW -> II (ISO week number, zero-padded)
      .replace(/\bw\b/g, "I");     // w -> I (ISO week number)
    return format(date, safeFormat);
  });
}

/**
 * Get font size from size preset
 */
function getFontSize(preset: string): number {
  const sizes: Record<string, number> = {
    sm: 8,
    md: 10,
    lg: 12,
    xl: 16,
    "2xl": 20,
  };
  return sizes[preset] || 10;
}

/**
 * Format time for display
 */
function formatTime(date: Date): string {
  return format(date, "h:mm a");
}

/**
 * Render a calendar-day widget
 */
function renderCalendarDayWidget(
  widget: PlannerWidgetInstance,
  options: PlannerGeneratorOptions,
  cellWidth: number,
  cellHeight: number
): Content {
  const config = widget.config as {
    showTimeSlots?: boolean;
    startHour?: number;
    endHour?: number;
    showLocation?: boolean;
  };

  const dayEvents = options.events.filter((e) => {
    const eventDate = new Date(e.startTime);
    return (
      eventDate.toDateString() === options.date.toDateString() &&
      !e.isAllDay
    );
  });

  const content: Content[] = [
    {
      text: format(options.date, "EEEE, MMMM d"),
      fontSize: 12,
      bold: true,
      margin: [0, 0, 0, 8],
    },
  ];

  // Render events
  dayEvents.forEach((event) => {
    const timeStr = `${formatTime(new Date(event.startTime))} - ${formatTime(new Date(event.endTime))}`;
    content.push({
      text: timeStr,
      fontSize: 8,
      color: "#666666",
      margin: [0, 4, 0, 0],
    });
    content.push({
      text: event.title,
      fontSize: 10,
      bold: true,
      margin: [0, 0, 0, 2],
    });
    if (config.showLocation && event.location) {
      content.push({
        text: event.location,
        fontSize: 8,
        color: "#666666",
        margin: [0, 0, 0, 4],
      });
    }
  });

  if (dayEvents.length === 0) {
    content.push({
      text: "No events scheduled",
      fontSize: 9,
      color: "#999999",
      margin: [0, 8, 0, 0],
    });
  }

  return {
    stack: content,
    margin: [4, 4, 4, 4],
  };
}

/**
 * Render a calendar-week widget
 */
function renderCalendarWeekWidget(
  widget: PlannerWidgetInstance,
  options: PlannerGeneratorOptions,
  cellWidth: number,
  cellHeight: number
): Content {
  const config = widget.config as {
    weekStartsOn?: number;
    showDayNames?: boolean;
    showDates?: boolean;
  };

  const weekStart = startOfWeek(options.date, { weekStartsOn: config.weekStartsOn as 0 | 1 | 6 || 0 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Create header row with day names
  const headerRow: TableCell[] = days.map((day) => ({
    text: format(day, "EEE"),
    alignment: "center" as const,
    bold: true,
    fontSize: 9,
  }));

  // Create date row
  const dateRow: TableCell[] = days.map((day) => ({
    text: format(day, "d"),
    alignment: "center" as const,
    fontSize: 8,
    color: "#666666",
  }));

  // Create event rows
  const eventRow: TableCell[] = days.map((day) => {
    const dayEvents = options.events.filter((e) => {
      const eventDate = new Date(e.startTime);
      return eventDate.toDateString() === day.toDateString();
    });

    return {
      stack: dayEvents.slice(0, 3).map((e) => ({
        text: e.isAllDay ? e.title : `${format(new Date(e.startTime), "h:mm")} ${e.title}`,
        fontSize: 7,
        margin: [0, 1, 0, 1] as Margins,
      })),
    };
  });

  return {
    table: {
      headerRows: 2,
      widths: Array(7).fill("*"),
      body: [headerRow, dateRow, eventRow],
    },
    layout: "lightHorizontalLines",
    margin: [0, 4, 0, 4],
  };
}

/**
 * Render a calendar-month widget
 */
function renderCalendarMonthWidget(
  widget: PlannerWidgetInstance,
  options: PlannerGeneratorOptions,
  cellWidth: number,
  cellHeight: number
): Content {
  const config = widget.config as {
    weekStartsOn?: number;
    showWeekNumbers?: boolean;
  };

  const monthStart = startOfMonth(options.date);
  const monthEnd = endOfMonth(options.date);
  const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Create header
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const headerRow: TableCell[] = dayNames.map((name) => ({
    text: name,
    alignment: "center" as const,
    bold: true,
    fontSize: 8,
  }));

  // Create weeks
  const weeks: TableCell[][] = [];
  let currentWeek: TableCell[] = [];

  // Fill in empty days at start
  const firstDayOfWeek = getDay(monthStart);
  for (let i = 0; i < firstDayOfWeek; i++) {
    currentWeek.push({ text: "", alignment: "center" as const });
  }

  allDays.forEach((day) => {
    const dayEvents = options.events.filter((e) => {
      const eventDate = new Date(e.startTime);
      return eventDate.toDateString() === day.toDateString();
    });

    const hasEvents = dayEvents.length > 0;

    currentWeek.push({
      text: format(day, "d") + (hasEvents ? " •" : ""),
      alignment: "center" as const,
      fontSize: 8,
    });

    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });

  // Fill remaining days
  while (currentWeek.length > 0 && currentWeek.length < 7) {
    currentWeek.push({ text: "", alignment: "center" as const });
  }
  if (currentWeek.length === 7) {
    weeks.push(currentWeek);
  }

  return {
    stack: [
      {
        text: format(options.date, "MMMM yyyy"),
        fontSize: 12,
        bold: true,
        alignment: "center" as const,
        margin: [0, 0, 0, 8] as Margins,
      },
      {
        table: {
          headerRows: 1,
          widths: Array(7).fill("*"),
          body: [headerRow, ...weeks],
        },
        layout: "lightHorizontalLines",
      },
    ],
    margin: [4, 4, 4, 4],
  };
}

/**
 * Render a tasks widget
 */
function renderTasksWidget(
  widget: PlannerWidgetInstance,
  options: PlannerGeneratorOptions,
  cellWidth: number,
  cellHeight: number
): Content {
  const config = widget.config as {
    maxItems?: number;
    showCheckboxes?: boolean;
    showDueDate?: boolean;
  };

  const maxItems = config.maxItems || 10;
  const tasks = options.tasks.filter((t) => !t.completed).slice(0, maxItems);

  const content: Content[] = [
    {
      text: "Tasks",
      fontSize: 11,
      bold: true,
      margin: [0, 0, 0, 6],
    },
  ];

  tasks.forEach((task) => {
    const checkbox = config.showCheckboxes !== false ? "☐ " : "";
    const dueStr = config.showDueDate && task.dueDate
      ? ` (${format(new Date(task.dueDate), "MMM d")})`
      : "";

    content.push({
      text: checkbox + task.title + dueStr,
      fontSize: 9,
      margin: [0, 2, 0, 2],
    });
  });

  if (tasks.length === 0) {
    content.push({
      text: "No tasks",
      fontSize: 9,
      color: "#999999",
      margin: [0, 4, 0, 0],
    });
  }

  return {
    stack: content,
    margin: [4, 4, 4, 4],
  };
}

/**
 * Render a news-headlines widget
 */
function renderNewsWidget(
  widget: PlannerWidgetInstance,
  options: PlannerGeneratorOptions,
  cellWidth: number,
  cellHeight: number
): Content {
  const config = widget.config as {
    maxItems?: number;
    showSource?: boolean;
  };

  const maxItems = config.maxItems || 5;
  const news = options.news.slice(0, maxItems);

  const content: Content[] = [
    {
      text: "Headlines",
      fontSize: 11,
      bold: true,
      margin: [0, 0, 0, 6],
    },
  ];

  news.forEach((item) => {
    content.push({
      text: "• " + item.title,
      fontSize: 9,
      margin: [0, 2, 0, 2],
    });
    if (config.showSource && item.source) {
      content.push({
        text: `  — ${item.source}`,
        fontSize: 7,
        color: "#666666",
        margin: [0, 0, 0, 2],
      });
    }
  });

  if (news.length === 0) {
    content.push({
      text: "No headlines",
      fontSize: 9,
      color: "#999999",
      margin: [0, 4, 0, 0],
    });
  }

  return {
    stack: content,
    margin: [4, 4, 4, 4],
  };
}

/**
 * Render a weather widget
 */
function renderWeatherWidget(
  widget: PlannerWidgetInstance,
  options: PlannerGeneratorOptions,
  cellWidth: number,
  cellHeight: number
): Content {
  const config = widget.config as {
    showHighLow?: boolean;
    forecastDays?: number;
  };

  if (!options.weather) {
    return {
      text: "Weather data not available",
      fontSize: 9,
      color: "#999999",
      margin: [4, 4, 4, 4],
    };
  }

  const content: Content[] = [
    {
      text: `${Math.round(options.weather.current.temp)}°`,
      fontSize: 20,
      bold: true,
    },
    {
      text: options.weather.current.description,
      fontSize: 9,
      margin: [0, 2, 0, 4],
    },
  ];

  if (config.showHighLow && options.weather.forecast.length > 0) {
    const today = options.weather.forecast[0]!;
    content.push({
      text: `H: ${Math.round(today.high)}° L: ${Math.round(today.low)}°`,
      fontSize: 8,
      color: "#666666",
    });
  }

  return {
    stack: content,
    margin: [4, 4, 4, 4],
  };
}

/**
 * Render a notes widget
 */
function renderNotesWidget(
  widget: PlannerWidgetInstance,
  options: PlannerGeneratorOptions,
  cellWidth: number,
  cellHeight: number
): Content {
  const config = widget.config as {
    title?: string;
    showTitle?: boolean;
    lineSpacing?: number;
    lineStyle?: string;
  };

  const lineSpacing = config.lineSpacing || 20;
  const showTitle = config.showTitle !== false;
  const title = config.title || "Notes";
  const availableHeight = cellHeight - (showTitle ? 20 : 0);
  const lineCount = Math.floor(availableHeight / lineSpacing);

  const lines: CanvasElement[] = [];
  for (let i = 0; i < lineCount; i++) {
    const y = (showTitle ? 20 : 4) + (i * lineSpacing);
    lines.push({
      type: "line",
      x1: 4,
      y1: y,
      x2: cellWidth - 8,
      y2: y,
      lineWidth: 0.5,
      lineColor: "#CCCCCC",
      ...(config.lineStyle === "dashed" ? { dash: { length: 3, space: 2 } } : {}),
    });
  }

  const content: Content[] = [];
  if (showTitle) {
    content.push({
      text: title,
      fontSize: 10,
      bold: true,
      margin: [4, 0, 4, 4],
    });
  }

  content.push({
    canvas: lines,
  });

  return {
    stack: content,
  };
}

/**
 * Render a text widget
 */
function renderTextWidget(
  widget: PlannerWidgetInstance,
  options: PlannerGeneratorOptions,
  cellWidth: number,
  cellHeight: number
): Content {
  const config = widget.config as {
    text: string;
    fontSize?: string;
    fontWeight?: string;
    textAlign?: string;
  };

  const text = processTemplateText(config.text || "", options.date);

  return {
    text,
    fontSize: getFontSize(config.fontSize || "md"),
    bold: config.fontWeight === "bold",
    alignment: (config.textAlign || "left") as Alignment,
    margin: [4, 4, 4, 4],
  };
}

/**
 * Render a divider widget
 */
function renderDividerWidget(
  widget: PlannerWidgetInstance,
  options: PlannerGeneratorOptions,
  cellWidth: number,
  cellHeight: number
): Content {
  const config = widget.config as {
    orientation?: string;
    style?: string;
    thickness?: number;
  };

  const thickness = config.thickness || 1;
  const isHorizontal = config.orientation !== "vertical";

  const line: CanvasElement = {
    type: "line",
    x1: 0,
    y1: isHorizontal ? cellHeight / 2 : 0,
    x2: isHorizontal ? cellWidth : 0,
    y2: isHorizontal ? cellHeight / 2 : cellHeight,
    lineWidth: thickness,
    lineColor: "#CCCCCC",
    ...(config.style === "dashed" ? { dash: { length: 4, space: 2 } } : {}),
    ...(config.style === "dotted" ? { dash: { length: 1, space: 2 } } : {}),
  };

  return {
    canvas: [line],
  };
}

/**
 * Render a habits widget
 */
function renderHabitsWidget(
  widget: PlannerWidgetInstance,
  options: PlannerGeneratorOptions,
  cellWidth: number,
  cellHeight: number
): Content {
  const config = widget.config as {
    habits?: string[];
    showDates?: boolean;
    checkboxStyle?: string;
  };

  const habits = config.habits || options.habits || ["Habit 1", "Habit 2", "Habit 3"];
  const monthDays = eachDayOfInterval({
    start: startOfMonth(options.date),
    end: endOfMonth(options.date),
  });

  // Header row with dates
  const headerRow: TableCell[] = [
    { text: "", alignment: "center" as const },
    ...monthDays.map((day) => ({
      text: format(day, "d"),
      alignment: "center" as const,
      fontSize: 6,
    })),
  ];

  // Habit rows
  const habitRows: TableCell[][] = habits.map((habit) => [
    { text: habit, fontSize: 8 },
    ...monthDays.map(() => ({
      text: "○",
      alignment: "center" as const,
      fontSize: 8,
    })),
  ]);

  return {
    stack: [
      {
        text: format(options.date, "MMMM yyyy") + " Habits",
        fontSize: 11,
        bold: true,
        alignment: "center" as const,
        margin: [0, 0, 0, 8] as Margins,
      },
      {
        table: {
          headerRows: 1,
          widths: ["auto", ...Array(monthDays.length).fill("*")],
          body: [headerRow, ...habitRows],
        },
        layout: "lightHorizontalLines",
      },
    ],
    margin: [4, 4, 4, 4],
  };
}

/**
 * Render a widget based on its type
 */
function renderWidget(
  widget: PlannerWidgetInstance,
  options: PlannerGeneratorOptions,
  cellWidth: number,
  cellHeight: number
): Content {
  switch (widget.type) {
    case "calendar-day":
      return renderCalendarDayWidget(widget, options, cellWidth, cellHeight);
    case "calendar-week":
      return renderCalendarWeekWidget(widget, options, cellWidth, cellHeight);
    case "calendar-month":
      return renderCalendarMonthWidget(widget, options, cellWidth, cellHeight);
    case "tasks":
      return renderTasksWidget(widget, options, cellWidth, cellHeight);
    case "news-headlines":
      return renderNewsWidget(widget, options, cellWidth, cellHeight);
    case "weather":
      return renderWeatherWidget(widget, options, cellWidth, cellHeight);
    case "notes":
      return renderNotesWidget(widget, options, cellWidth, cellHeight);
    case "text":
      return renderTextWidget(widget, options, cellWidth, cellHeight);
    case "divider":
      return renderDividerWidget(widget, options, cellWidth, cellHeight);
    case "habits":
      return renderHabitsWidget(widget, options, cellWidth, cellHeight);
    default:
      return {
        text: `Unknown widget: ${widget.type}`,
        fontSize: 9,
        color: "#999999",
      };
  }
}

/**
 * Generate a planner PDF from layout configuration
 */
export async function generatePlannerPdf(
  layoutConfig: PlannerLayoutConfig,
  options: PlannerGeneratorOptions
): Promise<{ buffer: Buffer; filename: string }> {
  // Determine page size
  const pageSize = PAGE_SIZES[layoutConfig.pageSize] ?? PAGE_SIZES["remarkable"]!;
  const isLandscape = layoutConfig.orientation === "landscape";
  const scaledWidth = pageSize.width * (layoutConfig.pageSize === "remarkable" ? REMARKABLE_SCALE : 1);
  const scaledHeight = pageSize.height * (layoutConfig.pageSize === "remarkable" ? REMARKABLE_SCALE : 1);

  // Calculate grid cell dimensions (in points)
  const pageMargin = 20;
  const contentWidth = (isLandscape ? scaledHeight : scaledWidth) - (pageMargin * 2);
  const contentHeight = (isLandscape ? scaledWidth : scaledHeight) - (pageMargin * 2);
  const cellWidth = contentWidth / layoutConfig.gridColumns;
  const cellHeight = contentHeight / layoutConfig.gridRows;

  // Build content for each widget
  const content: Content[] = [];

  // Sort widgets by position (top to bottom, left to right)
  const sortedWidgets = [...layoutConfig.widgets].sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });

  // Render each widget
  for (const widget of sortedWidgets) {
    const widgetWidth = widget.width * cellWidth;
    const widgetHeight = widget.height * cellHeight;
    const widgetContent = renderWidget(widget, options, widgetWidth, widgetHeight);
    content.push(widgetContent);
  }

  // Create document definition
  const docDefinition: TDocumentDefinitions = {
    pageSize: isLandscape
      ? { width: scaledHeight, height: scaledWidth }
      : { width: scaledWidth, height: scaledHeight },
    pageMargins: [pageMargin, pageMargin, pageMargin, pageMargin],
    content,
    defaultStyle: {
      font: "Roboto",
    },
  };

  // Generate PDF
  return new Promise((resolve, reject) => {
    try {
      const pdfDoc = PdfMake.createPdf(docDefinition);
      pdfDoc.getBuffer((buffer: Buffer) => {
        const filename = `planner-${format(options.date, "yyyy-MM-dd")}.pdf`;
        resolve({ buffer, filename });
      });
    } catch (error) {
      reject(error);
    }
  });
}
