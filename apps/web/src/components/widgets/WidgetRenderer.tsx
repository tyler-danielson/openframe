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
import { HAMapWidget } from "./HAMapWidget";
import { TextWidget } from "./TextWidget";
import { ImageWidget } from "./ImageWidget";
import { PhotoAlbumWidget } from "./PhotoAlbumWidget";
import { FullscreenToggleWidget } from "./FullscreenToggleWidget";
import { DayScheduleWidget } from "./DayScheduleWidget";
import { WeekScheduleWidget } from "./WeekScheduleWidget";
import { NewsWidget } from "./NewsWidget";
import { IptvWidget } from "./IptvWidget";
import { PhotoFeedWidget } from "./PhotoFeedWidget";
import { SupportWidget } from "./SupportWidget";

interface WidgetRendererProps {
  widget: WidgetInstance;
  isBuilder?: boolean;
  widgetId?: string;
}

export function WidgetRenderer({ widget, isBuilder = false, widgetId }: WidgetRendererProps) {
  const commonProps = {
    config: widget.config,
    style: widget.style,
    isBuilder,
    widgetId,
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
    case "ha-map":
      return <HAMapWidget {...commonProps} />;
    case "text":
      return <TextWidget {...commonProps} />;
    case "image":
      return <ImageWidget {...commonProps} />;
    case "photo-album":
      return <PhotoAlbumWidget {...commonProps} />;
    case "fullscreen-toggle":
      return <FullscreenToggleWidget {...commonProps} />;
    case "day-schedule":
      return <DayScheduleWidget {...commonProps} />;
    case "news":
      return <NewsWidget {...commonProps} />;
    case "iptv":
      return <IptvWidget {...commonProps} />;
    case "week-schedule":
      return <WeekScheduleWidget {...commonProps} />;
    case "photo-feed":
      return <PhotoFeedWidget {...commonProps} />;
    case "support":
      return <SupportWidget {...commonProps} />;
    default:
      return (
        <div className="flex h-full items-center justify-center bg-black/40 text-white/50 p-4">
          <span className="text-sm">Unknown widget type: {widget.type}</span>
        </div>
      );
  }
}
