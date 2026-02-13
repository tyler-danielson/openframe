import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { api, type WeatherData } from "../services/api";
import { useScreensaverStore, type ScreensaverTransition, type ClockPosition, type ClockSize, type WidgetSize, type CompositeWidgetConfig } from "../stores/screensaver";
import { useAuthStore } from "../stores/auth";
import { SportsTicker } from "./SportsTicker";
import { WidgetRenderer } from "./widgets/WidgetRenderer";
import { BlockNavOverlay } from "./BlockNavOverlay";
import { isWidgetVisible } from "../lib/widget-visibility";
import { useBlockNavStore, type NavigableBlock } from "../stores/block-nav";
import type { SportsGame, CalendarEvent, Calendar, Task } from "@openframe/shared";

// Orientation detection helpers
const isLandscape = (photo: Photo) => (photo.width ?? 0) > (photo.height ?? 0);
const isPortrait = (photo: Photo) => (photo.height ?? 0) >= (photo.width ?? 0);

// Find the next photo matching a predicate, excluding certain indices
const findNextPhotoOfType = (
  photos: Photo[],
  startIndex: number,
  predicate: (p: Photo) => boolean,
  excludeIndices: Set<number>
): { photo: Photo; index: number } | undefined => {
  for (let i = 0; i < photos.length; i++) {
    const idx = (startIndex + i) % photos.length;
    const photo = photos[idx];
    if (photo && predicate(photo) && !excludeIndices.has(idx)) {
      return { photo, index: idx };
    }
  }
  return undefined;
};

// Weather icon mapping from OpenWeatherMap codes
const getWeatherIcon = (iconCode: string): string => {
  const iconMap: Record<string, string> = {
    "01d": "☀️", // clear sky day
    "01n": "🌙", // clear sky night
    "02d": "⛅", // few clouds day
    "02n": "☁️", // few clouds night
    "03d": "☁️", // scattered clouds
    "03n": "☁️",
    "04d": "☁️", // broken clouds
    "04n": "☁️",
    "09d": "🌧️", // shower rain
    "09n": "🌧️",
    "10d": "🌦️", // rain day
    "10n": "🌧️", // rain night
    "11d": "⛈️", // thunderstorm
    "11n": "⛈️",
    "13d": "❄️", // snow
    "13n": "❄️",
    "50d": "🌫️", // mist
    "50n": "🌫️",
  };
  return iconMap[iconCode] || "🌡️";
};

interface Photo {
  id: string;
  url: string;
  width?: number;
  height?: number;
}

interface ScatterPhoto extends Photo {
  x: number;
  y: number;
  rotation: number;
  scale: number;
  zIndex: number;
}

// Transition class mappings
const getTransitionClasses = (transition: ScreensaverTransition, isEntering: boolean) => {
  const baseClasses = "absolute inset-0 flex items-center justify-center transition-all duration-700 ease-in-out";

  switch (transition) {
    case "fade":
      return `${baseClasses} ${isEntering ? "opacity-100" : "opacity-0"}`;
    case "slide-left":
      return `${baseClasses} ${isEntering ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}`;
    case "slide-right":
      return `${baseClasses} ${isEntering ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0"}`;
    case "slide-up":
      return `${baseClasses} ${isEntering ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"}`;
    case "slide-down":
      return `${baseClasses} ${isEntering ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"}`;
    case "zoom":
      return `${baseClasses} ${isEntering ? "scale-100 opacity-100" : "scale-110 opacity-0"}`;
    default:
      return `${baseClasses} ${isEntering ? "opacity-100" : "opacity-0"}`;
  }
};

// Get CSS classes for clock position
const getClockPositionClasses = (position: ClockPosition): string => {
  switch (position) {
    case "top-left":
      return "top-2 left-3";
    case "top-center":
      return "top-2 left-1/2 -translate-x-1/2";
    case "top-right":
      return "top-2 right-3";
    case "bottom-left":
      return "bottom-10 left-3";
    case "bottom-center":
      return "bottom-10 left-1/2 -translate-x-1/2";
    case "bottom-right":
      return "bottom-10 right-3";
    default:
      return "top-2 right-3";
  }
};

// Get CSS classes for clock size
const getClockSizeClasses = (size: ClockSize): { time: string; date: string; weather: string; weatherIcon: string; container: string } => {
  switch (size) {
    case "small":
      return {
        container: "px-4 py-2",
        time: "text-2xl",
        date: "text-xs",
        weather: "text-lg",
        weatherIcon: "text-xl",
      };
    case "medium":
      return {
        container: "px-6 py-4",
        time: "text-4xl",
        date: "text-sm",
        weather: "text-2xl",
        weatherIcon: "text-3xl",
      };
    case "large":
      return {
        container: "px-8 py-6",
        time: "text-6xl",
        date: "text-lg",
        weather: "text-3xl",
        weatherIcon: "text-4xl",
      };
    case "extra-large":
      return {
        container: "px-10 py-8",
        time: "text-8xl",
        date: "text-xl",
        weather: "text-4xl",
        weatherIcon: "text-5xl",
      };
    default:
      return {
        container: "px-6 py-4",
        time: "text-4xl",
        date: "text-sm",
        weather: "text-2xl",
        weatherIcon: "text-3xl",
      };
  }
};

// Get CSS classes for widget size (info pane widgets)
const getWidgetSizeClasses = (size: WidgetSize) => {
  switch (size) {
    case "small":
      return {
        title: "text-xs",
        value: "text-lg",
        item: "text-xs",
        gap: "gap-1",
        icon: "text-xl",
        sectionLabel: "text-[10px]",
      };
    case "medium":
      return {
        title: "text-base",
        value: "text-2xl",
        item: "text-sm",
        gap: "gap-2",
        icon: "text-2xl",
        sectionLabel: "text-xs",
      };
    case "large":
      return {
        title: "text-lg",
        value: "text-4xl",
        item: "text-base",
        gap: "gap-3",
        icon: "text-3xl",
        sectionLabel: "text-sm",
      };
    default:
      return {
        title: "text-base",
        value: "text-2xl",
        item: "text-sm",
        gap: "gap-2",
        icon: "text-2xl",
        sectionLabel: "text-xs",
      };
  }
};

// Calculate the current dim opacity based on time and fade duration
// Returns a value from 0 to maxOpacity
const calculateDimOpacity = (
  startHour: number,
  endHour: number,
  fadeDuration: number, // in minutes
  maxOpacity: number
): number => {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeInMinutes = currentHour * 60 + currentMinute;
  const startTimeInMinutes = startHour * 60;
  const endTimeInMinutes = endHour * 60;

  // Handle overnight ranges (e.g., 9 PM to 7 AM)
  const isOvernightRange = startHour >= endHour;

  let isInDimPeriod = false;
  let minutesSinceStart = 0;

  if (isOvernightRange) {
    // Overnight range (e.g., 21:00 to 07:00)
    if (currentTimeInMinutes >= startTimeInMinutes) {
      // After start time on the same day
      isInDimPeriod = true;
      minutesSinceStart = currentTimeInMinutes - startTimeInMinutes;
    } else if (currentTimeInMinutes < endTimeInMinutes) {
      // Before end time on the next day
      isInDimPeriod = true;
      minutesSinceStart = (24 * 60 - startTimeInMinutes) + currentTimeInMinutes;
    }
  } else {
    // Simple range (e.g., 9 AM to 5 PM)
    if (currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes < endTimeInMinutes) {
      isInDimPeriod = true;
      minutesSinceStart = currentTimeInMinutes - startTimeInMinutes;
    }
  }

  if (!isInDimPeriod) {
    return 0;
  }

  // Calculate fade progress (0 to 1)
  if (fadeDuration <= 0) {
    return maxOpacity;
  }

  const fadeProgress = Math.min(minutesSinceStart / fadeDuration, 1);
  return fadeProgress * maxOpacity;
};

interface ScreensaverProps {
  alwaysActive?: boolean;
  inline?: boolean;
  displayType?: "touch" | "tv" | "display";
}

export function Screensaver({ alwaysActive = false, inline = false, displayType }: ScreensaverProps) {
  const {
    isActive: storeIsActive,
    slideInterval,
    layout,
    transition,
    updateActivity,
    nightDimEnabled,
    nightDimStartHour,
    nightDimEndHour,
    nightDimOpacity,
    nightDimFadeDuration,
    clockPosition,
    clockSize,
    compositeWidgetConfigs,
    widgetGridSize,
    layoutConfig,
  } = useScreensaverStore();

  // If alwaysActive or inline is true, the screensaver is always shown and cannot be dismissed
  const isActive = alwaysActive || inline || storeIsActive;

  const kioskEnabled = useAuthStore((state) => state.kioskEnabled);

  // Block navigation state for TV display
  const blockNavMode = useBlockNavStore((s) => s.mode);
  const focusedBlockId = useBlockNavStore((s) => s.focusedBlockId);
  const registerBlocks = useBlockNavStore((s) => s.registerBlocks);
  const clearBlocks = useBlockNavStore((s) => s.clearBlocks);

  // Register builder widgets as navigable blocks when on TV display
  useEffect(() => {
    console.log("[BlockNav] Screensaver registration check:", { displayType, layout, isActive, widgetCount: layoutConfig?.widgets?.length });
    if (displayType !== "tv" || layout !== "builder" || !isActive) {
      // Only clear blocks if we previously registered them (don't clobber dashboard blocks)
      return;
    }
    const visibleWidgets = (layoutConfig?.widgets || []).filter((w) => isWidgetVisible(w));
    if (visibleWidgets.length === 0) {
      clearBlocks("page");
      return;
    }
    const navBlocks: NavigableBlock[] = visibleWidgets.map((w) => ({
      id: w.id,
      x: w.x,
      y: w.y,
      width: w.width,
      height: w.height,
      label: w.type.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    }));
    console.log("[BlockNav] Registered", navBlocks.length, "blocks");
    registerBlocks(navBlocks, "page");
    return () => clearBlocks("page");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayType, layout, isActive, layoutConfig?.widgets?.length]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState<number | null>(null);
  const [scatterPhotos, setScatterPhotos] = useState<ScatterPhoto[]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentDimOpacity, setCurrentDimOpacity] = useState(0);

  // Track used photos for informational layout orientation pairing
  const usedLandscapeIndices = useRef<Set<number>>(new Set());
  const usedPortraitIndices = useRef<Set<number>>(new Set());
  // Store current informational layout photos separately for staggered transitions
  const [portraitPhoto, setPortraitPhoto] = useState<Photo | null>(null);
  const [landscapePhoto, setLandscapePhoto] = useState<Photo | null>(null);
  const [prevPortraitPhoto, setPrevPortraitPhoto] = useState<Photo | null>(null);
  const [prevLandscapePhoto, setPrevLandscapePhoto] = useState<Photo | null>(null);
  // Track which side is currently transitioning
  const [transitioningSide, setTransitioningSide] = useState<'left' | 'right' | null>(null);
  // Track which side to update next (alternates between left/right)
  const nextSideToUpdate = useRef<'left' | 'right'>('left');

  // Calculate dim opacity based on current time and fade duration
  useEffect(() => {
    if (!isActive || !nightDimEnabled) {
      setCurrentDimOpacity(0);
      return;
    }

    const updateDimOpacity = () => {
      const opacity = calculateDimOpacity(
        nightDimStartHour,
        nightDimEndHour,
        nightDimFadeDuration,
        nightDimOpacity
      );
      setCurrentDimOpacity(opacity);
    };

    updateDimOpacity();
    // Update every 10 seconds for smooth fade
    const interval = setInterval(updateDimOpacity, 10000);

    return () => clearInterval(interval);
  }, [isActive, nightDimEnabled, nightDimStartHour, nightDimEndHour, nightDimOpacity, nightDimFadeDuration, currentTime]);

  // Fetch photos from local storage (all photos are now stored locally)
  const { data: slideshowData } = useQuery({
    queryKey: ["slideshow"],
    queryFn: () => api.getSlideshow(),
    enabled: isActive,
    staleTime: 1 * 60 * 1000, // Cache for 1 minute
    refetchOnMount: "always", // Always refetch when screensaver activates
  });

  const photos = slideshowData?.photos ?? [];

  // Fetch weather data
  const { data: weather } = useQuery({
    queryKey: ["screensaver-weather"],
    queryFn: () => api.getCurrentWeather(),
    enabled: isActive,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    refetchInterval: 10 * 60 * 1000, // Refresh every 10 minutes
    retry: false, // Don't retry if weather API isn't configured
  });

  // Fetch today's sports games (scheduled, live, and finished)
  const { data: todaysGames = [] } = useQuery({
    queryKey: ["screensaver-todays-sports"],
    queryFn: () => api.getTodaySportsScores(),
    enabled: isActive,
    refetchInterval: (query) => {
      // Smart polling: 30s if there are live games, 5 min otherwise
      const games = query.state.data as SportsGame[] | undefined;
      const hasLiveGames = games?.some(
        (g) => g.status === "in_progress" || g.status === "halftime"
      );
      return hasLiveGames ? 30 * 1000 : 5 * 60 * 1000;
    },
    staleTime: 15 * 1000,
    retry: false,
  });

  // Fetch calendars for visibility filtering
  const { data: calendars = [] } = useQuery({
    queryKey: ["screensaver-calendars"],
    queryFn: () => api.getCalendars(),
    enabled: isActive,
    staleTime: 5 * 60 * 1000,
  });

  // Get calendar IDs that have screensaver visibility enabled
  const screensaverCalendarIds = useMemo(() => {
    return calendars
      .filter((cal: Calendar) => cal.isVisible && (cal.visibility?.screensaver ?? false))
      .map((cal: Calendar) => cal.id);
  }, [calendars]);

  // Fetch today's events
  const { data: todaysEvents = [] } = useQuery({
    queryKey: ["screensaver-events", screensaverCalendarIds],
    queryFn: async () => {
      if (screensaverCalendarIds.length === 0) return [];
      const today = new Date();
      const start = new Date(today);
      start.setHours(0, 0, 0, 0);
      const end = new Date(today);
      end.setHours(23, 59, 59, 999);
      return api.getEvents(start, end, screensaverCalendarIds);
    },
    enabled: isActive && screensaverCalendarIds.length > 0,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  // Sort events by start time and get upcoming ones
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return [...todaysEvents]
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .filter((event) => new Date(event.endTime) > now) // Only show events that haven't ended
      .slice(0, 3); // Show max 3 events
  }, [todaysEvents]);

  // Fetch tasks for info pane
  const scheduleWidget = compositeWidgetConfigs.find((c) => c.id === "schedule");
  const tasksSubItemEnabled = scheduleWidget?.enabled && (scheduleWidget?.subItems?.tasks?.enabled ?? true);
  const { data: tasks = [] } = useQuery({
    queryKey: ["screensaver-tasks"],
    queryFn: () => api.getTasks({ status: "needsAction" }),
    enabled: isActive && tasksSubItemEnabled,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  // Get upcoming tasks (due today or overdue)
  const upcomingTasks = useMemo(() => {
    const now = new Date();
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    return tasks
      .filter((task: Task) => {
        if (!task.dueDate) return false;
        const dueDate = new Date(task.dueDate);
        return dueDate <= endOfToday;
      })
      .sort((a: Task, b: Task) => {
        const aDate = new Date(a.dueDate!);
        const bDate = new Date(b.dueDate!);
        return aDate.getTime() - bDate.getTime();
      })
      .slice(0, 3);
  }, [tasks]);

  // Note: Spotify/Now Playing removed from screensaver - use SpotifyWidget in builder layout instead

  // Handle user interaction to exit screensaver
  // Stop propagation to prevent clicks from reaching underlying elements
  // If alwaysActive is true, don't allow dismissal
  // Display-only kiosks should never allow dismissal
  const noDismiss = alwaysActive || inline || displayType === "display";

  const handleInteraction = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!noDismiss) {
      updateActivity();
    }
  }, [updateActivity, noDismiss]);

  // Listen for any interaction to exit screensaver
  useEffect(() => {
    // Don't set up dismissal listeners if dismissal is disabled
    if (!isActive || noDismiss) return;

    // Simple handler that just updates activity - no preventDefault needed
    const onInteraction = () => {
      updateActivity();
    };

    // In kiosk mode, only respond to clicks/taps, not mouse movement
    const events = kioskEnabled
      ? ["mousedown", "keydown", "touchstart"]
      : ["mousedown", "mousemove", "keydown", "touchstart", "wheel"];
    events.forEach((event) => {
      window.addEventListener(event, onInteraction, { passive: true });
    });

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, onInteraction);
      });
    };
  }, [isActive, updateActivity, kioskEnabled, noDismiss]);

  // Enter fullscreen when screensaver activates, exit when it deactivates
  // In kiosk mode, don't auto-enter fullscreen - only use fullscreen if already in it
  // In inline mode, don't toggle fullscreen at all
  useEffect(() => {
    if (inline) return;
    if (isActive) {
      // Request fullscreen when screensaver becomes active (skip in kiosk mode)
      if (!kioskEnabled && document.documentElement.requestFullscreen && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {
          // Fullscreen request may fail if not triggered by user gesture
          // This is expected behavior - silently ignore
        });
      }
    } else {
      // Exit fullscreen when screensaver becomes inactive (only if not in kiosk mode)
      // In kiosk mode, maintain whatever fullscreen state the user had
      if (!kioskEnabled && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {
          // May fail if already exited - silently ignore
        });
      }
    }
  }, [isActive, kioskEnabled, inline]);

  // Update clock every second
  useEffect(() => {
    if (!isActive) return;

    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive]);

  // Select next portrait photo (for left side)
  const selectNextPortrait = useCallback(() => {
    if (photos.length === 0) return null;

    const portraitPhotos = photos.filter(isPortrait);
    const landscapePhotos = photos.filter(isLandscape);

    // Reset tracking if all photos have been used
    if (usedPortraitIndices.current.size >= portraitPhotos.length) {
      usedPortraitIndices.current.clear();
    }

    // Find next portrait photo
    let result = findNextPhotoOfType(
      photos,
      currentIndex,
      isPortrait,
      usedPortraitIndices.current
    );

    // Fallback to landscape if no portraits available
    if (!result && landscapePhotos.length > 0) {
      if (usedLandscapeIndices.current.size >= landscapePhotos.length) {
        usedLandscapeIndices.current.clear();
      }
      result = findNextPhotoOfType(
        photos,
        currentIndex,
        isLandscape,
        usedLandscapeIndices.current
      );
      if (result) usedLandscapeIndices.current.add(result.index);
    } else if (result) {
      usedPortraitIndices.current.add(result.index);
    }

    return result?.photo ?? null;
  }, [photos, currentIndex]);

  // Select next landscape photo (for right side)
  const selectNextLandscape = useCallback(() => {
    if (photos.length === 0) return null;

    const landscapePhotos = photos.filter(isLandscape);
    const portraitPhotos = photos.filter(isPortrait);

    // Reset tracking if all photos have been used
    if (usedLandscapeIndices.current.size >= landscapePhotos.length) {
      usedLandscapeIndices.current.clear();
    }

    // Find next landscape photo
    let result = findNextPhotoOfType(
      photos,
      currentIndex,
      isLandscape,
      usedLandscapeIndices.current
    );

    // Fallback to portrait if no landscapes available
    if (!result && portraitPhotos.length > 0) {
      if (usedPortraitIndices.current.size >= portraitPhotos.length) {
        usedPortraitIndices.current.clear();
      }
      result = findNextPhotoOfType(
        photos,
        currentIndex,
        isPortrait,
        usedPortraitIndices.current
      );
      if (result) usedPortraitIndices.current.add(result.index);
    } else if (result) {
      usedLandscapeIndices.current.add(result.index);
    }

    return result?.photo ?? null;
  }, [photos, currentIndex]);

  // Initialize informational photos on mount and when photos change
  useEffect(() => {
    if (layout === "informational" && photos.length > 0) {
      // Initialize portrait photo if missing
      if (!portraitPhoto) {
        setPortraitPhoto(selectNextPortrait());
      }
      // Initialize landscape photo if missing
      if (!landscapePhoto) {
        setLandscapePhoto(selectNextLandscape());
      }
    }
  }, [layout, photos, portraitPhoto, landscapePhoto, selectNextPortrait, selectNextLandscape]);

  // Cycle through photos
  useEffect(() => {
    if (!isActive || photos.length === 0) return;

    const interval = setInterval(() => {
      if (layout === "scatter") {
        // Add a new photo to the scatter
        const photo = photos[Math.floor(Math.random() * photos.length)];
        if (photo) {
          const newScatterPhoto: ScatterPhoto = {
            id: photo.id,
            url: photo.url,
            width: photo.width,
            height: photo.height,
            x: Math.random() * 80 + 5, // 5-85% from left
            y: Math.random() * 70 + 10, // 10-80% from top
            rotation: (Math.random() - 0.5) * 30, // -15 to +15 degrees
            scale: 0.15 + Math.random() * 0.15, // 15-30% of screen
            zIndex: Date.now(),
          };
          setScatterPhotos((prev) => {
            // Keep last 20 photos
            const updated = [...prev, newScatterPhoto];
            return updated.slice(-20);
          });
        }
      } else if (layout === "informational") {
        // Alternating transitions: left (portrait) then right (landscape)
        const side = nextSideToUpdate.current;

        // Start transition for the current side
        setTransitioningSide(side);

        if (side === 'left') {
          setPrevPortraitPhoto(portraitPhoto);
          // Small delay before changing photo so the exit animation starts
          setTimeout(() => {
            setPortraitPhoto(selectNextPortrait());
            setCurrentIndex((prev) => (prev + 1) % photos.length);
          }, 50);
        } else {
          setPrevLandscapePhoto(landscapePhoto);
          setTimeout(() => {
            setLandscapePhoto(selectNextLandscape());
            setCurrentIndex((prev) => (prev + 1) % photos.length);
          }, 50);
        }

        // End transition after animation completes
        setTimeout(() => {
          setTransitioningSide(null);
          if (side === 'left') {
            setPrevPortraitPhoto(null);
          } else {
            setPrevLandscapePhoto(null);
          }
        }, 750);

        // Alternate to the other side for next time
        nextSideToUpdate.current = side === 'left' ? 'right' : 'left';
      } else {
        // Start transition
        setIsTransitioning(true);
        setPrevIndex(currentIndex);

        // Small delay before changing index so the exit animation starts
        setTimeout(() => {
          setCurrentIndex((prev) => (prev + 1) % photos.length);
        }, 50);

        // End transition after animation completes
        setTimeout(() => {
          setIsTransitioning(false);
          setPrevIndex(null);
        }, 750);
      }
    }, (layout === "informational" ? slideInterval / 2 : slideInterval) * 1000);

    return () => clearInterval(interval);
  }, [isActive, photos.length, slideInterval, layout, currentIndex, portraitPhoto, landscapePhoto, selectNextPortrait, selectNextLandscape]);

  // Reset scatter photos and informational layout tracking when layout changes
  useEffect(() => {
    if (layout !== "scatter") {
      setScatterPhotos([]);
    }
    if (layout !== "informational") {
      usedLandscapeIndices.current.clear();
      usedPortraitIndices.current.clear();
      setPortraitPhoto(null);
      setLandscapePhoto(null);
      setPrevPortraitPhoto(null);
      setPrevLandscapePhoto(null);
      setTransitioningSide(null);
      nextSideToUpdate.current = 'left';
    }
  }, [layout]);

  if (!isActive) return null;

  // Get photos for a specific index
  const getPhotosForIndex = (index: number): Photo[] => {
    if (photos.length === 0) return [];

    const getPhoto = (idx: number): Photo | undefined => photos[idx % photos.length];

    switch (layout) {
      case "fullscreen": {
        const photo = getPhoto(index);
        return photo ? [photo] : [];
      }
      case "informational": {
        return [getPhoto(index), getPhoto(index + 1)].filter((p): p is Photo => !!p);
      }
      case "quad": {
        return [
          getPhoto(index),
          getPhoto(index + 1),
          getPhoto(index + 2),
          getPhoto(index + 3),
        ].filter((p): p is Photo => !!p);
      }
      case "scatter":
        return []; // Handled separately
      default: {
        const photo = getPhoto(index);
        return photo ? [photo] : [];
      }
    }
  };

  const displayPhotos = getPhotosForIndex(currentIndex);
  const prevDisplayPhotos = prevIndex !== null ? getPhotosForIndex(prevIndex) : [];

  // ============ Composite Widget Render Functions ============

  // Render the Clock composite widget
  const renderClockCompositeWidget = (config: CompositeWidgetConfig, isFirst: boolean) => {
    const borderClass = isFirst ? "" : "pt-3 border-t border-white/20";
    const sizeClasses = getWidgetSizeClasses(config.size);
    const showSeconds = config.size === "large";
    const timeFormat: Intl.DateTimeFormatOptions = showSeconds
      ? { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }
      : { hour: 'numeric', minute: '2-digit', hour12: true };
    const dateFormat: Intl.DateTimeFormatOptions = config.size === "small"
      ? { weekday: 'short', month: 'short', day: 'numeric' }
      : { weekday: 'long', month: 'short', day: 'numeric' };

    return (
      <div key="clock" className={`${borderClass} ${isFirst ? "" : "mt-3"}`}>
        <div className={`text-white ${sizeClasses.value} font-light`}>
          {currentTime.toLocaleTimeString([], timeFormat)}
        </div>
        {config.size !== "small" && (
          <div className={`text-white/70 ${sizeClasses.item} mt-1`}>
            {currentTime.toLocaleDateString([], dateFormat)}
          </div>
        )}
      </div>
    );
  };

  // Render the Weather composite widget (current + forecast)
  const renderWeatherCompositeWidget = (config: CompositeWidgetConfig, isFirst: boolean) => {
    if (!weather) return null;

    const showCurrent = config.subItems?.current?.enabled ?? true;
    const showForecast = config.subItems?.forecast?.enabled ?? true;

    if (!showCurrent && !showForecast) return null;

    const borderClass = isFirst ? "" : "pt-3 border-t border-white/20";
    const sizeClasses = getWidgetSizeClasses(config.size);
    const sections: JSX.Element[] = [];

    if (showCurrent) {
      sections.push(
        <div key="current" className={`flex items-center ${sizeClasses.gap}`}>
          <span className={sizeClasses.icon}>{getWeatherIcon(weather.icon)}</span>
          <div className="text-white">
            <div className={`${sizeClasses.value} font-light`}>{weather.temp}°F</div>
            {config.size !== "small" && (
              <div className={`${sizeClasses.item} text-white/70 capitalize`}>{weather.description}</div>
            )}
            {config.size === "large" && (
              <div className="text-sm text-white/60">
                Humidity: {weather.humidity}% - Wind: {weather.wind_speed} mph
              </div>
            )}
          </div>
        </div>
      );
    }

    if (showForecast) {
      sections.push(
        <div key="forecast" className={showCurrent ? "mt-2 pt-2 border-t border-white/10" : ""}>
          <div className={`${sizeClasses.sectionLabel} text-white/50 uppercase tracking-wide mb-1`}>Today's Forecast</div>
          <div className={`flex items-center ${sizeClasses.gap}`}>
            <span className={sizeClasses.icon}>{getWeatherIcon(weather.icon)}</span>
            <div className="text-white">
              <div className={`${sizeClasses.item} font-light`}>H: {weather.temp_max}° L: {weather.temp_min}°</div>
              {config.size !== "small" && (
                <div className={`${sizeClasses.item} text-white/70`}>Humidity: {weather.humidity}%</div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div key="weather" className={`${borderClass} ${isFirst ? "" : "mt-3"}`}>
        {sections}
      </div>
    );
  };

  // Render the Schedule composite widget (events + sports + tasks)
  const renderScheduleCompositeWidget = (config: CompositeWidgetConfig, isFirst: boolean) => {
    const showEvents = config.subItems?.events?.enabled ?? true;
    const showSports = config.subItems?.sports?.enabled ?? true;
    const showTasks = config.subItems?.tasks?.enabled ?? true;

    const eventsMaxItems = config.subItems?.events?.maxItems ?? 3;
    const sportsMaxItems = config.subItems?.sports?.maxItems ?? 3;
    const tasksMaxItems = config.subItems?.tasks?.maxItems ?? 3;

    const hasEvents = showEvents && upcomingEvents.length > 0;
    const hasSports = showSports && todaysGames.length > 0;
    const hasTasks = showTasks && upcomingTasks.length > 0;

    if (!hasEvents && !hasSports && !hasTasks) return null;

    const borderClass = isFirst ? "" : "pt-3 border-t border-white/20";
    const sizeClasses = getWidgetSizeClasses(config.size);
    const sections: JSX.Element[] = [];

    if (hasEvents) {
      const eventsToShow = upcomingEvents.slice(0, eventsMaxItems);
      const showCalendarName = config.size === "large";
      sections.push(
        <div key="events" className="space-y-2">
          <div className={`${sizeClasses.sectionLabel} text-white/50 uppercase tracking-wide`}>Upcoming Events</div>
          {eventsToShow.map((event) => {
            const startTime = new Date(event.startTime);
            const isAllDay = event.isAllDay;
            const calendar = calendars.find((c: Calendar) => c.id === event.calendarId);
            return (
              <div key={event.id} className={`flex items-center ${sizeClasses.gap} text-white ${sizeClasses.item}`}>
                <div
                  className={`${config.size === "small" ? "w-2 h-2" : "w-2.5 h-2.5"} rounded-full flex-shrink-0`}
                  style={{ backgroundColor: calendar?.color ?? "#3B82F6" }}
                />
                <span className="truncate flex-1">{event.title}</span>
                {config.size !== "small" && (
                  <span className="text-white/60 flex-shrink-0">
                    {isAllDay ? "All day" : format(startTime, "h:mm a")}
                  </span>
                )}
                {showCalendarName && calendar && (
                  <span className="text-white/40 text-xs flex-shrink-0">({calendar.name})</span>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    if (hasSports) {
      const gamesToShow = todaysGames.slice(0, sportsMaxItems);
      const showFullName = config.size === "large";
      const showGameTime = config.size !== "small";
      sections.push(
        <div key="sports" className={`space-y-2 ${sections.length > 0 ? "mt-3 pt-2 border-t border-white/10" : ""}`}>
          <div className={`${sizeClasses.sectionLabel} text-white/50 uppercase tracking-wide`}>Sports</div>
          {gamesToShow.map((game) => {
            const isGameLive = game.status === "in_progress" || game.status === "halftime";
            const isScheduled = game.status === "scheduled";

            if (isScheduled) {
              const gameTime = new Date(game.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
              return (
                <div key={game.externalId} className={`flex items-center ${sizeClasses.gap} text-white ${sizeClasses.item}`}>
                  <span className="font-medium">{showFullName ? game.awayTeam.name : game.awayTeam.abbreviation}</span>
                  <span className="text-white/60">@</span>
                  <span className="font-medium">{showFullName ? game.homeTeam.name : game.homeTeam.abbreviation}</span>
                  {showGameTime && <span className="text-white/60 ml-1">{gameTime}</span>}
                </div>
              );
            }

            return (
              <div key={game.externalId} className={`flex items-center ${sizeClasses.gap} text-white ${sizeClasses.item}`}>
                <span className="font-medium">{showFullName ? game.awayTeam.name : game.awayTeam.abbreviation}</span>
                <span className="font-bold">{game.awayTeam.score ?? 0}</span>
                {showGameTime && (
                  <span className={`px-1 ${isGameLive ? "text-red-400" : "text-white/60"}`}>
                    {game.statusDetail || (game.status === "final" ? "F" : "")}
                  </span>
                )}
                <span className="font-bold">{game.homeTeam.score ?? 0}</span>
                <span className="font-medium">{showFullName ? game.homeTeam.name : game.homeTeam.abbreviation}</span>
              </div>
            );
          })}
        </div>
      );
    }

    if (hasTasks) {
      const tasksToShow = upcomingTasks.slice(0, tasksMaxItems);
      sections.push(
        <div key="tasks" className={`space-y-2 ${sections.length > 0 ? "mt-3 pt-2 border-t border-white/10" : ""}`}>
          <div className={`${sizeClasses.sectionLabel} text-white/50 uppercase tracking-wide`}>Tasks Due Today</div>
          {tasksToShow.map((task: Task) => (
            <div key={task.id} className={`flex items-center ${sizeClasses.gap} text-white ${sizeClasses.item}`}>
              <div className={`${config.size === "small" ? "w-1.5 h-1.5" : "w-2 h-2"} rounded-full bg-amber-500 flex-shrink-0`} />
              <span className="truncate flex-1">{task.title}</span>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div key="schedule" className={`${borderClass} ${isFirst ? "" : "mt-3"}`}>
        {sections}
      </div>
    );
  };

  // Render the Controls composite widget (TV remote reference card)
  const renderControlsCompositeWidget = (config: CompositeWidgetConfig, isFirst: boolean) => {
    const borderClass = isFirst ? "" : "pt-3 border-t border-white/20";
    const sizeClasses = getWidgetSizeClasses(config.size);

    return (
      <div key="controls" className={`${borderClass} ${isFirst ? "" : "mt-3"}`}>
        <div className={`space-y-1.5 ${sizeClasses.item}`}>
          <div className="flex items-center gap-2 text-white/80">
            <span className="text-white/50 font-mono text-xs w-12">D-pad</span>
            <span>Scroll</span>
          </div>
          <div className="flex items-center gap-2 text-white/80">
            <span className="text-white/50 font-mono text-xs w-12">OK</span>
            <span>Select</span>
          </div>
          <div className="flex items-center gap-2 text-white/80">
            <span className="text-white/50 font-mono text-xs w-12">CH</span>
            <span>Next / Prev Page</span>
          </div>
          {config.size !== "small" && (
            <>
              <div className="flex items-center gap-2 text-white/80">
                <span className="text-white/50 font-mono text-xs w-12">&#9654;&#10074;&#10074;</span>
                <span>Refresh</span>
              </div>
              <div className="flex items-center gap-2 text-white/80">
                <span className="text-white/50 font-mono text-xs w-12">&#9664;&#9664;</span>
                <span>Help</span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  // Render a composite widget by ID
  // Note: Media/Spotify is handled via SpotifyWidget in the builder layout, not here
  const renderCompositeWidget = (config: CompositeWidgetConfig, isFirst: boolean): JSX.Element | null => {
    switch (config.id) {
      case "clock":
        return renderClockCompositeWidget(config, isFirst);
      case "weather":
        return renderWeatherCompositeWidget(config, isFirst);
      case "schedule":
        return renderScheduleCompositeWidget(config, isFirst);
      case "controls":
        return renderControlsCompositeWidget(config, isFirst);
      // Media/Spotify removed - use SpotifyWidget in builder layout instead
      default:
        return null;
    }
  };

  // Render a single widget cell for grid layout
  const renderWidgetCell = (config: CompositeWidgetConfig) => {
    const colSpan = Math.min(config.colSpan ?? 1, widgetGridSize);
    const rowSpan = Math.min(config.rowSpan ?? 1, widgetGridSize);

    const content = renderCompositeWidget(config, true); // Always treat as first (no separators in grid)
    if (!content) return null;

    return (
      <div
        key={config.id}
        className="bg-black/40 backdrop-blur-sm rounded-xl p-4 overflow-hidden flex flex-col justify-center"
        style={{
          gridColumn: `span ${colSpan}`,
          gridRow: `span ${rowSpan}`,
        }}
      >
        {content}
      </div>
    );
  };

  // Render the info pane (used in informational layout) - uses composite widgets
  const renderInfoPane = () => {
    // Filter to enabled composite widgets and render them
    const enabledConfigs = compositeWidgetConfigs.filter((c) => c.enabled);

    if (enabledConfigs.length === 0) {
      // Default to clock if no widgets selected
      return (
        <div className="bg-black/50 backdrop-blur-sm rounded-2xl w-full h-full flex flex-col justify-center p-6">
          <div className="text-white text-5xl font-light text-center">
            {currentTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
          </div>
          <div className="text-white/70 text-lg text-center mt-2">
            {currentTime.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
        </div>
      );
    }

    // Determine grid class based on widgetGridSize
    const gridClass = widgetGridSize === 1
      ? "grid-cols-1"
      : widgetGridSize === 2
        ? "grid-cols-2"
        : "grid-cols-3";

    return (
      <div className={`w-full h-full grid ${gridClass} gap-3 auto-rows-fr`}>
        {enabledConfigs.map((config) => renderWidgetCell(config)).filter(Boolean)}
      </div>
    );
  };

  // Render the clock widget (used in non-informational layouts)
  const renderClockWidget = () => {
    const sizeClasses = getClockSizeClasses(clockSize);

    return (
      <div className={`bg-black/50 backdrop-blur-sm rounded-2xl ${sizeClasses.container}`}>
        <div className={`text-white ${sizeClasses.time} font-light text-center`}>
          {currentTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
        </div>
        <div className={`text-white/70 ${sizeClasses.date} text-center mt-1`}>
          {currentTime.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
        </div>
        {weather && (
          <div className="flex items-center justify-center gap-3 mt-3 pt-3 border-t border-white/20">
            <span className={sizeClasses.weatherIcon}>{getWeatherIcon(weather.icon)}</span>
            <div className="text-white">
              <div className={`${sizeClasses.weather} font-light`}>{weather.temp}°F</div>
              <div className="text-xs text-white/70 capitalize">{weather.description}</div>
            </div>
          </div>
        )}
        {/* Today's Sports Games */}
        {todaysGames.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/20 space-y-2">
            {todaysGames.slice(0, 2).map((game) => {
              const isGameLive = game.status === "in_progress" || game.status === "halftime";
              const isScheduled = game.status === "scheduled";

              if (isScheduled) {
                const gameTime = new Date(game.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                return (
                  <div key={game.externalId} className="flex items-center justify-center gap-2 text-white text-sm">
                    <span className="font-medium">{game.awayTeam.abbreviation}</span>
                    <span className="text-white/60">@</span>
                    <span className="font-medium">{game.homeTeam.abbreviation}</span>
                    <span className="text-xs text-white/60 ml-1">{gameTime}</span>
                  </div>
                );
              }

              return (
                <div key={game.externalId} className="flex items-center justify-center gap-2 text-white text-sm">
                  <span className="font-medium">{game.awayTeam.abbreviation}</span>
                  <span className="font-bold">{game.awayTeam.score ?? 0}</span>
                  <span className={`text-xs px-1 ${isGameLive ? "text-red-400" : "text-white/60"}`}>
                    {game.statusDetail || (game.status === "final" ? "F" : "")}
                  </span>
                  <span className="font-bold">{game.homeTeam.score ?? 0}</span>
                  <span className="font-medium">{game.homeTeam.abbreviation}</span>
                </div>
              );
            })}
          </div>
        )}
        {/* Today's Events */}
        {upcomingEvents.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/20 space-y-1.5">
            <div className="text-xs text-white/50 uppercase tracking-wide">Today's Events</div>
            {upcomingEvents.map((event) => {
              const startTime = new Date(event.startTime);
              const isAllDay = event.isAllDay;
              const calendar = calendars.find((c: Calendar) => c.id === event.calendarId);
              return (
                <div key={event.id} className="flex items-center gap-2 text-white text-sm">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: calendar?.color ?? "#3B82F6" }}
                  />
                  <span className="truncate flex-1">{event.title}</span>
                  <span className="text-xs text-white/60 flex-shrink-0">
                    {isAllDay ? "All day" : format(startTime, "h:mm a")}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Render a single photo with transition (used for informational layout)
  const renderPhotoWithTransition = (
    photo: Photo | null,
    isEntering: boolean,
    className: string
  ) => {
    if (!photo) return null;
    const transitionClass = getTransitionClasses(transition, isEntering);
    return (
      <div className={`${transitionClass} !absolute !inset-0 flex items-center justify-center`}>
        <img src={photo.url} alt="" className={className} />
      </div>
    );
  };

  const renderLayout = (layoutPhotos: Photo[], isEntering: boolean) => {
    const transitionClass = getTransitionClasses(transition, isEntering);

    if (layout === "fullscreen") {
      return (
        <div className={transitionClass}>
          {layoutPhotos[0] && (
            <img src={layoutPhotos[0].url} alt="" className="max-h-full max-w-full object-contain" />
          )}
        </div>
      );
    }
    if (layout === "quad") {
      return (
        <div className={`${transitionClass} !grid grid-cols-2 grid-rows-2 gap-2 p-2`}>
          {layoutPhotos.map((photo, index) => (
            <div key={`${photo.id}-${index}`} className="flex items-center justify-center overflow-hidden">
              <img src={photo.url} alt="" className="max-h-full max-w-full object-contain" />
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div
      className={inline ? "absolute inset-0 bg-black overflow-hidden" : "fixed inset-0 z-[9999] bg-black cursor-none overflow-hidden"}
      {...(!inline ? {
        onClick: handleInteraction,
        onMouseDown: (e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault(); },
        onTouchStart: (e: React.TouchEvent) => { e.stopPropagation(); },
        onPointerDown: (e: React.PointerEvent) => { e.stopPropagation(); e.preventDefault(); },
      } : {})}
    >
      {/* Sports Ticker at top (hidden when inline) */}
      {!inline && (
        <div className="absolute top-0 left-0 right-0 z-10">
          <SportsTicker variant="dark" />
        </div>
      )}

      {layout === "builder" ? (
        // Builder layout - renders widgets from layoutConfig
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: layoutConfig?.backgroundColor || "#000000",
            backgroundImage: layoutConfig?.backgroundImage ? `url(${layoutConfig.backgroundImage})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div
            className="w-full h-full"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${layoutConfig?.gridColumns || 12}, 1fr)`,
              gridTemplateRows: `repeat(${layoutConfig?.gridRows || 8}, 1fr)`,
              gap: `${layoutConfig?.gridGap || 8}px`,
            }}
          >
            {(layoutConfig?.widgets || [])
              .filter((widget) => isWidgetVisible(widget))
              .map((widget) => {
                const isFocused = focusedBlockId === widget.id;
                const isSelecting = blockNavMode === "selecting";
                const isControlling = blockNavMode === "controlling";

                let navClasses = "";
                if (isSelecting && isFocused) {
                  navClasses = "ring-3 ring-primary/80 shadow-[0_0_20px_hsl(var(--primary)/0.4)] z-10 rounded-lg";
                } else if (isControlling && isFocused) {
                  navClasses = "ring-4 ring-primary z-10 rounded-lg";
                } else if (isControlling && !isFocused) {
                  navClasses = "opacity-30";
                }

                return (
                  <div
                    key={widget.id}
                    className={`relative transition-all duration-300 ${navClasses}`}
                    style={{
                      gridColumn: `${widget.x + 1} / span ${widget.width}`,
                      gridRow: `${widget.y + 1} / span ${widget.height}`,
                    }}
                  >
                    <WidgetRenderer widget={widget} widgetId={widget.id} />
                    {/* Widget label badge when selecting */}
                    {isSelecting && isFocused && (
                      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 bg-black/80 text-primary text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap border border-primary/20">
                        {widget.type.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </div>
                    )}
                  </div>
                );
              })}
            {blockNavMode !== "idle" && <BlockNavOverlay />}
          </div>
        </div>
      ) : layout === "scatter" ? (
        <ScatterLayout photos={scatterPhotos} />
      ) : layout === "informational" ? (
        <div className="relative h-full w-full grid grid-cols-2 grid-rows-2 gap-4 p-4">
          {/* Left column: Portrait photo spanning both rows */}
          <div className="row-span-2 relative">
            {/* Previous portrait (exiting) - only show when left side is transitioning */}
            {transitioningSide === 'left' && prevPortraitPhoto &&
              renderPhotoWithTransition(prevPortraitPhoto, false, "max-h-full max-w-full object-contain")}
            {/* Current portrait (entering or static) */}
            {portraitPhoto &&
              renderPhotoWithTransition(portraitPhoto, transitioningSide !== 'left' || prevPortraitPhoto === null, "max-h-full max-w-full object-contain")}
          </div>

          {/* Top-right: Info pane (configurable widgets) */}
          <div className="flex items-stretch justify-center">
            {renderInfoPane()}
          </div>

          {/* Bottom-right: Landscape photo */}
          <div className="relative">
            {/* Previous landscape (exiting) - only show when right side is transitioning */}
            {transitioningSide === 'right' && prevLandscapePhoto &&
              renderPhotoWithTransition(prevLandscapePhoto, false, "max-h-full max-w-full object-contain")}
            {/* Current landscape (entering or static) */}
            {landscapePhoto &&
              renderPhotoWithTransition(landscapePhoto, transitioningSide !== 'right' || prevLandscapePhoto === null, "max-h-full max-w-full object-contain")}
          </div>
        </div>
      ) : (
        <div className="relative h-full w-full">
          {/* Previous slide (exiting) */}
          {isTransitioning && prevDisplayPhotos.length > 0 && renderLayout(prevDisplayPhotos, false)}
          {/* Current slide (entering) */}
          {displayPhotos.length > 0 ? renderLayout(displayPhotos, !isTransitioning || prevIndex === null) : (
            <div className="flex h-full items-center justify-center text-white/50">
              No photos available
            </div>
          )}
        </div>
      )}

      {/* Clock & Weather overlay (not shown for informational or builder layouts) */}
      {layout !== "informational" && layout !== "builder" && (() => {
        const positionClasses = getClockPositionClasses(clockPosition);
        const sizeClasses = getClockSizeClasses(clockSize);
        return (
          <div className={`absolute ${positionClasses} bg-black/50 backdrop-blur-sm rounded-2xl ${sizeClasses.container}`}>
            <div className={`text-white ${sizeClasses.time} font-light text-center`}>
              {currentTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
            </div>
            <div className={`text-white/70 ${sizeClasses.date} text-center mt-1`}>
              {currentTime.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
            </div>
            {weather && (
              <div className="flex items-center justify-center gap-3 mt-3 pt-3 border-t border-white/20">
                <span className={sizeClasses.weatherIcon}>{getWeatherIcon(weather.icon)}</span>
                <div className="text-white">
                  <div className={`${sizeClasses.weather} font-light`}>{weather.temp}°F</div>
                  <div className="text-xs text-white/70 capitalize">{weather.description}</div>
                </div>
              </div>
            )}
            {/* Today's Sports Games */}
            {todaysGames.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/20 space-y-2">
                {todaysGames.slice(0, 2).map((game) => {
                  const isLive = game.status === "in_progress" || game.status === "halftime";
                  const isScheduled = game.status === "scheduled";

                  if (isScheduled) {
                    // Show scheduled game with time
                    const gameTime = new Date(game.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                    return (
                      <div key={game.externalId} className="flex items-center justify-center gap-2 text-white text-sm">
                        <span className="font-medium">{game.awayTeam.abbreviation}</span>
                        <span className="text-white/60">@</span>
                        <span className="font-medium">{game.homeTeam.abbreviation}</span>
                        <span className="text-xs text-white/60 ml-1">{gameTime}</span>
                      </div>
                    );
                  }

                  // Live or finished game with scores
                  return (
                    <div key={game.externalId} className="flex items-center justify-center gap-2 text-white text-sm">
                      <span className="font-medium">{game.awayTeam.abbreviation}</span>
                      <span className="font-bold">{game.awayTeam.score ?? 0}</span>
                      <span className={`text-xs px-1 ${isLive ? "text-red-400" : "text-white/60"}`}>
                        {game.statusDetail || (game.status === "final" ? "F" : "")}
                      </span>
                      <span className="font-bold">{game.homeTeam.score ?? 0}</span>
                      <span className="font-medium">{game.homeTeam.abbreviation}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {/* Today's Events */}
            {upcomingEvents.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/20 space-y-1.5">
                <div className="text-xs text-white/50 uppercase tracking-wide">Today's Events</div>
                {upcomingEvents.map((event) => {
                  const startTime = new Date(event.startTime);
                  const isAllDay = event.isAllDay;
                  const calendar = calendars.find((c: Calendar) => c.id === event.calendarId);
                  return (
                    <div key={event.id} className="flex items-center gap-2 text-white text-sm">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: calendar?.color ?? "#3B82F6" }}
                      />
                      <span className="truncate flex-1">{event.title}</span>
                      <span className="text-xs text-white/60 flex-shrink-0">
                        {isAllDay ? "All day" : format(startTime, "h:mm a")}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Tap to exit hint (hidden when dismissal is disabled) */}
      {!noDismiss && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/30 text-sm">
          Tap anywhere to exit
        </div>
      )}

      {/* Night dim overlay */}
      {currentDimOpacity > 0 && (
        <div
          className="absolute inset-0 bg-black pointer-events-none transition-opacity duration-[10s]"
          style={{ opacity: currentDimOpacity / 100 }}
        />
      )}
    </div>
  );
}

function ScatterLayout({ photos }: { photos: ScatterPhoto[] }) {
  return (
    <div className="h-full w-full relative overflow-hidden">
      {photos.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-white/50">
          Loading photos...
        </div>
      )}
      {photos.map((photo) => (
        <div
          key={`${photo.id}-${photo.zIndex}`}
          className="absolute shadow-2xl bg-white p-2 transition-all duration-1000"
          style={{
            left: `${photo.x}%`,
            top: `${photo.y}%`,
            transform: `translate(-50%, -50%) rotate(${photo.rotation}deg)`,
            width: `${photo.scale * 100}vw`,
            zIndex: photo.zIndex,
            animation: "fadeInScale 0.8s ease-out",
          }}
        >
          <img src={photo.url} alt="" className="w-full h-auto" />
        </div>
      ))}
      <style>{`
        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.8);
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
