import { useCallback, useRef } from "react";

interface UseLongPressOptions {
  /** Duration in ms before triggering long press (default: 500) */
  threshold?: number;
  /** Called when long press is triggered */
  onLongPress: () => void;
  /** Optional callback for regular click (not long press) */
  onClick?: () => void;
}

interface LongPressHandlers {
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onMouseLeave: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onClick: (e: React.MouseEvent) => void;
}

/**
 * Custom hook for detecting press-and-hold gestures.
 * Returns event handlers to attach to the target element.
 * Prevents click event when long press is triggered.
 */
export function useLongPress({
  threshold = 500,
  onLongPress,
  onClick,
}: UseLongPressOptions): LongPressHandlers {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  const start = useCallback(
    (x: number, y: number) => {
      isLongPressRef.current = false;
      startPosRef.current = { x, y };

      timerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        onLongPress();
      }, threshold);
    },
    [onLongPress, threshold]
  );

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only handle left mouse button
      if (e.button !== 0) return;
      start(e.clientX, e.clientY);
    },
    [start]
  );

  const handleMouseUp = useCallback(
    (_e: React.MouseEvent) => {
      stop();
    },
    [stop]
  );

  const handleMouseLeave = useCallback(
    (_e: React.MouseEvent) => {
      stop();
    },
    [stop]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      if (touch) {
        start(touch.clientX, touch.clientY);
      }
    },
    [start]
  );

  const handleTouchEnd = useCallback(
    (_e: React.TouchEvent) => {
      stop();
    },
    [stop]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // Prevent click if it was a long press
      if (isLongPressRef.current) {
        e.preventDefault();
        e.stopPropagation();
        // Reset for next interaction
        isLongPressRef.current = false;
        return;
      }

      // Call regular onClick if provided
      if (onClick) {
        onClick();
      }
    },
    [onClick]
  );

  return {
    onMouseDown: handleMouseDown,
    onMouseUp: handleMouseUp,
    onMouseLeave: handleMouseLeave,
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
    onClick: handleClick,
  };
}
