import { useState, useEffect, useCallback } from "react";
import { Maximize, Minimize } from "lucide-react";
import type { WidgetStyle, FontSizePreset } from "../../stores/screensaver";
import { getFontSizeConfig } from "../../lib/font-size";
import { cn } from "../../lib/utils";

interface FullscreenToggleWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
  widgetId?: string;
}

const ICON_SIZE_CLASSES = {
  small: "h-6 w-6",
  medium: "h-10 w-10",
  large: "h-16 w-16",
};

const FONT_SIZE_CLASSES: Record<Exclude<FontSizePreset, "custom">, string> = {
  xs: "text-[10px]",
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
  xl: "text-lg",
};

export function FullscreenToggleWidget({ config, style, isBuilder }: FullscreenToggleWidgetProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const buttonStyle = (config.buttonStyle as string) ?? "icon";
  const label = (config.label as string) ?? "Fullscreen";
  const iconSize = (config.iconSize as string) ?? "medium";

  const { preset, isCustom, customValue } = getFontSizeConfig(style);
  const textClass = isCustom ? "" : FONT_SIZE_CLASSES[preset as Exclude<FontSizePreset, "custom">];
  const iconClass = ICON_SIZE_CLASSES[iconSize as keyof typeof ICON_SIZE_CLASSES] ?? ICON_SIZE_CLASSES.medium;

  // Check fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    handleFullscreenChange(); // Check initial state

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (isBuilder) return; // Don't toggle in builder mode

    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error("Error attempting to enable fullscreen:", err);
      });
    } else {
      document.exitFullscreen().catch((err) => {
        console.error("Error attempting to exit fullscreen:", err);
      });
    }
  }, [isBuilder]);

  const Icon = isFullscreen ? Minimize : Maximize;

  return (
    <button
      onClick={toggleFullscreen}
      className={cn(
        "flex h-full w-full flex-col items-center justify-center gap-2 p-4 rounded-lg",
        "bg-black/40 backdrop-blur-sm",
        "hover:bg-black/50 transition-colors",
        isBuilder && "cursor-default"
      )}
      style={{ color: style?.textColor || "#ffffff" }}
      disabled={isBuilder}
    >
      {(buttonStyle === "icon" || buttonStyle === "both") && (
        <Icon className={iconClass} />
      )}
      {(buttonStyle === "text" || buttonStyle === "both") && (
        <span
          className={cn(textClass, "opacity-80")}
          style={isCustom ? { fontSize: customValue } : undefined}
        >
          {isFullscreen ? "Exit Fullscreen" : label}
        </span>
      )}
    </button>
  );
}
