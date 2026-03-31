import type { WidgetConfigProps } from "./types";

export function OceanTidesConfig(_props: WidgetConfigProps) {
  return (
    <p className="text-sm text-muted-foreground">
      Tide predictions are fetched from the nearest NOAA station to your configured location.
      Works best for US coastal areas. Make sure your location is set in Settings → System Settings → Home Location.
    </p>
  );
}
