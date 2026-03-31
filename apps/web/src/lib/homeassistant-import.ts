/**
 * Home Assistant Lovelace dashboard import
 *
 * Parses HA Lovelace dashboard configs (JSON or YAML-converted-to-JSON)
 * and converts cards into OpenFrame ScreensaverLayoutConfig widgets.
 *
 * HA dashboards use a views → cards hierarchy. Each view becomes a set
 * of widgets laid out in a grid. We import the first view (or all views
 * merged) as a single custom screen.
 */

import type {
  ScreensaverLayoutConfig,
  WidgetInstance,
} from "../stores/screensaver";
import { DEFAULT_LAYOUT_CONFIG } from "../stores/screensaver";
import { WIDGET_REGISTRY } from "./widgets/registry";

// ── HA Lovelace types ───────────────────────────────────────

interface LovelaceConfig {
  views: LovelaceView[];
  title?: string;
}

interface LovelaceView {
  title?: string;
  path?: string;
  cards?: LovelaceCard[];
  sections?: LovelaceSection[];
}

interface LovelaceSection {
  title?: string;
  cards?: LovelaceCard[];
}

interface LovelaceCard {
  type: string;
  title?: string;
  entity?: string;
  entities?: Array<string | { entity: string }>;
  name?: string;
  // weather
  show_forecast?: boolean;
  // calendar
  initial_view?: string;
  // markdown
  content?: string;
  // picture / image
  image?: string;
  camera_image?: string;
  // gauge
  min?: number;
  max?: number;
  // thermostat
  // generic catch-all
  [key: string]: unknown;
}

// ── Parsing ─────────────────────────────────────────────────

export function parseLovelaceConfig(fileContent: string): LovelaceConfig {
  let data: unknown;

  try {
    data = JSON.parse(fileContent);
  } catch {
    throw new Error(
      "Could not parse as JSON. If this is a YAML file, please convert it to JSON first (e.g., using an online YAML-to-JSON converter)."
    );
  }

  const config = data as Record<string, unknown>;

  // Handle .storage/lovelace format (has a "data" wrapper with "config")
  if (config.data && typeof config.data === "object") {
    const inner = config.data as Record<string, unknown>;
    if (inner.config && typeof inner.config === "object") {
      return validateConfig(inner.config as Record<string, unknown>);
    }
  }

  // Direct lovelace config
  if (config.views && Array.isArray(config.views)) {
    return config as unknown as LovelaceConfig;
  }

  throw new Error("Invalid Lovelace config: missing 'views' array. Expected a HA dashboard JSON file.");
}

function validateConfig(obj: Record<string, unknown>): LovelaceConfig {
  if (!obj.views || !Array.isArray(obj.views)) {
    throw new Error("Invalid Lovelace config: missing 'views' array");
  }
  return obj as unknown as LovelaceConfig;
}

// ── Main conversion ─────────────────────────────────────────

export interface HomeAssistantImportResult {
  name: string;
  layoutConfig: ScreensaverLayoutConfig;
  stats: {
    totalCards: number;
    importedWidgets: number;
    skippedUnsupported: number;
    unsupportedTypes: string[];
    viewsFound: number;
  };
}

export function convertLovelaceToLayout(config: LovelaceConfig): HomeAssistantImportResult {
  const gridCols = DEFAULT_LAYOUT_CONFIG.gridColumns;
  const gridRows = DEFAULT_LAYOUT_CONFIG.gridRows;

  // Collect all cards from all views (and sections within views)
  const allCards: LovelaceCard[] = [];
  for (const view of config.views) {
    if (view.cards) {
      allCards.push(...view.cards);
    }
    if (view.sections) {
      for (const section of view.sections) {
        if (section.cards) {
          allCards.push(...section.cards);
        }
      }
    }
  }

  const widgets: WidgetInstance[] = [];
  const unsupportedTypes: string[] = [];
  let skippedUnsupported = 0;

  // Auto-layout cards in a grid: 3 columns across, flowing down
  const colWidth = Math.floor(gridCols / 3);
  let col = 0;
  let row = 0;

  for (const card of allCards) {
    const widget = mapCard(card);
    if (widget) {
      // Assign position in a flowing grid layout
      widget.x = col * colWidth;
      widget.y = row;
      widget.width = colWidth;
      widget.height = 3;

      // Advance to next position
      col++;
      if (col >= 3) {
        col = 0;
        row += 3;
      }

      // Stop if we've filled the grid
      if (row >= gridRows) {
        widget.y = Math.min(widget.y, gridRows - widget.height);
      }

      widgets.push(widget);
    } else {
      skippedUnsupported++;
      if (!unsupportedTypes.includes(card.type)) {
        unsupportedTypes.push(card.type);
      }
    }
  }

  const layoutConfig: ScreensaverLayoutConfig = {
    ...DEFAULT_LAYOUT_CONFIG,
    backgroundColor: "#000000",
    widgets,
  };

  return {
    name: `${config.title || "Home Assistant"} (HA Import)`,
    layoutConfig,
    stats: {
      totalCards: allCards.length,
      importedWidgets: widgets.length,
      skippedUnsupported,
      unsupportedTypes,
      viewsFound: config.views.length,
    },
  };
}

// ── Card mapping ────────────────────────────────────────────

function mapCard(card: LovelaceCard): WidgetInstance | null {
  switch (card.type) {
    case "weather-forecast":
    case "weather":
      if (card.show_forecast) {
        return makeWidget("forecast", {
          ...WIDGET_REGISTRY.forecast.defaultConfig,
          days: 5,
        });
      }
      return makeWidget("weather", {
        ...WIDGET_REGISTRY.weather.defaultConfig,
      });

    case "calendar":
      return makeWidget("up-next", {
        ...WIDGET_REGISTRY["up-next"].defaultConfig,
        maxItems: 8,
      });

    case "clock":
      return makeWidget("clock", {
        ...WIDGET_REGISTRY.clock.defaultConfig,
      });

    case "thermostat":
    case "climate":
      return makeWidget("ha-entity", {
        ...WIDGET_REGISTRY["ha-entity"].defaultConfig,
        entityId: card.entity || "",
      });

    case "gauge":
      return makeWidget("ha-gauge", {
        ...WIDGET_REGISTRY["ha-gauge"].defaultConfig,
        entityId: card.entity || "",
        min: card.min ?? 0,
        max: card.max ?? 100,
      });

    case "sensor":
    case "entity":
    case "entities":
    case "button":
    case "tile":
      return makeWidget("ha-entity", {
        ...WIDGET_REGISTRY["ha-entity"].defaultConfig,
        entityId: card.entity || getFirstEntity(card) || "",
      });

    case "media-control":
    case "media-player":
      return makeWidget("spotify", {
        ...WIDGET_REGISTRY.spotify.defaultConfig,
      });

    case "picture":
    case "picture-entity":
    case "picture-elements":
      return makeWidget("image", {
        ...WIDGET_REGISTRY.image.defaultConfig,
        url: card.image || card.camera_image || "",
      });

    case "map":
      return makeWidget("ha-map", {
        ...WIDGET_REGISTRY["ha-map"].defaultConfig,
      });

    case "markdown":
      return makeWidget("text", {
        ...WIDGET_REGISTRY.text.defaultConfig,
        content: card.content || card.title || "",
      });

    case "todo-list":
    case "shopping-list":
      return makeWidget("tasks", {
        ...WIDGET_REGISTRY.tasks.defaultConfig,
      });

    case "history-graph":
    case "statistics-graph":
      return makeWidget("ha-graph", {
        ...WIDGET_REGISTRY["ha-graph"].defaultConfig,
        entityId: card.entity || getFirstEntity(card) || "",
      });

    case "camera":
    case "picture-glance":
      return makeWidget("ha-camera", {
        ...WIDGET_REGISTRY["ha-camera"].defaultConfig,
        entityId: card.entity || card.camera_image || "",
      });

    default:
      return null;
  }
}

// ── Helpers ─────────────────────────────────────────────────

function getFirstEntity(card: LovelaceCard): string {
  if (card.entities && Array.isArray(card.entities) && card.entities.length > 0) {
    const first = card.entities[0]!;
    return typeof first === "string" ? first : first.entity;
  }
  return "";
}

let idCounter = 0;
function generateId(): string {
  idCounter++;
  return `ha-${Date.now()}-${idCounter}`;
}

function makeWidget(
  type: WidgetInstance["type"],
  config: Record<string, unknown>
): WidgetInstance {
  return {
    id: generateId(),
    type,
    x: 0,
    y: 0,
    width: 4,
    height: 3,
    config,
  };
}
