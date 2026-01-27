import { useEffect, useRef } from "react";
import { useScreensaverStore } from "../stores/screensaver";

export function useIdleDetector() {
  const { enabled, idleTimeout, isActive, setActive, updateActivity, lastActivity } =
    useScreensaverStore();
  const checkIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      return;
    }

    // Track user activity
    const handleActivity = () => {
      if (!isActive) {
        updateActivity();
      }
    };

    const events = ["mousedown", "mousemove", "keydown", "touchstart", "wheel", "scroll"];
    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Check idle timeout periodically
    checkIntervalRef.current = window.setInterval(() => {
      const now = Date.now();
      const idleTime = (now - lastActivity) / 1000;

      if (idleTime >= idleTimeout && !isActive) {
        setActive(true);
      }
    }, 1000);

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [enabled, idleTimeout, isActive, setActive, updateActivity, lastActivity]);
}
