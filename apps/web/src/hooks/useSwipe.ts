import { useRef, useCallback } from "react";

interface UseSwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  enabled?: boolean;
  threshold?: number;
  maxVertical?: number;
}

export function useSwipe({
  onSwipeLeft,
  onSwipeRight,
  enabled = true,
  threshold = 50,
  maxVertical = 100,
}: UseSwipeOptions) {
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const swiped = useRef(false);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled) return;
      const touch = e.touches[0];
      if (!touch) return;
      touchStartX.current = touch.clientX;
      touchStartY.current = touch.clientY;
      swiped.current = false;
    },
    [enabled]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || swiped.current) return;
      const touch = e.touches[0];
      if (!touch) return;

      const dx = touch.clientX - touchStartX.current;
      const dy = touch.clientY - touchStartY.current;

      if (Math.abs(dx) >= threshold && Math.abs(dy) <= maxVertical) {
        swiped.current = true;
        if (dx < 0) {
          onSwipeLeft?.();
        } else {
          onSwipeRight?.();
        }
      }
    },
    [enabled, threshold, maxVertical, onSwipeLeft, onSwipeRight]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (swiped.current) {
        // Prevent the outer onClick (screensaver dismiss) from firing
        e.stopPropagation();
      }
    },
    []
  );

  return { onTouchStart, onTouchMove, onTouchEnd };
}
