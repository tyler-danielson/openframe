import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Images } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import { useHAWebSocket } from "../../stores/homeassistant-ws";
import type { WidgetStyle } from "../../stores/screensaver";
import { cn } from "../../lib/utils";
import { useBlockControls } from "../../hooks/useBlockControls";
import { useWidgetStateReporter } from "../../hooks/useWidgetStateReporter";

interface PhotoAlbumWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
  widgetId?: string;
}

export interface Photo {
  id: string;
  url: string;
  width?: number;
  height?: number;
  title?: string;
}

type PhotoSource = "album" | "ha-camera" | "reddit" | "custom-url";
type Orientation = "all" | "landscape" | "portrait";
type Transition = "fade" | "slide" | "zoom" | "none";
type CropStyle = "fit" | "crop" | "zoom";
type SlideDirection = "left" | "right" | "up" | "down";

// Reddit photo presets
export const REDDIT_PRESETS = [
  { id: "EarthPorn", name: "Earth Porn", description: "Nature landscapes" },
  { id: "CityPorn", name: "City Porn", description: "Urban photography" },
  { id: "SpacePorn", name: "Space Porn", description: "Space & astronomy" },
  { id: "SkyPorn", name: "Sky Porn", description: "Sky & cloud photography" },
  { id: "WaterPorn", name: "Water Porn", description: "Ocean, lakes, rivers" },
  { id: "BotanicalPorn", name: "Botanical Porn", description: "Plants & flowers" },
  { id: "ArchitecturePorn", name: "Architecture Porn", description: "Buildings" },
  { id: "CozyPlaces", name: "Cozy Places", description: "Cozy interiors" },
  { id: "itookapicture", name: "I Took A Picture", description: "Photography" },
];

export function filterByOrientation(photos: Photo[], orientation: Orientation): Photo[] {
  if (orientation === "all") return photos;

  return photos.filter((photo) => {
    if (!photo.width || !photo.height) return true; // Include if dimensions unknown
    const isLandscape = photo.width > photo.height;
    return orientation === "landscape" ? isLandscape : !isLandscape;
  });
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = temp;
  }
  return shuffled;
}

export function PhotoAlbumWidget({ config, style, isBuilder, widgetId }: PhotoAlbumWidgetProps) {
  const source = (config.source as PhotoSource) ?? "album";
  const albumId = (config.albumId as string) ?? "";
  const entityId = (config.entityId as string) ?? "";
  const subreddit = (config.subreddit as string) ?? "EarthPorn";
  const customUrl = (config.customUrl as string) ?? "";
  const orientation = (config.orientation as Orientation) ?? "all";
  const interval = (config.interval as number) ?? 30;
  const intervalOffset = (config.intervalOffset as number) ?? 0;
  const transition = (config.transition as Transition) ?? "fade";
  const transitionDuration = (config.transitionDuration as number) ?? 1000;
  const cropStyle = (config.cropStyle as CropStyle) ?? "crop";
  const slideDirection = (config.slideDirection as SlideDirection) ?? "left";
  const shuffle = (config.shuffle as boolean) ?? true;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [preloadedImage, setPreloadedImage] = useState<string | null>(null);
  const slideTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { connected: haConnected } = useHAWebSocket();

  // Fetch photos from local album
  const { data: albumPhotos } = useQuery({
    queryKey: ["album-photos", albumId, orientation],
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
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch photos from Reddit
  const { data: redditPhotos } = useQuery({
    queryKey: ["reddit-photos", subreddit, orientation],
    queryFn: async () => {
      const response = await api.getRedditPhotos(subreddit, { orientation, limit: 50 });
      return response.photos;
    },
    enabled: source === "reddit" && !!subreddit && !isBuilder,
    staleTime: 15 * 60 * 1000, // 15 minutes
    retry: 2,
  });

  // HA Camera snapshot state
  const [cameraUrl, setCameraUrl] = useState<string | null>(null);

  // Fetch HA camera snapshots
  useEffect(() => {
    if (source !== "ha-camera" || !entityId || isBuilder) return;

    const fetchSnapshot = async () => {
      try {
        const blob = await api.getHomeAssistantCameraSnapshot(entityId);
        const url = URL.createObjectURL(blob);
        setCameraUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } catch (err) {
        console.error("Failed to fetch camera snapshot:", err);
      }
    };

    fetchSnapshot();
    const timer = setInterval(fetchSnapshot, interval * 1000);

    return () => {
      clearInterval(timer);
      if (cameraUrl) URL.revokeObjectURL(cameraUrl);
    };
  }, [source, entityId, interval, isBuilder]);

  // Update photos array when data changes
  useEffect(() => {
    let newPhotos: Photo[] = [];

    if (source === "album" && albumPhotos) {
      newPhotos = albumPhotos;
    } else if (source === "reddit" && redditPhotos) {
      newPhotos = redditPhotos;
    } else if (source === "custom-url" && customUrl) {
      newPhotos = [{ id: "custom", url: customUrl }];
    }

    // Filter by orientation
    newPhotos = filterByOrientation(newPhotos, orientation);

    // Shuffle if enabled
    if (shuffle && newPhotos.length > 1) {
      newPhotos = shuffleArray(newPhotos);
    }

    setPhotos(newPhotos);
    setCurrentIndex(0);
  }, [source, albumPhotos, redditPhotos, customUrl, orientation, shuffle]);

  // Preload next image
  const preloadNext = useCallback(() => {
    if (photos.length <= 1) return;
    const nextIndex = (currentIndex + 1) % photos.length;
    const nextPhoto = photos[nextIndex];
    if (nextPhoto) {
      const img = new Image();
      img.src = nextPhoto.url;
      setPreloadedImage(nextPhoto.url);
    }
  }, [photos, currentIndex]);

  // Advance to next photo
  const advancePhoto = useCallback(() => {
    if (photos.length <= 1) return;

    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % photos.length);
      setIsTransitioning(false);
      preloadNext();
    }, transitionDuration);
  }, [photos.length, transitionDuration, preloadNext]);

  // Go to previous photo
  const prevPhoto = useCallback(() => {
    if (photos.length <= 1) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
      setIsTransitioning(false);
    }, transitionDuration);
  }, [photos.length, transitionDuration]);

  // TV block navigation controls
  const blockControls = useMemo(() => {
    if (isBuilder || !widgetId) return null;
    return {
      actions: [
        { key: "right", label: "Next Photo", action: advancePhoto },
        { key: "left", label: "Previous Photo", action: prevPhoto },
      ],
      remoteActions: [
        { key: "next-photo", label: "Next Photo", execute: () => advancePhoto() },
        { key: "prev-photo", label: "Previous Photo", execute: () => prevPhoto() },
      ],
    };
  }, [isBuilder, widgetId, advancePhoto, prevPhoto]);
  useBlockControls(widgetId, blockControls);

  // Report state for companion app
  useWidgetStateReporter(
    isBuilder ? undefined : widgetId,
    "photo-album",
    useMemo(
      () => ({
        currentIndex,
        totalPhotos: photos.length,
        currentUrl: photos[currentIndex]?.url || null,
      }),
      [currentIndex, photos.length, photos[currentIndex]?.url]
    )
  );

  // Set up slideshow timer with offset support
  useEffect(() => {
    if (isBuilder || photos.length <= 1 || source === "ha-camera") return;

    // Clear any existing timer
    if (slideTimerRef.current) {
      clearInterval(slideTimerRef.current);
    }

    // Preload next image initially
    preloadNext();

    // Handle initial offset delay before starting the regular interval
    let offsetTimeoutId: ReturnType<typeof setTimeout> | null = null;

    const startInterval = () => {
      slideTimerRef.current = setInterval(advancePhoto, interval * 1000);
    };

    if (intervalOffset > 0) {
      // Wait for offset, then advance once and start regular interval
      offsetTimeoutId = setTimeout(() => {
        advancePhoto();
        startInterval();
      }, intervalOffset * 1000);
    } else {
      // No offset, start immediately
      startInterval();
    }

    return () => {
      if (offsetTimeoutId) {
        clearTimeout(offsetTimeoutId);
      }
      if (slideTimerRef.current) {
        clearInterval(slideTimerRef.current);
      }
    };
  }, [isBuilder, photos.length, interval, intervalOffset, advancePhoto, preloadNext, source]);

  // Get transition styles
  const getTransitionStyles = (): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      transition: transition === "none" ? "none" : `all ${transitionDuration}ms ease-in-out`,
    };

    if (transition === "fade") {
      return {
        ...baseStyle,
        opacity: isTransitioning ? 0 : 1,
      };
    }

    if (transition === "slide") {
      const slideTransforms: Record<SlideDirection, string> = {
        left: "translateX(-100%)",
        right: "translateX(100%)",
        up: "translateY(-100%)",
        down: "translateY(100%)",
      };
      return {
        ...baseStyle,
        transform: isTransitioning ? slideTransforms[slideDirection] : "translate(0, 0)",
      };
    }

    if (transition === "zoom") {
      return {
        ...baseStyle,
        transform: isTransitioning ? "scale(1.1)" : "scale(1)",
        opacity: isTransitioning ? 0 : 1,
      };
    }

    return baseStyle;
  };

  // Get crop style classes and styles
  const getCropStyles = (): { className: string; style?: React.CSSProperties } => {
    switch (cropStyle) {
      case "fit":
        return { className: "object-contain" };
      case "crop":
        return { className: "object-cover" };
      case "zoom":
        return { className: "object-cover", style: { transform: "scale(1.2)" } };
      default:
        return { className: "object-cover" };
    }
  };

  const cropStyles = getCropStyles();

  // Builder mode placeholder
  if (isBuilder) {
    const sourceLabel = {
      album: albumId ? "Local Album" : "Select Album",
      "ha-camera": entityId || "HA Camera",
      reddit: `r/${subreddit}`,
      "custom-url": customUrl ? "Custom URL" : "Set URL",
    }[source];

    return (
      <div
        className={cn(
          "flex h-full flex-col items-center justify-center p-4 rounded-lg",
          "bg-black/40 backdrop-blur-sm"
        )}
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <Images className="h-12 w-12 opacity-50 mb-2" />
        <span className="text-sm opacity-70">Photo Album</span>
        <span className="text-xs opacity-50 mt-1">{sourceLabel}</span>
      </div>
    );
  }

  // HA Camera mode
  if (source === "ha-camera") {
    if (!cameraUrl) {
      return (
        <div
          className="flex h-full items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
          style={{ color: style?.textColor || "#ffffff" }}
        >
          <span className="text-sm opacity-50">Loading camera...</span>
        </div>
      );
    }

    return (
      <div className="h-full w-full rounded-lg overflow-hidden bg-black/40">
        <img
          src={cameraUrl}
          alt={entityId}
          className={cn("w-full h-full", cropStyles.className)}
          style={cropStyles.style}
        />
      </div>
    );
  }

  // No photos state
  if (photos.length === 0) {
    const message = {
      album: !albumId ? "Select an album" : "No photos in album",
      reddit: "Loading photos...",
      "custom-url": "Enter image URL",
    }[source] || "No photos available";

    return (
      <div
        className={cn(
          "flex h-full flex-col items-center justify-center p-4 rounded-lg",
          "bg-black/40 backdrop-blur-sm"
        )}
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <Images className="h-12 w-12 opacity-50 mb-2" />
        <span className="text-sm opacity-70">{message}</span>
      </div>
    );
  }

  const currentPhoto = photos[currentIndex];

  // Merge crop styles with transition styles
  const mergedStyles: React.CSSProperties = {
    ...getTransitionStyles(),
  };
  // For zoom crop style, combine transforms
  if (cropStyles.style?.transform) {
    const transitionStyles = getTransitionStyles();
    if (transitionStyles.transform) {
      mergedStyles.transform = `${cropStyles.style.transform} ${transitionStyles.transform}`;
    } else {
      mergedStyles.transform = cropStyles.style.transform;
    }
  }

  return (
    <div className="h-full w-full rounded-lg overflow-hidden bg-black/40">
      <img
        src={currentPhoto?.url}
        alt={currentPhoto?.title || "Photo"}
        className={cn("w-full h-full", cropStyles.className)}
        style={mergedStyles}
        onError={(e) => {
          // Skip to next photo on error
          if (photos.length > 1) {
            setCurrentIndex((prev) => (prev + 1) % photos.length);
          }
        }}
      />
      {/* Hidden preload image */}
      {preloadedImage && (
        <img
          src={preloadedImage}
          alt=""
          className="hidden"
          aria-hidden="true"
        />
      )}
    </div>
  );
}
