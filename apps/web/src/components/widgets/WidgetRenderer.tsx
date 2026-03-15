import { Component, type ReactNode } from "react";
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
import { YouTubeWidget } from "./YouTubeWidget";
import { PlexWidget } from "./PlexWidget";
import { PlexAmpWidget } from "./PlexAmpWidget";
import { AudiobookshelfWidget } from "./AudiobookshelfWidget";
import { PhotoFeedWidget } from "./PhotoFeedWidget";
import { SupportWidget } from "./SupportWidget";
import { CountdownHolderWidget } from "./CountdownHolderWidget";

// Per-widget ErrorBoundary to isolate crashes and identify the broken widget
class WidgetErrorBoundary extends Component<
  { widgetType: string; widgetId: string; children: ReactNode },
  { error: Error | null; errorInfo: { componentStack: string } | null }
> {
  constructor(props: { widgetType: string; widgetId: string; children: ReactNode }) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  override componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    this.setState({ error, errorInfo });
    console.error(`[Widget:${this.props.widgetType}:${this.props.widgetId}] Error:`, error.message);
    console.error(`[Widget:${this.props.widgetType}] Stack:`, errorInfo.componentStack);
  }

  override render() {
    if (this.state.error) {
      return (
        <div style={{
          display: "flex", flexDirection: "column", height: "100%", width: "100%",
          background: "#1a1a2e", color: "#e0e0e0", padding: "8px", overflow: "auto",
          fontFamily: "monospace", fontSize: "11px", borderRadius: "8px",
        }}>
          <div style={{ color: "#ff6b6b", fontWeight: "bold", marginBottom: "4px" }}>
            CRASH: {this.props.widgetType} ({this.props.widgetId})
          </div>
          <div style={{ color: "#ffd93d", marginBottom: "6px", whiteSpace: "pre-wrap", fontSize: "10px" }}>
            {this.state.error.message}
          </div>
          <div style={{ color: "#6bcb77", fontSize: "9px", marginBottom: "3px" }}>Component Stack:</div>
          <pre style={{
            background: "#0d1117", padding: "6px", borderRadius: "4px",
            whiteSpace: "pre-wrap", lineHeight: "1.4", fontSize: "9px",
            flex: 1, overflow: "auto", margin: 0,
          }}>
            {this.state.errorInfo?.componentStack || "N/A"}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

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

  let content: ReactNode;

  switch (widget.type) {
    case "clock":
      content = <ClockWidget {...commonProps} />;
      break;
    case "countdown":
      content = <CountdownWidget {...commonProps} />;
      break;
    case "weather":
      content = <WeatherWidget {...commonProps} />;
      break;
    case "forecast":
      content = <ForecastWidget {...commonProps} />;
      break;
    case "calendar":
      content = <CalendarWidget {...commonProps} />;
      break;
    case "up-next":
      content = <UpNextWidget {...commonProps} />;
      break;
    case "tasks":
      content = <TasksWidget {...commonProps} />;
      break;
    case "sports":
      content = <SportsWidget {...commonProps} />;
      break;
    case "spotify":
      content = <SpotifyWidget {...commonProps} />;
      break;
    case "ha-entity":
      content = <HAEntityWidget {...commonProps} />;
      break;
    case "ha-gauge":
      content = <HAGaugeWidget {...commonProps} />;
      break;
    case "ha-graph":
      content = <HAGraphWidget {...commonProps} />;
      break;
    case "ha-camera":
      content = <HACameraWidget {...commonProps} />;
      break;
    case "ha-map":
      content = <HAMapWidget {...commonProps} />;
      break;
    case "text":
      content = <TextWidget {...commonProps} />;
      break;
    case "image":
      content = <ImageWidget {...commonProps} />;
      break;
    case "photo-album":
      content = <PhotoAlbumWidget {...commonProps} />;
      break;
    case "fullscreen-toggle":
      content = <FullscreenToggleWidget {...commonProps} />;
      break;
    case "day-schedule":
      content = <DayScheduleWidget {...commonProps} />;
      break;
    case "news":
      content = <NewsWidget {...commonProps} />;
      break;
    case "iptv":
      content = <IptvWidget {...commonProps} />;
      break;
    case "youtube":
      content = <YouTubeWidget {...commonProps} />;
      break;
    case "plex":
      content = <PlexWidget {...commonProps} />;
      break;
    case "plexamp":
      content = <PlexAmpWidget {...commonProps} />;
      break;
    case "audiobookshelf":
      content = <AudiobookshelfWidget {...commonProps} />;
      break;
    case "week-schedule":
      content = <WeekScheduleWidget {...commonProps} />;
      break;
    case "photo-feed":
      content = <PhotoFeedWidget {...commonProps} />;
      break;
    case "support":
      content = <SupportWidget {...commonProps} />;
      break;
    case "countdown-holder":
      content = <CountdownHolderWidget {...commonProps} />;
      break;
    default:
      content = (
        <div className="flex h-full items-center justify-center bg-black/40 text-white/50 p-4">
          <span className="text-sm">Unknown widget type: {widget.type}</span>
        </div>
      );
  }

  return (
    <WidgetErrorBoundary widgetType={widget.type} widgetId={widget.id}>
      {content}
    </WidgetErrorBoundary>
  );
}
