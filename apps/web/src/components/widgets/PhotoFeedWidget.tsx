import type { WidgetStyle } from "../../stores/screensaver";

interface PhotoFeedWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
}

export function PhotoFeedWidget({ config, style, isBuilder }: PhotoFeedWidgetProps) {
  return (
    <div className="flex h-full items-center justify-center text-white/50 p-4">
      <span className="text-sm">Photo Feed</span>
    </div>
  );
}
