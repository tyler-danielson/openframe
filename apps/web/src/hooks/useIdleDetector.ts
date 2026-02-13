import { useEffect, useRef } from "react";
import { useScreensaverStore } from "../stores/screensaver";

export function useIdleDetector() {
  const { enabled, setActive, updateActivity } =
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
      // Read fresh value from store to avoid stale closure
      const { isActive: currentlyActive, behavior } = useScreensaverStore.getState();
      // In hide-toolbar mode, there's no Screensaver overlay to handle dismissal,
      // so allow activity events to reset even when active
      if (!currentlyActive || behavior === "hide-toolbar") {
        updateActivity();
      }
    };

    const events = ["mousedown", "mousemove", "keydown", "touchstart", "wheel", "scroll"];
    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Check idle timeout periodically
    checkIntervalRef.current = window.setInterval(() => {
      // Don't activate screensaver while user is focused on an input
      const activeElement = document.activeElement;
      const isInputFocused = activeElement && (
        activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA" ||
        activeElement.getAttribute("contenteditable") === "true"
      );
      if (isInputFocused) {
        return;
      }

      // Read fresh values from store to avoid stale closures
      const { lastActivity, isActive: currentlyActive, idleTimeout: currentTimeout } = useScreensaverStore.getState();
      const now = Date.now();
      const idleTime = (now - lastActivity) / 1000;

      if (idleTime >= currentTimeout && !currentlyActive) {
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
  }, [enabled, setActive, updateActivity]);
}
