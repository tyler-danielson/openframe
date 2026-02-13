import type { WidgetStyle } from "../../stores/screensaver";

interface WeekScheduleWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
}

export function WeekScheduleWidget({ config, style, isBuilder }: WeekScheduleWidgetProps) {
  return (
    <div className="flex h-full items-center justify-center text-white/50 p-4">
      <span className="text-sm">Week Schedule</span>
    </div>
  );
}
