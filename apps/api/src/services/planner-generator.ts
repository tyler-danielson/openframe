/**
 * Planner PDF Generator Service
 * Generates PDF documents from widget-based planner layouts using PDFKit.
 * Supports both grid-based and column-based layouts.
 */

import { format, startOfWeek, addDays, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from "date-fns";
import { createRequire } from "module";
import type { PlannerLayoutConfig, PlannerWidgetInstance, ColumnLayout, LayoutSection, LayoutChild } from "@openframe/shared";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require("pdfkit");

// Page sizes in PDF points (72 DPI)
const PAGE_SIZES: Record<string, { width: number; height: number }> = {
  remarkable: { width: 561, height: 749 },  // reMarkable 2 scaled to PDF
  remarkable2: { width: 561, height: 749 },
  letter: { width: 612, height: 792 },
  a4: { width: 595, height: 842 },
};

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
  attendees?: Array<{ email: string; name?: string; responseStatus?: string; organizer?: boolean }>;
}

export interface TaskItem {
  id: string;
  title: string;
  dueDate?: Date;
  completed: boolean;
  notes?: string;
  taskListName?: string;
}

export interface NewsItem {
  id: string;
  title: string;
  source?: string;
  publishedAt?: Date;
  description?: string;
  link?: string;
  author?: string;
}

export interface EmailHighlight {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  receivedAt: string;
  isUnread: boolean;
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
  timezone?: string;
  emailHighlights?: EmailHighlight[];
  aiBriefing?: { summary: string; highlights: string[]; generatedAt: string };
}

// ─── Detail Page System ────────────────────────────────────────

interface DetailPageEntry {
  widgetType: string;
  widgetId: string;
  destinationName: string;
  title: string;
}

class DetailPageCollector {
  entries: DetailPageEntry[] = [];

  register(widgetType: string, widgetId: string, title: string) {
    const destinationName = `detail-${widgetType}-${widgetId}`;
    this.entries.push({ widgetType, widgetId, destinationName, title });
    return destinationName;
  }
}

/** A rectangular region within the PDF for rendering a widget */
interface RenderRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ─── Template Text Processing ───────────────────────────────────

function processTemplateText(text: string, date: Date, timezone?: string): string {
  return text.replace(/\{\{date(?::([^}]+))?\}\}/g, (_match, formatStr) => {
    let safeFormat = formatStr || "MMMM d, yyyy";
    safeFormat = safeFormat
      .replace(/\bdddd\b/g, "EEEE")  // Full day name (Monday)
      .replace(/\bddd\b/g, "EEE")    // Short day name (Mon)
      .replace(/\bDD\b/g, "dd")      // Zero-padded day of month
      .replace(/\bD\b/g, "d")        // Day of month
      .replace(/\bYYYY\b/g, "yyyy")  // Full year
      .replace(/\bYY\b/g, "yy")      // Short year
      .replace(/\bWW\b/g, "II")      // ISO week number zero-padded
      .replace(/\bW\b/g, "'W'")      // Literal W
      .replace(/\bw\b/g, "I");       // ISO week number
    return formatInTz(date, safeFormat, timezone);
  });
}

function getFontSize(preset: string): number {
  const sizes: Record<string, number> = { sm: 8, base: 10, md: 10, lg: 12, xl: 16, "2xl": 20 };
  return sizes[preset] || 10;
}

/** Format a date/time respecting the user's timezone */
function formatInTz(date: Date, formatStr: string, timezone?: string): string {
  if (!timezone) return format(date, formatStr);
  // Use Intl to get timezone-aware formatting, then use date-fns for the pattern
  // Create a new Date adjusted to the target timezone
  const tzDate = new Date(date.toLocaleString("en-US", { timeZone: timezone }));
  return format(tzDate, formatStr);
}

function formatTime(date: Date, timezone?: string): string {
  return formatInTz(date, "h:mm a", timezone);
}

function getHourInTz(date: Date, timezone?: string): number {
  if (!timezone) return date.getHours();
  const tzDate = new Date(date.toLocaleString("en-US", { timeZone: timezone }));
  return tzDate.getHours();
}

// ─── PDFKit Widget Renderers ────────────────────────────────────
// Each renderer draws directly into the doc within the given rect.

function renderCalendarDay(
  doc: InstanceType<typeof PDFDocument>,
  rect: RenderRect,
  widget: PlannerWidgetInstance,
  opts: PlannerGeneratorOptions
) {
  const config = widget.config as Record<string, unknown>;
  const title = (config.title as string) || "Schedule";
  const startHour = (config.startHour as number) ?? 7;
  const endHour = (config.endHour as number) ?? 21;
  const pad = 4;
  let y = rect.y + pad;

  // Title
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#000000");
  doc.text(title, rect.x + pad, y, { width: rect.width - pad * 2 });
  y = doc.y + 4;

  // Time slots
  const slotHeight = Math.max(12, (rect.height - (y - rect.y) - pad) / (endHour - startHour));
  doc.font("Helvetica").fontSize(7).fillColor("#666666");

  const tz = opts.timezone;
  const dayEvents = opts.events.filter((e) => {
    const d = new Date(e.startTime);
    const dateStr = formatInTz(d, "yyyy-MM-dd", tz);
    const targetStr = formatInTz(opts.date, "yyyy-MM-dd", tz);
    return dateStr === targetStr && !e.isAllDay;
  });

  const AVAILABILITY_TITLES = new Set(["busy", "free", "tentative", "focus time", "working elsewhere", "out of office", "away"]);
  const totalMinutes = (endHour - startHour) * 60;
  const pxPerMinute = (rect.height - (y - rect.y) - pad) / totalMinutes;
  const labelWidth = 38;
  const eventX = rect.x + pad + labelWidth + 2;
  const eventWidth = rect.width - pad * 2 - labelWidth - 4;

  // Draw hour grid lines and labels
  for (let h = startHour; h < endHour; h++) {
    const slotY = y + (h - startHour) * 60 * pxPerMinute;
    if (slotY > rect.y + rect.height) break;

    const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    const ampm = h >= 12 ? "PM" : "AM";
    doc.fillColor("#999999").fontSize(7).font("Helvetica");
    doc.text(`${hour} ${ampm}`, rect.x + pad, slotY + 1, { width: labelWidth });

    doc.moveTo(rect.x + pad + labelWidth, slotY).lineTo(rect.x + rect.width - pad, slotY)
      .lineWidth(0.3).strokeColor("#dddddd").stroke();
  }

  // Filter out generic availability, keep named events
  const namedEvents = dayEvents.filter(e => !AVAILABILITY_TITLES.has(e.title.toLowerCase()));
  const eventsToRender = namedEvents.length > 0 ? namedEvents : dayEvents;

  // Place events at their exact minute position
  for (const ev of eventsToRender) {
    const startDate = new Date(ev.startTime);
    const tzStr = formatInTz(startDate, "HH:mm", tz);
    const [hStr, mStr] = tzStr.split(":");
    const eventHour = parseInt(hStr!, 10);
    const eventMin = parseInt(mStr!, 10);
    const minutesFromStart = (eventHour - startHour) * 60 + eventMin;

    if (minutesFromStart < 0 || minutesFromStart >= totalMinutes) continue;

    const eventY = y + minutesFromStart * pxPerMinute;
    if (eventY < rect.y || eventY + 8 > rect.y + rect.height) continue;

    // Event time in the sidebar
    doc.font("Helvetica").fontSize(6).fillColor("#666666");
    doc.text(formatTime(startDate, tz), rect.x + pad, eventY + 1, { width: labelWidth });

    // Event title
    doc.font("Helvetica-Bold").fontSize(7).fillColor("#333333");
    doc.text(ev.title, eventX, eventY + 1, { width: eventWidth, lineBreak: false });
  }
}

function renderCalendarWeek(
  doc: InstanceType<typeof PDFDocument>,
  rect: RenderRect,
  widget: PlannerWidgetInstance,
  opts: PlannerGeneratorOptions
) {
  const config = widget.config as Record<string, unknown>;
  const weekStartsOn = (config.weekStartsOn as number) || 0;
  const weekStart = startOfWeek(opts.date, { weekStartsOn: weekStartsOn as 0 | 1 | 6 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const pad = 4;
  const colWidth = (rect.width - pad * 2) / 7;
  let y = rect.y + pad;

  // Day name headers
  doc.font("Helvetica-Bold").fontSize(7).fillColor("#333333");
  days.forEach((day, i) => {
    doc.text(format(day, "EEE"), rect.x + pad + i * colWidth, y, { width: colWidth, align: "center" });
  });
  y += 12;

  // Date numbers
  doc.font("Helvetica").fontSize(7).fillColor("#666666");
  days.forEach((day, i) => {
    doc.text(format(day, "d"), rect.x + pad + i * colWidth, y, { width: colWidth, align: "center" });
  });
  y += 12;

  // Events per day
  const tz = opts.timezone;
  doc.fontSize(6).fillColor("#333333").font("Helvetica");
  const maxEventRows = Math.floor((rect.height - (y - rect.y) - pad) / 9);
  days.forEach((day, i) => {
    const dayStr = formatInTz(day, "yyyy-MM-dd", tz);
    const dayEvents = opts.events.filter((e) => formatInTz(new Date(e.startTime), "yyyy-MM-dd", tz) === dayStr);
    dayEvents.slice(0, maxEventRows).forEach((ev, j) => {
      const label = ev.isAllDay ? ev.title : `${formatTime(new Date(ev.startTime), tz)} ${ev.title}`;
      doc.text(label, rect.x + pad + i * colWidth + 1, y + j * 9, { width: colWidth - 2, lineBreak: false });
    });
  });

  // Column separators
  for (let i = 1; i < 7; i++) {
    const x = rect.x + pad + i * colWidth;
    doc.moveTo(x, rect.y + pad).lineTo(x, rect.y + rect.height - pad)
      .lineWidth(0.3).strokeColor("#dddddd").stroke();
  }
}

function renderCalendarMonth(
  doc: InstanceType<typeof PDFDocument>,
  rect: RenderRect,
  widget: PlannerWidgetInstance,
  opts: PlannerGeneratorOptions
) {
  const pad = 4;
  const monthStart = startOfMonth(opts.date);
  const monthEnd = endOfMonth(opts.date);
  const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const colWidth = (rect.width - pad * 2) / 7;
  let y = rect.y + pad;

  // Month title
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#000000");
  doc.text(format(opts.date, "MMMM yyyy"), rect.x + pad, y, { width: rect.width - pad * 2, align: "center" });
  y += 16;

  // Day name headers
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  doc.font("Helvetica-Bold").fontSize(7).fillColor("#666666");
  dayNames.forEach((name, i) => {
    doc.text(name, rect.x + pad + i * colWidth, y, { width: colWidth, align: "center" });
  });
  y += 12;

  // Calendar grid
  const rowHeight = Math.min(18, (rect.height - (y - rect.y) - pad) / 6);
  const firstDayOfWeek = getDay(monthStart);
  let col = firstDayOfWeek;
  let row = 0;

  doc.font("Helvetica").fontSize(8).fillColor("#333333");
  allDays.forEach((day) => {
    const dayStr = formatInTz(day, "yyyy-MM-dd", opts.timezone);
    const hasEvents = opts.events.some((e) => formatInTz(new Date(e.startTime), "yyyy-MM-dd", opts.timezone) === dayStr);
    const cx = rect.x + pad + col * colWidth;
    const cy = y + row * rowHeight;
    const dayText = format(day, "d") + (hasEvents ? " •" : "");
    doc.text(dayText, cx, cy, { width: colWidth, align: "center" });
    col++;
    if (col === 7) { col = 0; row++; }
  });
}

function renderTasks(
  doc: InstanceType<typeof PDFDocument>,
  rect: RenderRect,
  widget: PlannerWidgetInstance,
  opts: PlannerGeneratorOptions
) {
  const config = widget.config as Record<string, unknown>;
  const title = (config.title as string) || "Tasks";
  const maxItems = (config.maxItems as number) || 10;
  const showCheckboxes = config.showCheckboxes !== false;
  const showDueDate = config.showDueDate !== false;
  const pad = 4;
  let y = rect.y + pad;

  doc.font("Helvetica-Bold").fontSize(10).fillColor("#000000");
  doc.text(title, rect.x + pad, y, { width: rect.width - pad * 2 });
  y = doc.y + 4;

  const tasks = opts.tasks.filter((t) => !t.completed).slice(0, maxItems);
  doc.font("Helvetica").fontSize(8).fillColor("#333333");

  if (tasks.length === 0) {
    // Empty task lines for manual writing
    for (let i = 0; i < maxItems && y + 14 < rect.y + rect.height; i++) {
      if (showCheckboxes) {
        doc.rect(rect.x + pad, y + 2, 7, 7).lineWidth(0.5).strokeColor("#999999").stroke();
      }
      doc.moveTo(rect.x + pad + (showCheckboxes ? 12 : 0), y + 10)
        .lineTo(rect.x + rect.width - pad, y + 10)
        .lineWidth(0.3).strokeColor("#dddddd").stroke();
      y += 14;
    }
  } else {
    tasks.forEach((task) => {
      if (y + 12 > rect.y + rect.height) return;
      const textX = showCheckboxes ? rect.x + pad + 12 : rect.x + pad;
      if (showCheckboxes) {
        doc.rect(rect.x + pad, y + 1, 7, 7).lineWidth(0.5).strokeColor("#666666").stroke();
      }
      const due = showDueDate && task.dueDate ? ` (${format(new Date(task.dueDate), "MMM d")})` : "";
      doc.fillColor("#333333").text(task.title + due, textX, y, { width: rect.width - pad * 2 - (showCheckboxes ? 14 : 0) });
      y = doc.y + 2;
    });
  }
}

function renderNews(
  doc: InstanceType<typeof PDFDocument>,
  rect: RenderRect,
  widget: PlannerWidgetInstance,
  opts: PlannerGeneratorOptions
) {
  const config = widget.config as Record<string, unknown>;
  const title = (config.title as string) || "Headlines";
  const maxItems = (config.maxItems as number) || 5;
  const showSource = config.showSource !== false;
  const pad = 4;
  let y = rect.y + pad;

  doc.font("Helvetica-Bold").fontSize(10).fillColor("#000000");
  doc.text(title, rect.x + pad, y, { width: rect.width - pad * 2 });
  y = doc.y + 4;

  const news = opts.news.slice(0, maxItems);
  if (news.length === 0) {
    doc.font("Helvetica").fontSize(8).fillColor("#999999");
    doc.text("No headlines available", rect.x + pad, y, { width: rect.width - pad * 2 });
  } else {
    news.forEach((item) => {
      if (y + 10 > rect.y + rect.height) return;
      doc.font("Helvetica").fontSize(8).fillColor("#333333");
      doc.text("• " + item.title, rect.x + pad, y, { width: rect.width - pad * 2 });
      y = doc.y;
      if (showSource && item.source) {
        doc.font("Helvetica").fontSize(6).fillColor("#999999");
        doc.text(`  — ${item.source}`, rect.x + pad, y, { width: rect.width - pad * 2 });
        y = doc.y;
      }
      y += 2;
    });
  }
}

function renderWeather(
  doc: InstanceType<typeof PDFDocument>,
  rect: RenderRect,
  widget: PlannerWidgetInstance,
  opts: PlannerGeneratorOptions
) {
  const pad = 4;
  let y = rect.y + pad;

  if (!opts.weather) {
    doc.font("Helvetica").fontSize(8).fillColor("#999999");
    doc.text("Weather unavailable", rect.x + pad, y, { width: rect.width - pad * 2 });
    return;
  }

  doc.font("Helvetica-Bold").fontSize(18).fillColor("#000000");
  doc.text(`${Math.round(opts.weather.current.temp)}°`, rect.x + pad, y);
  y = doc.y;
  doc.font("Helvetica").fontSize(8).fillColor("#666666");
  doc.text(opts.weather.current.description, rect.x + pad, y);
  y = doc.y + 4;

  if (opts.weather.forecast.length > 0) {
    const today = opts.weather.forecast[0]!;
    doc.fontSize(7).fillColor("#999999");
    doc.text(`H: ${Math.round(today.high)}°  L: ${Math.round(today.low)}°`, rect.x + pad, y);
  }
}

function renderNotes(
  doc: InstanceType<typeof PDFDocument>,
  rect: RenderRect,
  widget: PlannerWidgetInstance,
) {
  const config = widget.config as Record<string, unknown>;
  const title = (config.title as string) || "Notes";
  const lineSpacing = (config.lineSpacing as number) || 18;
  const lineStyle = (config.lineStyle as string) || "ruled";
  const showTitle = config.showTitle !== false;
  const pad = 4;
  let y = rect.y + pad;

  if (showTitle) {
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#000000");
    doc.text(title, rect.x + pad, y, { width: rect.width - pad * 2 });
    y = doc.y + 4;
  }

  // Draw lines
  const endY = rect.y + rect.height - pad;
  while (y + lineSpacing <= endY) {
    y += lineSpacing;
    if (lineStyle === "dotted") {
      doc.moveTo(rect.x + pad, y).lineTo(rect.x + rect.width - pad, y)
        .lineWidth(0.3).strokeColor("#cccccc").dash(1, { space: 3 }).stroke().undash();
    } else if (lineStyle === "dashed") {
      doc.moveTo(rect.x + pad, y).lineTo(rect.x + rect.width - pad, y)
        .lineWidth(0.3).strokeColor("#cccccc").dash(4, { space: 2 }).stroke().undash();
    } else if (lineStyle !== "blank") {
      doc.moveTo(rect.x + pad, y).lineTo(rect.x + rect.width - pad, y)
        .lineWidth(0.3).strokeColor("#cccccc").stroke();
    }
  }
}

function renderText(
  doc: InstanceType<typeof PDFDocument>,
  rect: RenderRect,
  widget: PlannerWidgetInstance,
  opts: PlannerGeneratorOptions
) {
  const config = widget.config as Record<string, unknown>;
  const rawText = (config.text as string) || "";
  const text = processTemplateText(rawText, opts.date, opts.timezone);
  const fontSize = getFontSize((config.fontSize as string) || "md");
  const fontWeight = (config.fontWeight as string) || "normal";
  const alignment = (config.alignment as string) || (config.textAlign as string) || "left";
  const pad = 4;

  const font = fontWeight === "bold" || fontWeight === "semibold" ? "Helvetica-Bold" : "Helvetica";
  doc.font(font).fontSize(fontSize).fillColor("#000000");
  doc.text(text, rect.x + pad, rect.y + pad, {
    width: rect.width - pad * 2,
    align: alignment as "left" | "center" | "right",
  });
}

function renderDivider(
  doc: InstanceType<typeof PDFDocument>,
  rect: RenderRect,
  widget: PlannerWidgetInstance,
) {
  const config = widget.config as Record<string, unknown>;
  const style = (config.style as string) || "solid";
  const isHorizontal = config.orientation !== "vertical";

  if (isHorizontal) {
    const midY = rect.y + rect.height / 2;
    const line = doc.moveTo(rect.x + 4, midY).lineTo(rect.x + rect.width - 4, midY);
    if (style === "dashed") line.dash(4, { space: 2 });
    if (style === "dotted") line.dash(1, { space: 2 });
    line.lineWidth(0.5).strokeColor("#cccccc").stroke();
    if (style !== "solid") doc.undash();
  } else {
    const midX = rect.x + rect.width / 2;
    const line = doc.moveTo(midX, rect.y + 4).lineTo(midX, rect.y + rect.height - 4);
    if (style === "dashed") line.dash(4, { space: 2 });
    if (style === "dotted") line.dash(1, { space: 2 });
    line.lineWidth(0.5).strokeColor("#cccccc").stroke();
    if (style !== "solid") doc.undash();
  }
}

function renderHabits(
  doc: InstanceType<typeof PDFDocument>,
  rect: RenderRect,
  widget: PlannerWidgetInstance,
  opts: PlannerGeneratorOptions
) {
  const config = widget.config as Record<string, unknown>;
  const title = (config.title as string) || "Habits";
  const habits = (config.habits as string[]) || opts.habits || ["Habit 1", "Habit 2", "Habit 3"];
  const pad = 4;
  let y = rect.y + pad;

  doc.font("Helvetica-Bold").fontSize(10).fillColor("#000000");
  doc.text(title, rect.x + pad, y, { width: rect.width - pad * 2 });
  y = doc.y + 6;

  // Draw habit rows with checkbox circles
  const rowHeight = 14;
  const labelWidth = Math.min(rect.width * 0.4, 100);
  const circleR = 4;
  const daysToShow = 7;
  const circleSpacing = Math.min(20, (rect.width - pad * 2 - labelWidth) / daysToShow);

  // Day headers
  const weekStart = startOfWeek(opts.date);
  doc.font("Helvetica").fontSize(6).fillColor("#999999");
  for (let d = 0; d < daysToShow; d++) {
    const day = addDays(weekStart, d);
    doc.text(format(day, "EEE"), rect.x + pad + labelWidth + d * circleSpacing, y, { width: circleSpacing, align: "center" });
  }
  y += 10;

  // Habit rows
  habits.forEach((habit) => {
    if (y + rowHeight > rect.y + rect.height) return;
    doc.font("Helvetica").fontSize(8).fillColor("#333333");
    doc.text(habit, rect.x + pad, y + 2, { width: labelWidth - 4 });
    for (let d = 0; d < daysToShow; d++) {
      const cx = rect.x + pad + labelWidth + d * circleSpacing + circleSpacing / 2;
      doc.circle(cx, y + rowHeight / 2, circleR).lineWidth(0.5).strokeColor("#999999").stroke();
    }
    y += rowHeight;
  });
}

// ─── Detail Page Helpers ────────────────────────────────────────

function drawSectionHeader(doc: InstanceType<typeof PDFDocument>, title: string, y: number, width: number, margin: number): number {
  doc.font("Helvetica-Bold").fontSize(14).fillColor("#000000");
  doc.text(title, margin, y, { width });
  const newY = doc.y + 4;
  doc.moveTo(margin, newY).lineTo(margin + width, newY).lineWidth(0.5).strokeColor("#333333").stroke();
  return newY + 8;
}

function drawSubHeader(doc: InstanceType<typeof PDFDocument>, text: string, y: number, width: number, margin: number): number {
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#444444");
  doc.text(text, margin, y, { width });
  return doc.y + 3;
}

function drawTextBlock(doc: InstanceType<typeof PDFDocument>, text: string, x: number, y: number, width: number, fontSize: number = 8): number {
  doc.font("Helvetica").fontSize(fontSize).fillColor("#333333");
  doc.text(text, x, y, { width, lineGap: 2 });
  return doc.y + 4;
}

function checkPageBreak(doc: InstanceType<typeof PDFDocument>, currentY: number, needed: number, pageHeight: number, margin: number): number {
  if (currentY + needed > pageHeight - margin) {
    doc.addPage();
    return margin;
  }
  return currentY;
}

function drawBackLink(doc: InstanceType<typeof PDFDocument>, x: number, y: number, width: number): number {
  doc.font("Helvetica").fontSize(7).fillColor("#666666");
  doc.text("< Back to overview", x, y, { width });
  // Create goTo annotation over the text
  const linkWidth = 80;
  doc.goTo(x, y - 2, linkWidth, 12, "front-page");
  return doc.y + 4;
}

// ─── Detail Page Renderers ─────────────────────────────────────

type DetailRenderer = (
  doc: InstanceType<typeof PDFDocument>,
  y: number,
  width: number,
  margin: number,
  pageHeight: number,
  opts: PlannerGeneratorOptions,
  widgetConfig: Record<string, unknown>
) => number;

function renderCalendarDayDetail(
  doc: InstanceType<typeof PDFDocument>, y: number, width: number, margin: number,
  pageHeight: number, opts: PlannerGeneratorOptions
): number {
  const tz = opts.timezone;
  const dayEvents = opts.events.filter(e => {
    const dateStr = formatInTz(new Date(e.startTime), "yyyy-MM-dd", tz);
    const targetStr = formatInTz(opts.date, "yyyy-MM-dd", tz);
    return dateStr === targetStr;
  }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  if (dayEvents.length === 0) {
    y = drawTextBlock(doc, "No events scheduled for today.", margin, y, width);
    return y;
  }

  // All-day events first
  const allDay = dayEvents.filter(e => e.isAllDay);
  const timed = dayEvents.filter(e => !e.isAllDay);

  if (allDay.length > 0) {
    y = checkPageBreak(doc, y, 30, pageHeight, margin);
    y = drawSubHeader(doc, "All Day", y, width, margin);
    for (const event of allDay) {
      y = checkPageBreak(doc, y, 40, pageHeight, margin);
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#000000");
      doc.text(event.title, margin + 4, y, { width: width - 8 });
      y = doc.y + 2;
      if (event.location) {
        y = drawTextBlock(doc, `Location: ${event.location}`, margin + 4, y, width - 8, 7);
      }
      if (event.description) {
        y = drawTextBlock(doc, event.description, margin + 4, y, width - 8, 7);
      }
      y += 4;
    }
  }

  for (const event of timed) {
    y = checkPageBreak(doc, y, 50, pageHeight, margin);
    const timeStr = `${formatTime(new Date(event.startTime), tz)} - ${formatTime(new Date(event.endTime), tz)}`;
    doc.font("Helvetica").fontSize(7).fillColor("#666666");
    doc.text(timeStr, margin + 4, y, { width: width - 8 });
    y = doc.y + 1;
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#000000");
    doc.text(event.title, margin + 4, y, { width: width - 8 });
    y = doc.y + 2;
    if (event.location) {
      y = drawTextBlock(doc, `Location: ${event.location}`, margin + 4, y, width - 8, 7);
    }
    if (event.description) {
      y = drawTextBlock(doc, event.description, margin + 4, y, width - 8, 7);
    }
    if (event.attendees && event.attendees.length > 0) {
      const attendeeStr = event.attendees
        .map(a => `${a.name || a.email}${a.responseStatus ? ` (${a.responseStatus})` : ""}`)
        .join(", ");
      y = drawTextBlock(doc, `Attendees: ${attendeeStr}`, margin + 4, y, width - 8, 7);
    }
    y += 4;
    // Separator
    doc.moveTo(margin + 4, y).lineTo(margin + width - 4, y).lineWidth(0.2).strokeColor("#dddddd").stroke();
    y += 4;
  }

  return y;
}

function renderTasksDetail(
  doc: InstanceType<typeof PDFDocument>, y: number, width: number, margin: number,
  pageHeight: number, opts: PlannerGeneratorOptions
): number {
  if (opts.tasks.length === 0) {
    y = drawTextBlock(doc, "No tasks due today.", margin, y, width);
    return y;
  }

  // Group by task list
  const byList = new Map<string, typeof opts.tasks>();
  for (const task of opts.tasks) {
    const listName = task.taskListName || "Tasks";
    if (!byList.has(listName)) byList.set(listName, []);
    byList.get(listName)!.push(task);
  }

  for (const [listName, listTasks] of byList) {
    y = checkPageBreak(doc, y, 30, pageHeight, margin);
    if (byList.size > 1) {
      y = drawSubHeader(doc, listName, y, width, margin);
    }
    for (const task of listTasks) {
      y = checkPageBreak(doc, y, 30, pageHeight, margin);
      // Checkbox + title
      doc.rect(margin + 4, y + 1, 7, 7).lineWidth(0.5).strokeColor("#666666").stroke();
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#000000");
      doc.text(task.title, margin + 16, y, { width: width - 20 });
      y = doc.y + 1;
      if (task.dueDate) {
        doc.font("Helvetica").fontSize(7).fillColor("#888888");
        doc.text(`Due: ${format(new Date(task.dueDate), "MMM d, yyyy")}`, margin + 16, y, { width: width - 20 });
        y = doc.y + 1;
      }
      if (task.notes) {
        y = drawTextBlock(doc, task.notes, margin + 16, y, width - 20, 7);
      }
      y += 4;
    }
  }

  return y;
}

function renderNewsDetail(
  doc: InstanceType<typeof PDFDocument>, y: number, width: number, margin: number,
  pageHeight: number, opts: PlannerGeneratorOptions
): number {
  if (opts.news.length === 0) {
    y = drawTextBlock(doc, "No headlines available.", margin, y, width);
    return y;
  }

  for (const item of opts.news) {
    y = checkPageBreak(doc, y, 40, pageHeight, margin);
    // Title
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#000000");
    doc.text(item.title, margin + 4, y, { width: width - 8 });
    y = doc.y + 1;
    // Source + author + date
    const meta: string[] = [];
    if (item.source) meta.push(item.source);
    if (item.author) meta.push(item.author);
    if (item.publishedAt) meta.push(format(new Date(item.publishedAt), "MMM d, h:mm a"));
    if (meta.length > 0) {
      doc.font("Helvetica").fontSize(7).fillColor("#888888");
      doc.text(meta.join(" · "), margin + 4, y, { width: width - 8 });
      y = doc.y + 2;
    }
    // Description
    if (item.description) {
      y = drawTextBlock(doc, item.description, margin + 4, y, width - 8, 8);
    }
    y += 2;
    // Separator
    doc.moveTo(margin + 4, y).lineTo(margin + width - 4, y).lineWidth(0.2).strokeColor("#dddddd").stroke();
    y += 6;
  }

  return y;
}

function renderWeatherDetail(
  doc: InstanceType<typeof PDFDocument>, y: number, width: number, margin: number,
  pageHeight: number, opts: PlannerGeneratorOptions
): number {
  if (!opts.weather) {
    y = drawTextBlock(doc, "Weather data unavailable.", margin, y, width);
    return y;
  }

  // Current conditions
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#000000");
  doc.text(`${opts.weather.current.temp}° — ${opts.weather.current.description}`, margin + 4, y, { width: width - 8 });
  y = doc.y + 8;

  // Forecast
  if (opts.weather.forecast.length > 0) {
    y = drawSubHeader(doc, "5-Day Forecast", y, width, margin);
    for (const day of opts.weather.forecast) {
      y = checkPageBreak(doc, y, 16, pageHeight, margin);
      const dayStr = format(new Date(day.date), "EEE, MMM d");
      doc.font("Helvetica").fontSize(8).fillColor("#333333");
      doc.text(`${dayStr}:  High ${Math.round(day.high)}° / Low ${Math.round(day.low)}°`, margin + 4, y, { width: width - 8 });
      y = doc.y + 3;
    }
  }

  return y;
}

function renderEmailDetail(
  doc: InstanceType<typeof PDFDocument>, y: number, width: number, margin: number,
  pageHeight: number, opts: PlannerGeneratorOptions
): number {
  if (!opts.emailHighlights || opts.emailHighlights.length === 0) {
    y = drawTextBlock(doc, "No email highlights.", margin, y, width);
    return y;
  }

  for (const email of opts.emailHighlights) {
    y = checkPageBreak(doc, y, 40, pageHeight, margin);
    // From + time
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#000000");
    doc.text(email.from, margin + 4, y, { width: width - 80 });
    doc.font("Helvetica").fontSize(7).fillColor("#888888");
    doc.text(email.receivedAt ? format(new Date(email.receivedAt), "h:mm a") : "", margin + width - 76, y, { width: 72, align: "right" });
    y = Math.max(doc.y, y + 10) + 1;
    // Subject
    doc.font("Helvetica").fontSize(8).fillColor("#333333");
    doc.text(email.subject, margin + 4, y, { width: width - 8 });
    y = doc.y + 2;
    // Snippet
    if (email.snippet) {
      y = drawTextBlock(doc, email.snippet, margin + 4, y, width - 8, 7);
    }
    y += 2;
    doc.moveTo(margin + 4, y).lineTo(margin + width - 4, y).lineWidth(0.2).strokeColor("#dddddd").stroke();
    y += 6;
  }

  return y;
}

function renderAiBriefingDetail(
  doc: InstanceType<typeof PDFDocument>, y: number, width: number, margin: number,
  pageHeight: number, opts: PlannerGeneratorOptions
): number {
  if (!opts.aiBriefing) {
    y = drawTextBlock(doc, "AI briefing not available.", margin, y, width);
    return y;
  }

  // Summary paragraph
  y = drawTextBlock(doc, opts.aiBriefing.summary, margin + 4, y, width - 8, 9);
  y += 4;

  // Highlights
  if (opts.aiBriefing.highlights.length > 0) {
    y = drawSubHeader(doc, "Highlights", y, width, margin);
    for (const h of opts.aiBriefing.highlights) {
      y = checkPageBreak(doc, y, 20, pageHeight, margin);
      doc.font("Helvetica").fontSize(8).fillColor("#333333");
      doc.text(`•  ${h}`, margin + 8, y, { width: width - 16, lineGap: 2 });
      y = doc.y + 3;
    }
  }

  return y;
}

const DETAIL_RENDERERS: Partial<Record<string, DetailRenderer>> = {
  "calendar-day": renderCalendarDayDetail,
  "calendar-week": renderCalendarDayDetail, // same detail view for week (shows day's events)
  "tasks": renderTasksDetail,
  "news-headlines": renderNewsDetail,
  "weather": renderWeatherDetail,
  "email-highlights": renderEmailDetail,
  "ai-briefing": renderAiBriefingDetail,
};

const DETAIL_TITLES: Record<string, string> = {
  "calendar-day": "Schedule Details",
  "calendar-week": "Week Schedule Details",
  "tasks": "Task Details",
  "news-headlines": "Headlines",
  "weather": "Weather Forecast",
  "email-highlights": "Email Highlights",
  "ai-briefing": "AI Briefing",
};

function renderDetailPages(
  doc: InstanceType<typeof PDFDocument>,
  entries: DetailPageEntry[],
  opts: PlannerGeneratorOptions,
  pageWidth: number,
  pageHeight: number,
  margin: number
) {
  doc.addPage({ size: [pageWidth, pageHeight], margins: { top: margin, bottom: margin, left: margin, right: margin } });
  const width = pageWidth - margin * 2;
  let y = margin;

  // Back link at top of first detail page
  y = drawBackLink(doc, margin, y, width);
  y += 4;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    const renderer = DETAIL_RENDERERS[entry.widgetType];
    if (!renderer) continue;

    // Check if we need a new page for this section header
    y = checkPageBreak(doc, y, 60, pageHeight, margin);
    if (y === margin) {
      // We just added a new page, add back link
      y = drawBackLink(doc, margin, y, width);
      y += 4;
    }

    // Place the named destination for this section
    doc.addNamedDestination(entry.destinationName);

    // Section header
    y = drawSectionHeader(doc, entry.title, y, width, margin);

    // Render the detail content
    y = renderer(doc, y, width, margin, pageHeight, opts, {});

    // Space between sections
    y += 12;
  }
}

// ─── Widget Dispatch ────────────────────────────────────────────

function renderWidget(
  doc: InstanceType<typeof PDFDocument>,
  rect: RenderRect,
  widget: PlannerWidgetInstance,
  opts: PlannerGeneratorOptions,
  collector?: DetailPageCollector
) {
  // Draw cell border
  doc.rect(rect.x, rect.y, rect.width, rect.height)
    .lineWidth(0.3).strokeColor("#e0e0e0").stroke();

  // Save/restore state to clip content
  doc.save();
  doc.rect(rect.x, rect.y, rect.width, rect.height).clip();

  switch (widget.type) {
    case "calendar-day": renderCalendarDay(doc, rect, widget, opts); break;
    case "calendar-week": renderCalendarWeek(doc, rect, widget, opts); break;
    case "calendar-month": renderCalendarMonth(doc, rect, widget, opts); break;
    case "tasks": renderTasks(doc, rect, widget, opts); break;
    case "news-headlines": renderNews(doc, rect, widget, opts); break;
    case "weather": renderWeather(doc, rect, widget, opts); break;
    case "notes": renderNotes(doc, rect, widget); break;
    case "text": renderText(doc, rect, widget, opts); break;
    case "divider": renderDivider(doc, rect, widget); break;
    case "habits": renderHabits(doc, rect, widget, opts); break;
    default:
      doc.font("Helvetica").fontSize(8).fillColor("#999999");
      doc.text(`[${widget.type}]`, rect.x + 4, rect.y + 4, { width: rect.width - 8 });
  }

  doc.restore();

  // Register detail page link annotation if collector is active
  if (collector && DETAIL_RENDERERS[widget.type]) {
    const title = DETAIL_TITLES[widget.type] || widget.type;
    const destName = collector.register(widget.type, widget.id, title);
    // Make the widget's title area a clickable link to the detail page
    doc.goTo(rect.x, rect.y, rect.width, Math.min(rect.height, 20), destName);
  }
}

// ─── Column Layout Renderer ─────────────────────────────────────

function renderSection(
  doc: InstanceType<typeof PDFDocument>,
  section: LayoutSection,
  rect: RenderRect,
  widgets: PlannerWidgetInstance[],
  opts: PlannerGeneratorOptions,
  collector?: DetailPageCollector
) {
  const totalFlex = section.children.reduce((sum, c) => sum + c.flex, 0);

  let offset = 0;
  for (const child of section.children) {
    const ratio = child.flex / totalFlex;
    let childRect: RenderRect;

    if (section.direction === "horizontal") {
      const w = rect.width * ratio;
      childRect = { x: rect.x + offset, y: rect.y, width: w, height: rect.height };
      offset += w;
    } else {
      const h = rect.height * ratio;
      childRect = { x: rect.x, y: rect.y + offset, width: rect.width, height: h };
      offset += h;
    }

    renderChild(doc, child, childRect, widgets, opts, collector);
  }
}

function renderChild(
  doc: InstanceType<typeof PDFDocument>,
  child: LayoutChild,
  rect: RenderRect,
  widgets: PlannerWidgetInstance[],
  opts: PlannerGeneratorOptions,
  collector?: DetailPageCollector
) {
  if (child.type === "section" && child.section) {
    renderSection(doc, child.section, rect, widgets, opts, collector);
  } else if (child.type === "widget" && child.widgetId) {
    const widget = widgets.find((w) => w.id === child.widgetId);
    if (widget) {
      renderWidget(doc, rect, widget, opts, collector);
    }
  }
  // Empty slots are just left blank
}

// ─── Main Generator ─────────────────────────────────────────────

export async function generatePlannerPdf(
  layoutConfig: PlannerLayoutConfig,
  options: PlannerGeneratorOptions
): Promise<{ buffer: Buffer; filename: string }> {
  const pageDef = PAGE_SIZES[layoutConfig.pageSize] ?? PAGE_SIZES["remarkable"]!;
  const isLandscape = layoutConfig.orientation === "landscape";
  const pageWidth = isLandscape ? pageDef.height : pageDef.width;
  const pageHeight = isLandscape ? pageDef.width : pageDef.height;
  const margin = 16;

  return new Promise<{ buffer: Buffer; filename: string }>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: [pageWidth, pageHeight],
        margins: { top: margin, bottom: margin, left: margin, right: margin },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => {
        const filename = `planner-${format(options.date, "yyyy-MM-dd")}.pdf`;
        resolve({ buffer: Buffer.concat(chunks), filename });
      });
      doc.on("error", reject);

      const contentRect: RenderRect = {
        x: margin,
        y: margin,
        width: pageWidth - margin * 2,
        height: pageHeight - margin * 2,
      };

      // Create detail page collector if enabled
      const collector = layoutConfig.enableDetailPages ? new DetailPageCollector() : undefined;

      // Place front-page anchor for back-links from detail pages
      if (collector) {
        doc.addNamedDestination("front-page");
      }

      // Use columns layout if available
      if (layoutConfig.columns && layoutConfig.columns.sections.length > 0) {
        const rootSection = layoutConfig.columns.sections[0]!;
        renderSection(doc, rootSection, contentRect, layoutConfig.widgets, options, collector);
      } else {
        // Fallback: grid-based layout (legacy)
        const cellWidth = contentRect.width / layoutConfig.gridColumns;
        const cellHeight = contentRect.height / layoutConfig.gridRows;

        const sortedWidgets = [...layoutConfig.widgets].sort((a, b) => {
          if (a.y !== b.y) return a.y - b.y;
          return a.x - b.x;
        });

        for (const widget of sortedWidgets) {
          const rect: RenderRect = {
            x: contentRect.x + widget.x * cellWidth,
            y: contentRect.y + widget.y * cellHeight,
            width: widget.width * cellWidth,
            height: widget.height * cellHeight,
          };
          renderWidget(doc, rect, widget, options, collector);
        }
      }

      // Render detail pages after the front page
      if (collector && collector.entries.length > 0) {
        renderDetailPages(doc, collector.entries, options, pageWidth, pageHeight, margin);
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
