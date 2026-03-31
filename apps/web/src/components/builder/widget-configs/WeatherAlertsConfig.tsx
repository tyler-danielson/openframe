import type { WidgetConfigProps } from "./types";

export function WeatherAlertsConfig(_props: WidgetConfigProps) {
  return (
    <p className="text-sm text-muted-foreground">
      Weather alerts are automatically fetched for your configured location.
      Make sure your location is set in Settings → System Settings → Home Location.
    </p>
  );
}
