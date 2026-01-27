import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";
import { useScreensaverStore, type ScreensaverTransition } from "../stores/screensaver";

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

export function Screensaver() {
  const {
    isActive,
    slideInterval,
    layout,
    transition,
    updateActivity,
  } = useScreensaverStore();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState<number | null>(null);
  const [scatterPhotos, setScatterPhotos] = useState<ScatterPhoto[]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Fetch photos from local storage (all photos are now stored locally)
  const { data: slideshowData } = useQuery({
    queryKey: ["slideshow"],
    queryFn: () => api.getSlideshow(),
    enabled: isActive,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const photos = slideshowData?.photos ?? [];

  // Handle user interaction to exit screensaver
  const handleInteraction = useCallback(() => {
    updateActivity();
  }, [updateActivity]);

  // Listen for any interaction to exit screensaver
  useEffect(() => {
    if (!isActive) return;

    const events = ["mousedown", "mousemove", "keydown", "touchstart", "wheel"];
    events.forEach((event) => {
      window.addEventListener(event, handleInteraction, { passive: true });
    });

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleInteraction);
      });
    };
  }, [isActive, handleInteraction]);

  // Update clock every second
  useEffect(() => {
    if (!isActive) return;

    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive]);

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
    }, slideInterval * 1000);

    return () => clearInterval(interval);
  }, [isActive, photos.length, slideInterval, layout, currentIndex]);

  // Reset scatter photos when layout changes
  useEffect(() => {
    if (layout !== "scatter") {
      setScatterPhotos([]);
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
      case "side-by-side": {
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
    if (layout === "side-by-side") {
      return (
        <div className={`${transitionClass} gap-4 p-4`}>
          {layoutPhotos.map((photo, index) => (
            <div key={`${photo.id}-${index}`} className="flex-1 h-full flex items-center justify-center">
              <img src={photo.url} alt="" className="max-h-full max-w-full object-contain" />
            </div>
          ))}
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
      className="fixed inset-0 z-50 bg-black cursor-none overflow-hidden"
      onClick={handleInteraction}
    >
      {layout === "scatter" ? (
        <ScatterLayout photos={scatterPhotos} />
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

      {/* Clock overlay */}
      <div className="absolute top-6 right-8 text-white/80 text-4xl font-light drop-shadow-lg">
        {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>

      {/* Tap to exit hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/30 text-sm">
        Tap anywhere to exit
      </div>
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
