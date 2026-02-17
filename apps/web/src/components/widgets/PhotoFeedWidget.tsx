import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { LayoutGrid } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import type { WidgetStyle } from "../../stores/screensaver";
import { cn } from "../../lib/utils";
import {
  type Photo,
  filterByOrientation,
  shuffleArray,
} from "./PhotoAlbumWidget";
import { useBlockControls } from "../../hooks/useBlockControls";
import { useWidgetStateReporter } from "../../hooks/useWidgetStateReporter";

interface PhotoFeedWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
  widgetId?: string;
}

type PhotoSource = "album" | "reddit" | "custom-urls";
type FeedLayout = "grid" | "single";
type Orientation = "all" | "landscape" | "portrait";

export function PhotoFeedWidget({ config, style, isBuilder, widgetId }: PhotoFeedWidgetProps) {
  const source = (config.source as PhotoSource) ?? "reddit";
  const albumId = (config.albumId as string) ?? "";
  const subreddit = (config.subreddit as string) ?? "EarthPorn";
  const customUrls = (config.customUrls as string[]) ?? [];
  const layout = (config.layout as FeedLayout) ?? "grid";
  const numberOfImages = (config.numberOfImages as number) ?? 6;
  const refreshInterval = (config.refreshInterval as number) ?? 300;
  const orientation = (config.orientation as Orientation) ?? "all";
  const shuffle = (config.shuffle as boolean) ?? true;
  const gap = (config.gap as number) ?? 4;
  const showTitles = (config.showTitles as boolean) ?? false;
  const roundedCorners = (config.roundedCorners as boolean) ?? true;

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [offset, setOffset] = useState(0);
  const [fadeIn, setFadeIn] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch photos from local album
  const { data: albumPhotos } = useQuery({
    queryKey: ["photo-feed-album", albumId, orientation],
    queryFn: async () => {
      if (!albumId) return [];
      const photos = await api.getAlbumPhotos(albumId);
      return photos.map((p): Photo => ({
        id: p.id,
        url: p.mediumUrl || p.originalUrl,
        width: p.width ?? undefined,
        height: p.height ?? undefined,
      }));
    },
    enabled: source === "album" && !!albumId && !isBuilder,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch photos from Reddit
  const { data: redditPhotos } = useQuery({
    queryKey: ["photo-feed-reddit", subreddit, orientation],
    queryFn: async () => {
      const response = await api.getRedditPhotos(subreddit, { orientation, limit: 50 });
      return response.photos;
    },
    enabled: source === "reddit" && !!subreddit && !isBuilder,
    staleTime: 15 * 60 * 1000,
    retry: 2,
  });

  // Build photo pool when data changes
  useEffect(() => {
    let newPhotos: Photo[] = [];

    if (source === "album" && albumPhotos) {
      newPhotos = albumPhotos;
    } else if (source === "reddit" && redditPhotos) {
      newPhotos = redditPhotos;
    } else if (source === "custom-urls" && customUrls.length > 0) {
      newPhotos = customUrls.map((url, i) => ({
        id: `custom-${i}`,
        url,
      }));
    }

    newPhotos = filterByOrientation(newPhotos, orientation);

    if (shuffle && newPhotos.length > 1) {
      newPhotos = shuffleArray(newPhotos);
    }

    setPhotos(newPhotos);
    setOffset(0);
  }, [source, albumPhotos, redditPhotos, customUrls.length, orientation, shuffle]);

  // Cycle through photos at refresh interval
  const advance = useCallback(() => {
    if (photos.length <= numberOfImages && layout === "grid") return;
    if (photos.length <= 1 && layout === "single") return;

    setFadeIn(false);
    setTimeout(() => {
      setOffset((prev) => (prev + (layout === "single" ? 1 : numberOfImages)) % photos.length);
      setFadeIn(true);
    }, 300);
  }, [photos.length, numberOfImages, layout]);

  // Go to previous set of photos
  const goBack = useCallback(() => {
    if (photos.length <= 1) return;
    const step = layout === "single" ? 1 : numberOfImages;
    setFadeIn(false);
    setTimeout(() => {
      setOffset((prev) => (prev - step + photos.length) % photos.length);
      setFadeIn(true);
    }, 300);
  }, [photos.length, numberOfImages, layout]);

  // TV block navigation controls
  const blockControls = useMemo(() => {
    if (isBuilder || !widgetId) return null;
    return {
      actions: [
        { key: "right", label: "Next", action: advance },
        { key: "left", label: "Previous", action: goBack },
      ],
      remoteActions: [
        { key: "next-photo", label: "Next", execute: () => advance() },
        { key: "prev-photo", label: "Previous", execute: () => goBack() },
      ],
    };
  }, [isBuilder, widgetId, advance, goBack]);
  useBlockControls(widgetId, blockControls);

  // Report state for companion app
  useWidgetStateReporter(
    isBuilder ? undefined : widgetId,
    "photo-feed",
    useMemo(
      () => ({
        currentIndex: offset,
        totalPhotos: photos.length,
        currentUrl: photos[offset]?.url || null,
      }),
      [offset, photos.length, photos[offset]?.url]
    )
  );

  useEffect(() => {
    if (isBuilder || photos.length === 0) return;

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(advance, refreshInterval * 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isBuilder, photos.length, refreshInterval, advance]);

  // Calculate grid columns from number of images
  const gridCols = useMemo(() => {
    if (numberOfImages <= 2) return numberOfImages;
    if (numberOfImages <= 4) return 2;
    if (numberOfImages <= 9) return 3;
    if (numberOfImages <= 16) return 4;
    return 5;
  }, [numberOfImages]);

  // Get visible photos
  const visiblePhotos = photos.length > 0
    ? Array.from({ length: layout === "single" ? 1 : numberOfImages }, (_, i) =>
        photos[(offset + i) % photos.length]
      ).filter((p): p is Photo => !!p)
    : [];

  // Builder placeholder
  if (isBuilder) {
    const sourceLabel = {
      album: albumId ? "Local Album" : "Select Album",
      reddit: `r/${subreddit}`,
      "custom-urls": customUrls.length > 0 ? `${customUrls.length} URLs` : "Set URLs",
    }[source];

    return (
      <div
        className={cn(
          "flex h-full flex-col items-center justify-center p-4 rounded-lg",
          "bg-black/40 backdrop-blur-sm"
        )}
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <LayoutGrid className="h-12 w-12 opacity-50 mb-2" />
        <span className="text-sm opacity-70">Photo Feed</span>
        <span className="text-xs opacity-50 mt-1">
          {layout === "grid" ? `${numberOfImages} images` : "Single"} - {sourceLabel}
        </span>
      </div>
    );
  }

  // No photos state
  if (photos.length === 0) {
    const message = {
      album: !albumId ? "Select an album" : "No photos in album",
      reddit: "Loading photos...",
      "custom-urls": "Enter image URLs",
    }[source] || "No photos available";

    return (
      <div
        className={cn(
          "flex h-full flex-col items-center justify-center p-4 rounded-lg",
          "bg-black/40 backdrop-blur-sm"
        )}
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <LayoutGrid className="h-12 w-12 opacity-50 mb-2" />
        <span className="text-sm opacity-70">{message}</span>
      </div>
    );
  }

  // Single layout mode
  if (layout === "single") {
    const photo = visiblePhotos[0];
    if (!photo) return null;

    return (
      <div className={cn("h-full w-full overflow-hidden bg-black/40", roundedCorners && "rounded-lg")}>
        <img
          src={photo.url}
          alt={photo.title || "Photo"}
          className={cn(
            "w-full h-full object-cover transition-opacity duration-300",
            fadeIn ? "opacity-100" : "opacity-0"
          )}
          onError={() => advance()}
        />
        {showTitles && photo.title && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
            <span className="text-xs text-white/90 line-clamp-1">{photo.title}</span>
          </div>
        )}
      </div>
    );
  }

  // Grid layout mode
  return (
    <div
      className={cn("h-full w-full overflow-hidden bg-black/40", roundedCorners && "rounded-lg")}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
        gap: `${gap}px`,
        padding: `${gap}px`,
      }}
    >
      {visiblePhotos.map((photo, i) => (
        <div
          key={`${photo.id}-${i}`}
          className={cn(
            "relative overflow-hidden transition-opacity duration-300",
            roundedCorners && "rounded-md",
            fadeIn ? "opacity-100" : "opacity-0"
          )}
        >
          <img
            src={photo.url}
            alt={photo.title || "Photo"}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          {showTitles && photo.title && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1">
              <span className="text-[10px] text-white/90 line-clamp-1">{photo.title}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
