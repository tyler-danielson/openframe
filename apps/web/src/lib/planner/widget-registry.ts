import type { PlannerWidgetType } from "@openframe/shared";
import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  CalendarRange,
  Calendar,
  CheckSquare,
  Newspaper,
  CloudSun,
  FileText,
  Type,
  Minus,
  Grid3X3,
  Sparkles,
  Mail,
} from "lucide-react";

export interface PlannerWidgetDefinition {
  name: string;
  icon: LucideIcon;
  category: "calendar" | "content" | "layout" | "tracking";
  description: string;
  defaultSize: { width: number; height: number };
  minSize: { width: number; height: number };
  maxSize: { width: number; height: number };
  defaultConfig: Record<string, unknown>;
  previewColor: string;
  moduleId: string | null;
}

export const PLANNER_WIDGET_REGISTRY: Record<PlannerWidgetType, PlannerWidgetDefinition> = {
  "calendar-day": {
    name: "Day Schedule",
    icon: CalendarDays,
    category: "calendar",
    description: "Single day schedule with time slots",
    defaultSize: { width: 6, height: 8 },
    minSize: { width: 4, height: 4 },
    maxSize: { width: 12, height: 8 },
    defaultConfig: {
      showTimeSlots: true,
      startHour: 6,
      endHour: 22,
      showLocation: true,
      showDescription: false,
      fillHeight: true,
    },
    previewColor: "#dbeafe",
    moduleId: null,
  },
  "calendar-week": {
    name: "Week View",
    icon: CalendarRange,
    category: "calendar",
    description: "7-day week layout",
    defaultSize: { width: 12, height: 6 },
    minSize: { width: 6, height: 4 },
    maxSize: { width: 12, height: 8 },
    defaultConfig: {
      showDayNames: true,
      showDates: true,
      compactEvents: false,
      weekStartsOn: 0, // Sunday
    },
    previewColor: "#dbeafe",
    moduleId: null,
  },
  "calendar-month": {
    name: "Month Grid",
    icon: Calendar,
    category: "calendar",
    description: "Full month calendar grid",
    defaultSize: { width: 8, height: 6 },
    minSize: { width: 6, height: 4 },
    maxSize: { width: 12, height: 8 },
    defaultConfig: {
      showWeekNumbers: false,
      highlightToday: true,
      showEventDots: true,
      weekStartsOn: 0,
    },
    previewColor: "#dbeafe",
    moduleId: null,
  },
  tasks: {
    name: "Task List",
    icon: CheckSquare,
    category: "content",
    description: "Checklist with checkboxes",
    defaultSize: { width: 4, height: 4 },
    minSize: { width: 2, height: 2 },
    maxSize: { width: 8, height: 8 },
    defaultConfig: {
      maxItems: 10,
      showCheckboxes: true,
      showDueDate: true,
      includeCompleted: false,
    },
    previewColor: "#dcfce7",
    moduleId: null,
  },
  "news-headlines": {
    name: "News Headlines",
    icon: Newspaper,
    category: "content",
    description: "List of news article titles",
    defaultSize: { width: 4, height: 4 },
    minSize: { width: 2, height: 2 },
    maxSize: { width: 8, height: 8 },
    defaultConfig: {
      maxItems: 5,
      showSource: true,
      showDescription: false,
    },
    previewColor: "#fef3c7",
    moduleId: "news",
  },
  weather: {
    name: "Weather Forecast",
    icon: CloudSun,
    category: "content",
    description: "Weather conditions and forecast",
    defaultSize: { width: 4, height: 2 },
    minSize: { width: 2, height: 1 },
    maxSize: { width: 8, height: 4 },
    defaultConfig: {
      showIcon: true,
      showHighLow: true,
      forecastDays: 3,
    },
    previewColor: "#e0f2fe",
    moduleId: "weather",
  },
  notes: {
    name: "Notes Area",
    icon: FileText,
    category: "layout",
    description: "Blank area with ruled lines for writing",
    defaultSize: { width: 4, height: 4 },
    minSize: { width: 2, height: 2 },
    maxSize: { width: 12, height: 8 },
    defaultConfig: {
      lineSpacing: 24, // pixels
      showTitle: true,
      title: "Notes",
      lineStyle: "ruled", // "ruled" | "dotted" | "grid" | "blank"
    },
    previewColor: "#f3f4f6",
    moduleId: null,
  },
  text: {
    name: "Text / Header",
    icon: Type,
    category: "layout",
    description: "Static text, title, or label",
    defaultSize: { width: 4, height: 1 },
    minSize: { width: 1, height: 1 },
    maxSize: { width: 12, height: 4 },
    defaultConfig: {
      text: "{{date}}", // Supports template variables
      fontSize: "xl", // "sm" | "md" | "lg" | "xl" | "2xl"
      fontWeight: "bold",
      textAlign: "center",
    },
    previewColor: "#f3f4f6",
    moduleId: null,
  },
  divider: {
    name: "Divider",
    icon: Minus,
    category: "layout",
    description: "Horizontal or vertical separator line",
    defaultSize: { width: 12, height: 1 },
    minSize: { width: 1, height: 1 },
    maxSize: { width: 12, height: 1 },
    defaultConfig: {
      orientation: "horizontal", // "horizontal" | "vertical"
      style: "solid", // "solid" | "dashed" | "dotted"
      thickness: 1,
    },
    previewColor: "#e5e7eb",
    moduleId: null,
  },
  habits: {
    name: "Habit Tracker",
    icon: Grid3X3,
    category: "tracking",
    description: "Monthly habit tracking grid",
    defaultSize: { width: 6, height: 4 },
    minSize: { width: 4, height: 3 },
    maxSize: { width: 12, height: 8 },
    defaultConfig: {
      habits: ["Exercise", "Read", "Meditate"],
      showDates: true,
      checkboxStyle: "circle", // "circle" | "square" | "checkbox"
      columns: 2,
      showLabels: false,
    },
    previewColor: "#fae8ff",
    moduleId: null,
  },
  "ai-briefing": {
    name: "AI Briefing",
    icon: Sparkles,
    category: "content",
    description: "AI-generated daily summary",
    defaultSize: { width: 4, height: 4 },
    minSize: { width: 3, height: 2 },
    maxSize: { width: 8, height: 8 },
    defaultConfig: {
      title: "Daily Briefing",
      showHighlights: true,
    },
    previewColor: "#fef9c3",
    moduleId: "ai-briefing",
  },
  "email-highlights": {
    name: "Email Highlights",
    icon: Mail,
    category: "content",
    description: "Recent Gmail emails",
    defaultSize: { width: 4, height: 4 },
    minSize: { width: 3, height: 2 },
    maxSize: { width: 8, height: 8 },
    defaultConfig: {
      title: "Email",
      maxItems: 5,
      showSnippet: false,
      showTime: true,
    },
    previewColor: "#fee2e2",
    moduleId: "gmail",
  },
};

export const PLANNER_WIDGET_CATEGORIES = [
  { id: "calendar", name: "Calendar", icon: "Calendar" },
  { id: "content", name: "Content", icon: "FileText" },
  { id: "layout", name: "Layout", icon: "Layout" },
  { id: "tracking", name: "Tracking", icon: "Target" },
] as const;

export function getPlannerWidgetsByCategory(category: string, isModuleEnabled?: (id: string) => boolean): PlannerWidgetType[] {
  return (Object.keys(PLANNER_WIDGET_REGISTRY) as PlannerWidgetType[]).filter(
    (type) => {
      const def = PLANNER_WIDGET_REGISTRY[type];
      if (def.category !== category) return false;
      if (isModuleEnabled && def.moduleId && !isModuleEnabled(def.moduleId)) return false;
      return true;
    }
  );
}

export function getPlannerWidgetDefinition(type: PlannerWidgetType): PlannerWidgetDefinition {
  return PLANNER_WIDGET_REGISTRY[type];
}
