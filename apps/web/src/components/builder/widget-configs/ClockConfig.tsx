import type { WidgetConfigProps } from "./types";

export function ClockConfig({ config, onChange }: WidgetConfigProps) {
  const fmt24 = config.format24h as boolean ?? false;
  const showSec = config.showSeconds as boolean ?? false;
  // Build time format value from the two booleans
  const timeFormatVal = fmt24
    ? (showSec ? "HH:mm:ss" : "HH:mm")
    : (showSec ? "h:mm:ss" : "h:mm");
  const dateFormatVal = (config.showDate as boolean ?? true)
    ? (config.dateFormat as string || "full")
    : "disabled";
  return (
    <>
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-muted-foreground w-28 shrink-0">Time Format</span>
        <select
          value={timeFormatVal}
          onChange={(e) => {
            const v = e.target.value;
            onChange("format24h", v.startsWith("H"));
            onChange("showSeconds", v.includes("ss"));
          }}
          className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="h:mm">12-hour (1:30 PM)</option>
          <option value="h:mm:ss">12-hour with seconds (1:30:45 PM)</option>
          <option value="HH:mm">24-hour (13:30)</option>
          <option value="HH:mm:ss">24-hour with seconds (13:30:45)</option>
        </select>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-muted-foreground w-28 shrink-0">Date Format</span>
        <select
          value={dateFormatVal}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "disabled") {
              onChange("showDate", false);
            } else {
              onChange("showDate", true);
              onChange("dateFormat", v);
            }
          }}
          className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="disabled">Disabled (hide the date)</option>
          <option value="full">Full (Monday, March 24, 2026)</option>
          <option value="long">Long (March 24, 2026)</option>
          <option value="medium">Medium (Mar 24, 2026)</option>
          <option value="short">Short (3/24/26)</option>
        </select>
      </div>
    </>
  );
}
