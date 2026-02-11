import { X, Maximize2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { CameraViewer } from "../cameras/CameraViewer";
import { CalendarWidget } from "../widgets/CalendarWidget";
import { HAMapWidget } from "../widgets/HAMapWidget";
import { SpotifyWidget } from "../widgets/SpotifyWidget";
import { PhotoAlbumWidget } from "../widgets/PhotoAlbumWidget";
import { WeatherWidget } from "../widgets/WeatherWidget";
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

      {/* Title overlay */}
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
    </div>
  );
}
