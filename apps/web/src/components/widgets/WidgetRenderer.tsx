import type { WidgetInstance } from "../../stores/screensaver";
import { ClockWidget } from "./ClockWidget";
import { CountdownWidget } from "./CountdownWidget";
import { WeatherWidget } from "./WeatherWidget";
import { ForecastWidget } from "./ForecastWidget";
import { CalendarWidget } from "./CalendarWidget";
import { UpNextWidget } from "./UpNextWidget";
import { TasksWidget } from "./TasksWidget";
import { SportsWidget } from "./SportsWidget";
import { SpotifyWidget } from "./SpotifyWidget";
import { HAEntityWidget } from "./HAEntityWidget";
import { HAGaugeWidget } from "./HAGaugeWidget";
import { HAGraphWidget } from "./HAGraphWidget";
import { HACameraWidget } from "./HACameraWidget";
import { TextWidget } from "./TextWidget";
import { ImageWidget } from "./ImageWidget";
import { PhotoAlbumWidget } from "./PhotoAlbumWidget";

interface WidgetRendererProps {
  widget: WidgetInstance;
  isBuilder?: boolean;
}

export function WidgetRenderer({ widget, isBuilder = false }: WidgetRendererProps) {
  const commonProps = {
    config: widget.config,
    style: widget.style,
    isBuilder,
  };

  switch (widget.type) {
    case "clock":
      return <ClockWidget {...commonProps} />;
    case "countdown":
      return <CountdownWidget {...commonProps} />;
    case "weather":
      return <WeatherWidget {...commonProps} />;
    case "forecast":
      return <ForecastWidget {...commonProps} />;
    case "calendar":
      return <CalendarWidget {...commonProps} />;
    case "up-next":
      return <UpNextWidget {...commonProps} />;
    case "tasks":
      return <TasksWidget {...commonProps} />;
    case "sports":
      return <SportsWidget {...commonProps} />;
    case "spotify":
      return <SpotifyWidget {...commonProps} />;
    case "ha-entity":
      return <HAEntityWidget {...commonProps} />;
    case "ha-gauge":
      return <HAGaugeWidget {...commonProps} />;
    case "ha-graph":
      return <HAGraphWidget {...commonProps} />;
    case "ha-camera":
      return <HACameraWidget {...commonProps} />;
    case "text":
      return <TextWidget {...commonProps} />;
    case "image":
      return <ImageWidget {...commonProps} />;
    case "photo-album":
      return <PhotoAlbumWidget {...commonProps} />;
    default:
      return (
        <div className="flex h-full items-center justify-center bg-black/40 text-white/50 p-4">
          <span className="text-sm">Unknown widget type: {widget.type}</span>
        </div>
      );
  }
}
