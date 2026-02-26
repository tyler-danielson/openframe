import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, getPhotoUrl } from "../../services/api";
import { cn } from "../../lib/utils";

interface PhotoSlideshowProps {
  className?: string;
}

export function PhotoSlideshow({ className }: PhotoSlideshowProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const { data } = useQuery({
    queryKey: ["slideshow"],
    queryFn: () => api.getSlideshow(),
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  const photos = data?.photos ?? [];
  const interval = (data?.interval ?? 30) * 1000;

  const goToNext = useCallback(() => {
    if (photos.length === 0) return;

    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % photos.length);
      setIsTransitioning(false);
    }, 500);
  }, [photos.length]);

  useEffect(() => {
    if (photos.length <= 1) return;

    const timer = setInterval(goToNext, interval);
    return () => clearInterval(timer);
  }, [photos.length, interval, goToNext]);

  if (photos.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted text-muted-foreground",
          className
        )}
      >
        <p className="text-center">
          No photos in slideshow.
          <br />
          Add photos to an active album.
        </p>
      </div>
    );
  }

  const currentPhoto = photos[currentIndex];

  return (
    <div className={cn("relative overflow-hidden bg-black", className)}>
      <img
        src={getPhotoUrl(currentPhoto?.url)}
        alt=""
        className={cn(
          "h-full w-full object-cover transition-opacity duration-500",
          isTransitioning ? "opacity-0" : "opacity-100"
        )}
      />

      {/* Progress indicator */}
      {photos.length > 1 && (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1">
          {photos.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-colors",
                i === currentIndex ? "bg-white" : "bg-white/40"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
