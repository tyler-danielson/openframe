import { X, Maximize2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { CameraViewer } from "../cameras/CameraViewer";
import { CalendarWidget } from "../widgets/CalendarWidget";
import { HAMapWidget } from "../widgets/HAMapWidget";
import { SpotifyWidget } from "../widgets/SpotifyWidget";
import { PhotoAlbumWidget } from "../widgets/PhotoAlbumWidget";
import { WeatherWidget } from "../widgets/WeatherWidget";
import { IptvWidget } from "../widgets/IptvWidget";
import { YouTubeWidget } from "../widgets/YouTubeWidget";
import { HAEntityWidget } from "../widgets/HAEntityWidget";
import { HAGaugeWidget } from "../widgets/HAGaugeWidget";
import { HAGraphWidget } from "../widgets/HAGraphWidget";
import { HACameraWidget } from "../widgets/HACameraWidget";
import { ClockWidget } from "../widgets/ClockWidget";
import { ForecastWidget } from "../widgets/ForecastWidget";
import { UpNextWidget } from "../widgets/UpNextWidget";
import { TasksWidget } from "../widgets/TasksWidget";
import { SportsWidget } from "../widgets/SportsWidget";
import { NewsWidget } from "../widgets/NewsWidget";
import { DayScheduleWidget } from "../widgets/DayScheduleWidget";
import { WeekScheduleWidget } from "../widgets/WeekScheduleWidget";
import { CountdownWidget } from "../widgets/CountdownWidget";
import { TextWidget } from "../widgets/TextWidget";
import { PhotoFeedWidget } from "../widgets/PhotoFeedWidget";
import type { MultiViewItem as MultiViewItemType } from "./types";
import type { Camera } from "@openframe/shared";
import type { HACamera } from "../../services/api";

interface MultiViewItemProps {
  item: MultiViewItemType;
  onRemove: () => void;
  onFullscreen?: () => void;
  // Camera data for camera items
  standaloneCamera?: Camera;
  haCamera?: HACamera;
}

export function MultiViewItem({
  item,
  onRemove,
  onFullscreen,
  standaloneCamera,
  haCamera,
}: MultiViewItemProps) {
  const renderContent = () => {
    switch (item.type) {
      case "camera":
        if (item.config.cameraType === "standalone" && standaloneCamera) {
          return (
            <CameraViewer
              camera={standaloneCamera}
              type="standalone"
              onRemove={onRemove}
              onFullscreen={onFullscreen}
            />
          );
        }
        if (item.config.cameraType === "ha" && haCamera) {
          return (
            <CameraViewer
              camera={haCamera}
              type="ha"
              onRemove={onRemove}
              onFullscreen={onFullscreen}
            />
          );
        }
        return (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Camera not found
          </div>
        );

      case "map":
        return (
          <HAMapWidget
            config={{
              showZones: true,
              showDeviceNames: true,
              darkMode: true,
              autoFitBounds: true,
            }}
          />
        );

      case "media":
        return (
          <SpotifyWidget
            config={{
              showAlbumArt: true,
              showProgress: true,
              showArtist: true,
              headerMode: "default",
            }}
          />
        );

      case "calendar":
        return (
          <CalendarWidget
            config={{
              maxItems: 8,
              showTime: true,
              showCalendarName: false,
              calendarIds: item.config.calendarIds || [],
              showUpcomingOnly: true,
              hideBlankEvents: true,
              hideDuplicates: true,
              headerMode: "default",
            }}
          />
        );

      case "image":
        return (
          <PhotoAlbumWidget
            config={{
              source: item.config.source || "album",
              albumId: item.config.albumId,
              subreddit: item.config.subreddit || "EarthPorn",
              customUrl: item.config.customUrl,
              orientation: "all",
              interval: 30,
              transition: "fade",
              cropStyle: "crop",
              shuffle: true,
            }}
          />
        );

      case "weather":
        return (
          <WeatherWidget
            config={{
              showIcon: true,
              showDescription: true,
              showHumidity: true,
              showWind: true,
            }}
          />
        );

      case "iptv":
        return (
          <IptvWidget
            config={{
              channelId: item.config.channelId || "",
              showControls: true,
              autoPlay: true,
              muted: true,
            }}
          />
        );

      case "youtube":
        return (
          <YouTubeWidget
            config={{
              videoId: item.config.videoId || "",
              showControls: true,
              autoPlay: true,
              muted: true,
            }}
          />
        );

      case "ha-entity":
        return (
          <HAEntityWidget
            config={{
              entityId: item.config.entityId || "",
              showIcon: true,
              showName: true,
              showState: true,
              showLastChanged: false,
            }}
          />
        );

      case "ha-gauge":
        return (
          <HAGaugeWidget
            config={{
              entityId: item.config.entityId || "",
              min: item.config.min ?? 0,
              max: item.config.max ?? 100,
              unit: item.config.unit || "",
              showValue: true,
              showName: true,
              warningValue: item.config.warningValue ?? 70,
              criticalValue: item.config.criticalValue ?? 90,
            }}
          />
        );

      case "ha-graph":
        return (
          <HAGraphWidget
            config={{
              entityId: item.config.entityId || "",
              hours: item.config.hours ?? 24,
              showLabels: true,
              showGrid: true,
              lineColor: item.config.lineColor || "#3B82F6",
            }}
          />
        );

      case "ha-camera":
        return (
          <HACameraWidget
            config={{
              entityId: item.config.entityId || "",
              refreshInterval: item.config.refreshInterval ?? 10,
            }}
          />
        );

      case "clock":
        return (
          <ClockWidget
            config={{
              format: "12h",
              showSeconds: false,
              showDate: true,
            }}
          />
        );

      case "forecast":
        return (
          <ForecastWidget
            config={{
              days: 5,
              showHigh: true,
              showLow: true,
              showIcon: true,
            }}
          />
        );

      case "up-next":
        return (
          <UpNextWidget
            config={{
              maxItems: 3,
              showTime: true,
              showCalendarName: true,
              headerMode: "default",
            }}
          />
        );

      case "tasks":
        return (
          <TasksWidget
            config={{
              maxItems: 8,
              showCompleted: false,
              headerMode: "default",
            }}
          />
        );

      case "sports":
        return (
          <SportsWidget
            config={{
              showScores: true,
              showLogos: true,
              headerMode: "default",
            }}
          />
        );

      case "news":
        return (
          <NewsWidget
            config={{
              maxItems: 6,
              showImages: true,
              headerMode: "default",
            }}
          />
        );

      case "day-schedule":
        return (
          <DayScheduleWidget
            config={{
              showCurrentTime: true,
              hourRange: [6, 22],
              headerMode: "default",
            }}
          />
        );

      case "week-schedule":
        return (
          <WeekScheduleWidget
            config={{
              showCurrentTime: true,
              headerMode: "default",
            }}
          />
        );

      case "countdown":
        return (
          <CountdownWidget
            config={{
              targetDate: item.config.targetDate || "",
              label: item.config.label || "Countdown",
              showDays: true,
              showHours: true,
              showMinutes: true,
              showSeconds: true,
            }}
          />
        );

      case "text":
        return (
          <TextWidget
            config={{
              text: item.config.text || "",
              alignment: "center",
            }}
          />
        );

      case "photo-feed":
        return (
          <PhotoFeedWidget
            config={{
              source: item.config.source || "album",
              albumId: item.config.albumId,
              subreddit: item.config.subreddit || "EarthPorn",
              interval: 30,
              transition: "fade",
              cropStyle: "crop",
              shuffle: true,
            }}
          />
        );

      default:
        return (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Unknown view type
          </div>
        );
    }
  };

  // Camera type uses its own remove button via CameraViewer
  if (item.type === "camera") {
    return (
      <div className="h-full w-full rounded-lg overflow-hidden border border-border">
        {renderContent()}
      </div>
    );
  }

  // Other types need wrapper with remove/fullscreen buttons
  return (
    <div className="relative group h-full w-full rounded-lg overflow-hidden border border-border bg-card">
      {/* Content */}
      <div className="h-full w-full">{renderContent()}</div>

      {/* Remove button - shows on hover */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className={cn(
          "absolute top-2 right-2 z-20",
          "rounded-full p-1.5 bg-black/60 text-white/80",
          "hover:bg-red-500/80 hover:text-white",
          "opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        )}
        title="Remove from view"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Fullscreen button */}
      {onFullscreen && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFullscreen();
          }}
          className={cn(
            "absolute top-2 right-10 z-20",
            "rounded-full p-1.5 bg-black/60 text-white/80",
            "hover:bg-white/20 hover:text-white",
            "opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          )}
          title="Fullscreen"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      )}

      {/* Title overlay - skip for IPTV since it has its own channel name display */}
      {item.type !== "iptv" && (
        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 z-10 p-2",
            "bg-gradient-to-t from-black/70 to-transparent",
            "opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          )}
        >
          <span className="text-sm font-medium text-white drop-shadow truncate">
            {item.name}
          </span>
        </div>
      )}
    </div>
  );
}
