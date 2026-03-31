import type { WidgetConfigProps } from "./types";

export function SupportConfig({
  config,
  onChange,
}: WidgetConfigProps) {
  return (
    <p className="text-sm text-muted-foreground">No configuration options</p>
  );
}
