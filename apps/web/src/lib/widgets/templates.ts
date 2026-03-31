import type { BuilderWidgetType } from "../../stores/screensaver";
import type { WidgetStyle } from "../../stores/screensaver";

export interface ScreenTemplate {
  id: string;
  name: string;
  description: string;
  icon: string; // Lucide icon name
  gridColumns: number;
  gridRows: number;
  gridGap: number;
  backgroundColor: string;
  widgets: Array<{
    type: BuilderWidgetType;
    x: number;
    y: number;
    width: number;
    height: number;
    config: Record<string, unknown>;
    style?: WidgetStyle;
  }>;
  requiredModules: string[];
}

export const SCREEN_TEMPLATES: ScreenTemplate[] = [
  {
    id: "family-command-center",
    name: "Family Command Center",
    description:
      "The essentials at a glance — calendar, weather, chores, and what's coming up next.",
    icon: "LayoutDashboard",
    gridColumns: 16,
    gridRows: 9,
    gridGap: 8,
    backgroundColor: "transparent",
    requiredModules: ["weather"],
    widgets: [
      {
        type: "clock",
        x: 0,
        y: 0,
        width: 3,
        height: 2,
        config: { showSeconds: false, showDate: true, format24h: false },
      },
      {
        type: "weather",
        x: 3,
        y: 0,
        width: 3,
        height: 2,
        config: { showIcon: true, showDescription: true, showHumidity: true },
      },
      {
        type: "up-next",
        x: 6,
        y: 0,
        width: 4,
        height: 2,
        config: { maxItems: 3, showCountdown: true, showLocation: true },
      },
      {
        type: "calendar",
        x: 0,
        y: 2,
        width: 6,
        height: 5,
        config: {
          maxItems: 8,
          showUpcomingOnly: true,
          hideBlankEvents: true,
        },
      },
      {
        type: "chores",
        x: 6,
        y: 2,
        width: 4,
        height: 5,
        config: {
          maxItems: 6,
          showCompleted: false,
          showDueDate: true,
          showAssignee: true,
          groupBy: "none",
        },
      },
      {
        type: "forecast",
        x: 0,
        y: 7,
        width: 6,
        height: 2,
        config: { days: 5, showHighLow: true, showIcons: true },
      },
      {
        type: "day-schedule",
        x: 6,
        y: 7,
        width: 4,
        height: 2,
        config: { startHour: 6, endHour: 22 },
      },
    ],
  },
  {
    id: "photo-frame",
    name: "Photo Frame",
    description:
      "Turn any screen into a digital picture frame with time and weather overlays.",
    icon: "Image",
    gridColumns: 16,
    gridRows: 9,
    gridGap: 0,
    backgroundColor: "#000000",
    requiredModules: ["weather"],
    widgets: [
      {
        type: "photo-album",
        x: 0,
        y: 0,
        width: 16,
        height: 9,
        config: {
          source: "reddit",
          subreddit: "EarthPorn",
          interval: 60,
          transition: "fade",
          cropStyle: "crop",
        },
      },
      {
        type: "clock",
        x: 0,
        y: 0,
        width: 3,
        height: 1,
        config: { showSeconds: false, showDate: true, format24h: false },
        style: {
          backgroundColor: "rgba(0,0,0,0.5)",
          textColor: "#ffffff",
        },
      },
      {
        type: "weather",
        x: 13,
        y: 0,
        width: 3,
        height: 1,
        config: {
          showIcon: true,
          showDescription: false,
          showHumidity: false,
        },
        style: {
          backgroundColor: "rgba(0,0,0,0.5)",
          textColor: "#ffffff",
        },
      },
    ],
  },
  {
    id: "media-center",
    name: "Media Center",
    description:
      "Now playing, sports scores, and news headlines for the entertainment hub.",
    icon: "MonitorPlay",
    gridColumns: 16,
    gridRows: 9,
    gridGap: 8,
    backgroundColor: "transparent",
    requiredModules: ["spotify", "sports", "news"],
    widgets: [
      {
        type: "spotify",
        x: 0,
        y: 0,
        width: 6,
        height: 4,
        config: {
          showAlbumArt: true,
          showProgress: true,
        },
      },
      {
        type: "sports",
        x: 6,
        y: 0,
        width: 6,
        height: 4,
        config: { maxItems: 5 },
      },
      {
        type: "clock",
        x: 12,
        y: 0,
        width: 4,
        height: 2,
        config: { showSeconds: false, showDate: true, format24h: false },
      },
      {
        type: "news",
        x: 12,
        y: 2,
        width: 4,
        height: 5,
        config: {
          maxItems: 6,
          showImages: true,
          showSource: true,
          showTime: true,
        },
      },
      {
        type: "forecast",
        x: 0,
        y: 4,
        width: 6,
        height: 2,
        config: { days: 5, showHighLow: true, showIcons: true },
      },
      {
        type: "up-next",
        x: 6,
        y: 4,
        width: 6,
        height: 3,
        config: {
          maxItems: 4,
          showCountdown: true,
          showLocation: true,
        },
      },
      {
        type: "sticky-notes",
        x: 0,
        y: 6,
        width: 6,
        height: 3,
        config: {
          maxNotes: 4,
          showAuthor: true,
          columns: 2,
          defaultColor: "#FEF3C7",
        },
      },
    ],
  },
];
