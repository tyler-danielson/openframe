/**
 * MagicMirror² config.js import
 *
 * Parses MagicMirror config.js files and converts modules into
 * OpenFrame ScreensaverLayoutConfig widgets.
 *
 * MagicMirror uses position-based regions (top_left, bottom_right, etc.)
 * which we map to grid coordinates on a 16×9 grid.
 */

import type {
  ScreensaverLayoutConfig,
  WidgetInstance,
  WidgetStyle,
} from "../stores/screensaver";
import { DEFAULT_LAYOUT_CONFIG } from "../stores/screensaver";
import { WIDGET_REGISTRY } from "./widgets/registry";

// ── Position mapping ────────────────────────────────────────

// MagicMirror positions → grid regions on a 16×9 grid
const POSITION_MAP: Record<string, { x: number; y: number; width: number; height: number }> = {
  top_bar:        { x: 0,  y: 0, width: 16, height: 1 },
  top_left:       { x: 0,  y: 0, width: 5,  height: 3 },
  top_center:     { x: 5,  y: 0, width: 6,  height: 3 },
  top_right:      { x: 11, y: 0, width: 5,  height: 3 },
  upper_third:    { x: 0,  y: 0, width: 16, height: 3 },
  middle_center:  { x: 4,  y: 3, width: 8,  height: 3 },
  lower_third:    { x: 0,  y: 6, width: 16, height: 3 },
  bottom_left:    { x: 0,  y: 6, width: 5,  height: 3 },
  bottom_center:  { x: 5,  y: 6, width: 6,  height: 3 },
  bottom_right:   { x: 11, y: 6, width: 5,  height: 3 },
  bottom_bar:     { x: 0,  y: 8, width: 16, height: 1 },
  fullscreen_above: { x: 0, y: 0, width: 16, height: 9 },
  fullscreen_below: { x: 0, y: 0, width: 16, height: 9 },
};

// Track how many modules are in each position to stack them
const positionCounters: Record<string, number> = {};

function getGridPosition(position: string): { x: number; y: number; width: number; height: number } {
  const fallback = { x: 4, y: 3, width: 8, height: 3 };
  const base = POSITION_MAP[position] || fallback;
  const count = positionCounters[position] || 0;
  positionCounters[position] = count + 1;

  // Stack multiple modules in the same region vertically
  const offsetY = Math.min(count, 2); // Max 3 stacked
  const x: number = base.x;
  const width: number = base.width;
  const y: number = Math.min(base.y + offsetY, 8);
  const height: number = Math.max(1, base.height - offsetY);
  return { x, y, width, height };
}

// ── Parsing ─────────────────────────────────────────────────

interface MMModule {
  module: string;
  position?: string;
  header?: string;
  config?: Record<string, unknown>;
  disabled?: boolean;
  classes?: string;
}

interface MMConfig {
  modules: MMModule[];
  language?: string;
  timeFormat?: number;
  units?: string;
  [key: string]: unknown;
}

export function parseMagicMirrorConfig(fileContent: string): MMConfig {
  // config.js uses `let config = { ... }; module.exports = config;`
  // We need to extract the object. Strip the JS wrapper and eval as JSON-ish.
  let cleaned = fileContent;

  // Remove module.exports line
  cleaned = cleaned.replace(/\/?\/?module\.exports\s*=\s*config;?\s*$/m, "");
  // Remove the `let config = ` or `var config = ` prefix
  cleaned = cleaned.replace(/^(let|var|const)\s+config\s*=\s*/m, "");
  // Remove trailing semicolons
  cleaned = cleaned.replace(/;\s*$/, "");
  // Remove single-line comments
  cleaned = cleaned.replace(/\/\/.*$/gm, "");
  // Remove multi-line comments
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, "");
  // Add quotes to unquoted keys (JS → JSON)
  cleaned = cleaned.replace(/(\s)(\w+)\s*:/g, '$1"$2":');
  // Remove trailing commas (invalid JSON)
  cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");

  try {
    const config = JSON.parse(cleaned);
    if (!config.modules || !Array.isArray(config.modules)) {
      throw new Error("Missing modules array");
    }
    return config;
  } catch {
    throw new Error("Could not parse MagicMirror config.js. Make sure it's a standard config file.");
  }
}

// ── Main conversion ─────────────────────────────────────────

export interface MagicMirrorImportResult {
  name: string;
  layoutConfig: ScreensaverLayoutConfig;
  stats: {
    totalModules: number;
    importedWidgets: number;
    skippedDisabled: number;
    skippedUnsupported: number;
    unsupportedTypes: string[];
  };
}

export function convertMagicMirrorToLayout(config: MMConfig): MagicMirrorImportResult {
  // Reset position counters
  Object.keys(positionCounters).forEach((k) => delete positionCounters[k]);

  const activeModules = config.modules.filter((m) => !m.disabled && m.position);
  const disabledCount = config.modules.length - activeModules.length;

  const widgets: WidgetInstance[] = [];
  const unsupportedTypes: string[] = [];
  let skippedUnsupported = 0;

  for (const mod of activeModules) {
    const widget = mapModule(mod, config);
    if (widget) {
      widgets.push(widget);
    } else {
      skippedUnsupported++;
      if (!unsupportedTypes.includes(mod.module)) {
        unsupportedTypes.push(mod.module);
      }
    }
  }

  const layoutConfig: ScreensaverLayoutConfig = {
    ...DEFAULT_LAYOUT_CONFIG,
    backgroundColor: "#000000",
    widgets,
  };

  return {
    name: "MagicMirror Import",
    layoutConfig,
    stats: {
      totalModules: config.modules.length,
      importedWidgets: widgets.length,
      skippedDisabled: disabledCount,
      skippedUnsupported,
      unsupportedTypes,
    },
  };
}

// ── Module mapping ──────────────────────────────────────────

function mapModule(mod: MMModule, globalConfig: MMConfig): WidgetInstance | null {
  const pos = getGridPosition(mod.position!);
  const cfg = mod.config || {};

  switch (mod.module) {
    case "clock":
      return makeWidget("clock", pos, {
        ...WIDGET_REGISTRY.clock.defaultConfig,
        showDate: true,
        showSeconds: cfg.showSeconds ?? false,
        format24h: (cfg.timeFormat ?? globalConfig.timeFormat ?? 24) === 24,
        timezone: cfg.timezone as string | undefined,
      });

    case "calendar":
      return makeWidget("up-next", pos, {
        ...WIDGET_REGISTRY["up-next"].defaultConfig,
        maxItems: (cfg.maximumEntries as number) ?? 10,
        showLocation: cfg.showLocation ?? false,
        showCalendarName: cfg.colored ?? false,
      });

    case "weather":
      if (cfg.type === "forecast") {
        return makeWidget("forecast", pos, {
          ...WIDGET_REGISTRY.forecast.defaultConfig,
          days: (cfg.maxNumberOfDays as number) ?? 5,
          showHighLow: true,
          showIcons: true,
        });
      }
      return makeWidget("weather", pos, {
        ...WIDGET_REGISTRY.weather.defaultConfig,
        showIcon: true,
        showDescription: true,
        showHumidity: cfg.showHumidity ?? true,
        showWind: cfg.showWindSpeed ?? true,
      });

    case "newsfeed":
      return makeWidget("news", pos, {
        ...WIDGET_REGISTRY.news.defaultConfig,
        maxItems: (cfg.showSourceTitle as number) ?? 5,
      });

    case "compliments":
      return makeWidget("text", pos, {
        ...WIDGET_REGISTRY.text.defaultConfig,
        content: "Compliments",
        textAlign: "center",
      });

    case "MMM-Spotify":
    case "MMM-NowPlayingOnSpotify":
      return makeWidget("spotify", pos, {
        ...WIDGET_REGISTRY.spotify.defaultConfig,
        showAlbumArt: true,
        showProgress: true,
      });

    case "MMM-Todoist":
    case "MMM-Wunderlist":
    case "MMM-GoogleTasks":
      return makeWidget("tasks", pos, {
        ...WIDGET_REGISTRY.tasks.defaultConfig,
        maxItems: (cfg.maximumEntries as number) ?? 10,
      });

    case "MMM-HomeAssistant":
    case "MMM-HomeAssistantDisplay":
      return makeWidget("ha-entity", pos, {
        ...WIDGET_REGISTRY["ha-entity"].defaultConfig,
      });

    case "MMM-Countdown":
    case "MMM-CountDown":
      return makeWidget("countdown", pos, {
        ...WIDGET_REGISTRY.countdown.defaultConfig,
        label: (cfg.event as string) ?? "Countdown",
      });

    case "MMM-ImageSlideshow":
    case "MMM-BackgroundSlideshow":
      return makeWidget("photo-album", pos, {
        ...WIDGET_REGISTRY["photo-album"].defaultConfig,
        interval: (cfg.slideshowSpeed as number) ? Math.round((cfg.slideshowSpeed as number) / 1000) : 30,
        fit: "cover",
        shuffle: cfg.randomizeImageOrder ?? true,
      });

    default:
      return null;
  }
}

// ── Helpers ─────────────────────────────────────────────────

let idCounter = 0;
function generateId(): string {
  idCounter++;
  return `mm-${Date.now()}-${idCounter}`;
}

function makeWidget(
  type: WidgetInstance["type"],
  pos: { x: number; y: number; width: number; height: number },
  config: Record<string, unknown>,
  style?: WidgetStyle
): WidgetInstance {
  return { id: generateId(), type, ...pos, config, style };
}
