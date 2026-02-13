import { useCallback } from "react";
import { Heart, Beer } from "lucide-react";
import type { WidgetStyle, FontSizePreset } from "../../stores/screensaver";
import { getFontSizeConfig } from "../../lib/font-size";
import { cn } from "../../lib/utils";

interface SupportWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
  widgetId?: string;
}

const FONT_SIZE_CLASSES: Record<Exclude<FontSizePreset, "custom">, string> = {
  xs: "text-[10px]",
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
  xl: "text-lg",
};

export function SupportWidget({ config, style, isBuilder }: SupportWidgetProps) {
  const buttonStyle = (config.buttonStyle as string) ?? "both";
  const label = (config.label as string) ?? "Buy me a beer";

  const { preset, isCustom, customValue } = getFontSizeConfig(style);
  const textClass = isCustom ? "" : FONT_SIZE_CLASSES[preset as Exclude<FontSizePreset, "custom">];

  const handleClick = useCallback(() => {
    if (isBuilder) return;
    window.open("https://buymeacoffee.com/pfro7xl", "_blank", "noopener,noreferrer");
  }, [isBuilder]);

  return (
    <button
      onClick={handleClick}
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
        <Heart
          className={cn(
            "h-10 w-10 fill-current",
            isBuilder ? "" : "animate-pulse-heart"
          )}
        />
      )}
      {(buttonStyle === "text" || buttonStyle === "both") && (
        <span
          className={cn(textClass, "opacity-80 flex items-center gap-1.5")}
          style={isCustom ? { fontSize: customValue } : undefined}
        >
          <Beer className="h-4 w-4 inline" />
          {label}
        </span>
      )}
    </button>
  );
}
