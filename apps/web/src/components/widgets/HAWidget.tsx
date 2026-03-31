import { HAEntityWidget } from "./HAEntityWidget";
import { HAGaugeWidget } from "./HAGaugeWidget";
import { HAGraphWidget } from "./HAGraphWidget";
import { HACameraWidget } from "./HACameraWidget";
import { HAMapWidget } from "./HAMapWidget";
import type { WidgetStyle } from "../../stores/screensaver";

type HADisplayMode = "auto" | "entity" | "gauge" | "graph" | "camera" | "map";

const DOMAIN_DISPLAY_DEFAULTS: Record<string, HADisplayMode> = {
  sensor: "graph",
  camera: "camera",
  climate: "gauge",
  input_number: "gauge",
  fan: "gauge",
  person: "map",
  device_tracker: "map",
};

interface HAWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
  widgetId?: string;
}

export function HAWidget({ config, style, isBuilder, widgetId }: HAWidgetProps) {
  const entityId = (config.entityId as string) ?? "";
  const requestedMode = (config.displayMode as HADisplayMode) ?? "auto";

  // Resolve "auto" to actual mode
  const domain = entityId.split(".")[0] ?? "";
  const resolvedMode: HADisplayMode = requestedMode === "auto"
    ? (DOMAIN_DISPLAY_DEFAULTS[domain] ?? "entity")
    : requestedMode;

  const commonProps = { config, style, isBuilder, widgetId };

  switch (resolvedMode) {
    case "gauge":
      return <HAGaugeWidget {...commonProps} />;
    case "graph":
      return <HAGraphWidget {...commonProps} />;
    case "camera":
      return <HACameraWidget {...commonProps} />;
    case "map":
      return <HAMapWidget {...commonProps} />;
    case "entity":
    default:
      return <HAEntityWidget {...commonProps} />;
  }
}
