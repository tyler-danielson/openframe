import { useEffect, useRef } from "react";
import { api } from "../services/api";
import { useAuthStore } from "../stores/auth";

/**
 * Hook for widgets to report their state to the server for companion app consumption.
 * Debounces updates and sends periodic heartbeats.
 */
export function useWidgetStateReporter(
  widgetId: string | undefined,
  widgetType: string,
  state: Record<string, unknown>
) {
  const stateRef = useRef(state);
  const lastSentRef = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  stateRef.current = state;

  useEffect(() => {
    if (!widgetId) return;

    // Get the kiosk token from the URL path (e.g. /kiosk/<token>/...)
    const match = window.location.pathname.match(/\/kiosk\/([^/]+)/);
    if (!match) return; // Not running in kiosk mode

    const token = match[1]!;

    const sendState = () => {
      const serialized = JSON.stringify(stateRef.current);
      // Skip if identical to last sent
      if (serialized === lastSentRef.current) return;
      lastSentRef.current = serialized;

      api.reportWidgetState(token, [
        { widgetId, widgetType, state: stateRef.current },
      ]).catch(() => {});
    };

    // Send immediately on mount/state change (debounced)
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(sendState, 500);

    // Periodic heartbeat every 15 seconds
    const heartbeat = setInterval(() => {
      lastSentRef.current = ""; // Force re-send
      sendState();
    }, 15000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      clearInterval(heartbeat);
    };
  }, [widgetId, widgetType, JSON.stringify(state)]);
}
