/**
 * Dakboard .dakexport migration tool
 *
 * Parses Dakboard export files and converts them into OpenFrame
 * ScreensaverLayoutConfig for use as Custom Screens.
 */

import type {
  ScreensaverLayoutConfig,
  WidgetInstance,
  WidgetStyle,
} from "../stores/screensaver";
import { DEFAULT_LAYOUT_CONFIG } from "../stores/screensaver";
import { WIDGET_REGISTRY } from "./widgets/registry";

// ── Dakboard types ──────────────────────────────────────────

interface DakboardExport {
  lock: string;
  data: string; // base64-encoded JSON
}

interface DakboardData {
  version: string;
  settings: DakboardSettings;
  blocks: DakboardBlock[];
}

interface DakboardSettings {
  name: string;
  width: string;
  height: string;
  orientation: string;
  version: string;
  aspect: string;
  settings: {
    language?: string;
    timezone?: string;
    font_size_type?: string;
    time_format?: string;
    font_size?: string | null;
    font_family?: string;
    date_format?: string | null;
    increase_legibility?: string;
    background_color?: string;
    custom_css?: string;
    text_color?: string | null;
  };
}

interface DakboardBlock {
  type: string;
  name?: string;
  show_name?: string;
  h_percent: string | number;
  w_percent: string | number;
  x_percent: string | number;
  y_percent: string | number;
  z_index?: number;
  is_disabled?: number;
  background_color?: string;
  color?: string;
  font_family?: string;
  font_size?: string | number;
  align_horiz?: string;
  // datetime
  timezone?: string;
  time_format?: string;
  date_format?: string;
  // calendar
  calendar_type?: string;
  calendar_style?: string;
  weeks_to_show?: string;
  limit?: string;
  week_start?: string;
  show_location?: string;
  show_description?: string;
  show_end_time?: string;
  start_hour?: string;
  end_hour?: string;
  // photos
  photo_change?: string;
  brightness?: string;
  crop?: string;
  vignette?: string;
  // todo
  show_completed?: string;
  allow_checking?: string;
  show_card_names?: string;
  // text
  text?: string;
  is_scrolling?: string;
  // weather
  // audio (spotify)
  // site
  // schedules
  schedules?: Array<{
    occurrence_type?: string;
    occurrence_day?: string;
    start_time?: string;
    end_time?: string;
  }>;
  // catch-all for unknown fields
  [key: string]: unknown;
}

// ── Parsing ─────────────────────────────────────────────────

export function parseDakExport(fileContent: string): DakboardData {
  const raw: DakboardExport = JSON.parse(fileContent);

  if (!raw.data) {
    throw new Error("Invalid .dakexport file: missing data field");
  }

  const decoded = atob(raw.data);
  const data: DakboardData = JSON.parse(decoded);

  if (!data.blocks || !Array.isArray(data.blocks)) {
    throw new Error("Invalid Dakboard export: missing blocks array");
  }

  return data;
}

// ── Main conversion ─────────────────────────────────────────

export interface DakboardImportResult {
  name: string;
  layoutConfig: ScreensaverLayoutConfig;
  stats: {
    totalBlocks: number;
    importedWidgets: number;
    skippedDisabled: number;
    skippedUnsupported: number;
    unsupportedTypes: string[];
  };
}

export function convertDakboardToLayout(data: DakboardData): DakboardImportResult {
  const gridCols = DEFAULT_LAYOUT_CONFIG.gridColumns; // 16
  const gridRows = DEFAULT_LAYOUT_CONFIG.gridRows; // 9

  const activeBlocks = data.blocks.filter((b) => !b.is_disabled);
  const disabledCount = data.blocks.length - activeBlocks.length;

  // Detect multi-clock pattern: multiple datetime blocks showing only time
  const multiClockWidget = detectMultiClock(activeBlocks, gridCols, gridRows);
  const multiClockTimezones = multiClockWidget
    ? new Set(
        activeBlocks
          .filter((b) => b.type === "datetime" && b.date_format === "disabled" && b.timezone)
          .map((b) => b.timezone!)
      )
    : null;

  const widgets: WidgetInstance[] = [];
  const unsupportedTypes: string[] = [];
  let skippedUnsupported = 0;

  // Add multi-clock widget first if detected
  if (multiClockWidget) {
    widgets.push(multiClockWidget);
  }

  for (const block of activeBlocks) {
    // Skip datetime blocks that were merged into multi-clock
    if (
      multiClockTimezones &&
      block.type === "datetime" &&
      block.date_format === "disabled" &&
      block.timezone &&
      multiClockTimezones.has(block.timezone)
    ) {
      continue;
    }

    const widget = mapBlock(block, gridCols, gridRows);
    if (widget) {
      widgets.push(widget);
    } else {
      skippedUnsupported++;
      if (!unsupportedTypes.includes(block.type)) {
        unsupportedTypes.push(block.type);
      }
    }
  }

  // Sort by z_index (lower = behind)
  widgets.sort((a, b) => {
    const za = (a.config._zIndex as number) ?? 0;
    const zb = (b.config._zIndex as number) ?? 0;
    return za - zb;
  });

  // Clean up internal _zIndex from config
  for (const w of widgets) {
    delete w.config._zIndex;
  }

  const bgColor = data.settings.settings?.background_color || "#000000";

  const layoutConfig: ScreensaverLayoutConfig = {
    ...DEFAULT_LAYOUT_CONFIG,
    backgroundColor: bgColor,
    widgets,
  };

  return {
    name: `${data.settings.name || "Dakboard"} (Dakboard Import)`,
    layoutConfig,
    stats: {
      totalBlocks: data.blocks.length,
      importedWidgets: widgets.length,
      skippedDisabled: disabledCount,
      skippedUnsupported,
      unsupportedTypes,
    },
  };
}

// ── Multi-clock detection ───────────────────────────────────

function detectMultiClock(
  blocks: DakboardBlock[],
  gridCols: number,
  gridRows: number
): WidgetInstance | null {
  // Find datetime blocks that show only time (date_format === "disabled")
  const timeOnlyBlocks = blocks.filter(
    (b) => b.type === "datetime" && b.date_format === "disabled" && b.timezone
  );

  if (timeOnlyBlocks.length < 2) return null;

  // Build timezones array
  const timezones = timeOnlyBlocks.map((b) => ({
    label: b.name || b.timezone!.split("/").pop()!.replace(/_/g, " "),
    timezone: b.timezone!,
  }));

  // Position: bounding box of all the datetime blocks
  const xs = timeOnlyBlocks.map((b) => pct(b.x_percent));
  const ys = timeOnlyBlocks.map((b) => pct(b.y_percent));
  const rights = timeOnlyBlocks.map((b) => pct(b.x_percent) + pct(b.w_percent));
  const bottoms = timeOnlyBlocks.map((b) => pct(b.y_percent) + pct(b.h_percent));

  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxRight = Math.max(...rights);
  const maxBottom = Math.max(...bottoms);

  const format24h = timeOnlyBlocks.some((b) => b.time_format === "24");

  return {
    id: generateId(),
    type: "multi-clock",
    ...percentToGrid(minX, minY, maxRight - minX, maxBottom - minY, gridCols, gridRows),
    config: {
      ...WIDGET_REGISTRY["multi-clock"].defaultConfig,
      timezones,
      showSeconds: format24h,
      showDate: false,
      highlightLocal: true,
    },
  };
}

// ── Per-block mapping ───────────────────────────────────────

function mapBlock(
  block: DakboardBlock,
  gridCols: number,
  gridRows: number
): WidgetInstance | null {
  const pos = percentToGrid(
    pct(block.x_percent),
    pct(block.y_percent),
    pct(block.w_percent),
    pct(block.h_percent),
    gridCols,
    gridRows
  );

  const style = mapStyle(block);
  const zIndex = block.z_index ?? 100;

  switch (block.type) {
    case "datetime":
      return mapDatetime(block, pos, style, zIndex);
    case "calendar":
      return mapCalendar(block, pos, style, zIndex);
    case "photos":
      return mapPhotos(block, pos, style, zIndex);
    case "weather":
      return mapWeather(block, pos, style, zIndex);
    case "todo":
      return mapTodo(block, pos, style, zIndex);
    case "audio":
      return mapAudio(block, pos, style, zIndex);
    case "text":
      return mapText(block, pos, style, zIndex);
    case "site":
      return mapSite(block, pos, style, zIndex);
    default:
      return null; // whiteboard, etc.
  }
}

// ── Type-specific mappers ───────────────────────────────────

function mapDatetime(
  block: DakboardBlock,
  pos: GridPos,
  style: WidgetStyle | undefined,
  zIndex: number
): WidgetInstance {
  const showDate = block.date_format !== "disabled";
  const format24h = block.time_format === "24";

  return {
    id: generateId(),
    type: "clock",
    ...pos,
    config: {
      ...WIDGET_REGISTRY.clock.defaultConfig,
      showDate,
      format24h,
      showSeconds: false,
      timezone: block.timezone || undefined,
      _zIndex: zIndex,
    },
    style,
  };
}

function mapCalendar(
  block: DakboardBlock,
  pos: GridPos,
  style: WidgetStyle | undefined,
  zIndex: number
): WidgetInstance {
  const isMonthly = block.calendar_type === "monthly";

  if (isMonthly) {
    return {
      id: generateId(),
      type: "calendar",
      ...pos,
      config: {
        ...WIDGET_REGISTRY.calendar.defaultConfig,
        maxItems: parseInt(block.limit || "5", 10),
        showTime: true,
        _zIndex: zIndex,
      },
      style,
    };
  }

  // Agenda/rolling → up-next
  return {
    id: generateId(),
    type: "up-next",
    ...pos,
    config: {
      ...WIDGET_REGISTRY["up-next"].defaultConfig,
      maxItems: parseInt(block.limit || "10", 10),
      showLocation: block.show_location === "1",
      showDescription: block.show_description === "1",
      _zIndex: zIndex,
    },
    style,
  };
}

function mapPhotos(
  block: DakboardBlock,
  pos: GridPos,
  style: WidgetStyle | undefined,
  zIndex: number
): WidgetInstance {
  const interval = parseInt(block.photo_change || "30", 10);

  return {
    id: generateId(),
    type: "photo-album",
    ...pos,
    config: {
      ...WIDGET_REGISTRY["photo-album"].defaultConfig,
      source: "album",
      interval,
      fit: block.crop === "1" ? "cover" : "contain",
      shuffle: true,
      _zIndex: zIndex,
    },
    style: {
      ...style,
      opacity: block.brightness ? parseFloat(block.brightness as string) : undefined,
    },
  };
}

function mapWeather(
  block: DakboardBlock,
  pos: GridPos,
  style: WidgetStyle | undefined,
  zIndex: number
): WidgetInstance {
  // Dakboard weather blocks often include both current + forecast
  // Map to weather widget; if the block is tall, it's likely a forecast
  const isTall = pos.height >= 3;

  if (isTall) {
    return {
      id: generateId(),
      type: "forecast",
      ...pos,
      config: {
        ...WIDGET_REGISTRY.forecast.defaultConfig,
        days: 5,
        showHighLow: true,
        showIcons: true,
        _zIndex: zIndex,
      },
      style,
    };
  }

  return {
    id: generateId(),
    type: "weather",
    ...pos,
    config: {
      ...WIDGET_REGISTRY.weather.defaultConfig,
      showIcon: true,
      showDescription: true,
      showHumidity: true,
      showWind: true,
      _zIndex: zIndex,
    },
    style,
  };
}

function mapTodo(
  block: DakboardBlock,
  pos: GridPos,
  style: WidgetStyle | undefined,
  zIndex: number
): WidgetInstance {
  return {
    id: generateId(),
    type: "tasks",
    ...pos,
    config: {
      ...WIDGET_REGISTRY.tasks.defaultConfig,
      maxItems: 10,
      showDueDate: true,
      _zIndex: zIndex,
    },
    style,
  };
}

function mapAudio(
  block: DakboardBlock,
  pos: GridPos,
  style: WidgetStyle | undefined,
  zIndex: number
): WidgetInstance {
  return {
    id: generateId(),
    type: "spotify",
    ...pos,
    config: {
      ...WIDGET_REGISTRY.spotify.defaultConfig,
      showAlbumArt: true,
      showProgress: true,
      showArtist: true,
      _zIndex: zIndex,
    },
    style,
  };
}

function mapText(
  block: DakboardBlock,
  pos: GridPos,
  style: WidgetStyle | undefined,
  zIndex: number
): WidgetInstance {
  return {
    id: generateId(),
    type: "text",
    ...pos,
    config: {
      ...WIDGET_REGISTRY.text.defaultConfig,
      content: block.text || "",
      textAlign: block.align_horiz || "center",
      _zIndex: zIndex,
    },
    style,
  };
}

function mapSite(
  block: DakboardBlock,
  pos: GridPos,
  style: WidgetStyle | undefined,
  zIndex: number
): WidgetInstance {
  // No direct equivalent — create a text placeholder
  return {
    id: generateId(),
    type: "text",
    ...pos,
    config: {
      ...WIDGET_REGISTRY.text.defaultConfig,
      content: "⚠ Embedded website — configure manually in OpenFrame",
      textAlign: "center",
      _zIndex: zIndex,
    },
    style,
  };
}

// ── Helpers ─────────────────────────────────────────────────

interface GridPos {
  x: number;
  y: number;
  width: number;
  height: number;
}

function pct(val: string | number): number {
  return typeof val === "string" ? parseFloat(val) : val;
}

function percentToGrid(
  xPct: number,
  yPct: number,
  wPct: number,
  hPct: number,
  gridCols: number,
  gridRows: number
): GridPos {
  return {
    x: clamp(Math.round((xPct / 100) * gridCols), 0, gridCols - 1),
    y: clamp(Math.round((yPct / 100) * gridRows), 0, gridRows - 1),
    width: clamp(Math.max(1, Math.round((wPct / 100) * gridCols)), 1, gridCols),
    height: clamp(Math.max(1, Math.round((hPct / 100) * gridRows)), 1, gridRows),
  };
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function mapStyle(block: DakboardBlock): WidgetStyle | undefined {
  const style: WidgetStyle = {};
  let hasStyle = false;

  if (block.color && block.color !== "light" && block.color !== "") {
    style.textColor = block.color;
    hasStyle = true;
  }

  if (block.background_color && block.background_color !== "") {
    style.backgroundColor = block.background_color;
    hasStyle = true;
  }

  if (block.align_horiz && block.align_horiz !== "left") {
    style.textAlign = block.align_horiz as "left" | "center" | "right";
    hasStyle = true;
  }

  if (block.font_size) {
    const size = parseInt(String(block.font_size), 10);
    if (size <= 14) style.fontSize = "xs";
    else if (size <= 18) style.fontSize = "sm";
    else if (size <= 24) style.fontSize = "md";
    else if (size <= 28) style.fontSize = "lg";
    else style.fontSize = "xl";
    hasStyle = true;
  }

  return hasStyle ? style : undefined;
}

let idCounter = 0;
function generateId(): string {
  idCounter++;
  return `dak-${Date.now()}-${idCounter}`;
}
