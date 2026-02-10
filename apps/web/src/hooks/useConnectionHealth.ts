import { useState, useEffect, useRef, useCallback } from "react";

export type ConnectionStatus = "online" | "offline" | "reconnecting";

interface UseConnectionHealthOptions {
  /**
   * Enable connection health monitoring
   */
  enabled?: boolean;
  /**
   * Normal polling interval in ms (default: 30000)
   */
  pollInterval?: number;
  /**
   * Initial retry interval in ms (default: 10000)
   */
  initialRetryInterval?: number;
  /**
   * Maximum retry interval in ms (default: 60000)
   */
  maxRetryInterval?: number;
  /**
   * Callback when connection is restored after being offline
   */
  onReconnect?: () => void;
}

interface UseConnectionHealthResult {
  status: ConnectionStatus;
  lastOnlineAt: Date | null;
  checkNow: () => Promise<boolean>;
}

const API_BASE = "/api/v1";

/**
 * Hook to monitor server connectivity with exponential backoff.
 */
export function useConnectionHealth(
  options: UseConnectionHealthOptions = {}
): UseConnectionHealthResult {
  const {
    enabled = true,
    pollInterval = 30000,
    initialRetryInterval = 10000,
    maxRetryInterval = 60000,
    onReconnect,
  } = options;

  const [status, setStatus] = useState<ConnectionStatus>("online");
  const [lastOnlineAt, setLastOnlineAt] = useState<Date | null>(new Date());

  const retryIntervalRef = useRef(initialRetryInterval);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasOfflineRef = useRef(false);
  const onReconnectRef = useRef(onReconnect);

  // Keep callback ref updated
  useEffect(() => {
    onReconnectRef.current = onReconnect;
  }, [onReconnect]);

  const checkHealth = useCallback(async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${API_BASE}/health`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const scheduleNextCheck = useCallback(
    (interval: number) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(async () => {
        const isOnline = await checkHealth();

        if (isOnline) {
          // Connection restored
          const wasOffline = wasOfflineRef.current;
          wasOfflineRef.current = false;
          retryIntervalRef.current = initialRetryInterval;
          setStatus("online");
          setLastOnlineAt(new Date());

          if (wasOffline) {
            // Trigger reconnection callback
            onReconnectRef.current?.();
          }

          // Schedule normal polling
          scheduleNextCheck(pollInterval);
        } else {
          // Connection failed
          if (!wasOfflineRef.current) {
            wasOfflineRef.current = true;
            setStatus("offline");
          } else {
            setStatus("reconnecting");
          }

          // Exponential backoff
          const nextInterval = Math.min(
            retryIntervalRef.current * 2,
            maxRetryInterval
          );
          retryIntervalRef.current = nextInterval;

          scheduleNextCheck(retryIntervalRef.current);
        }
      }, interval);
    },
    [checkHealth, pollInterval, initialRetryInterval, maxRetryInterval]
  );

  // Manual check function
  const checkNow = useCallback(async (): Promise<boolean> => {
    const isOnline = await checkHealth();

    if (isOnline) {
      const wasOffline = wasOfflineRef.current;
      wasOfflineRef.current = false;
      retryIntervalRef.current = initialRetryInterval;
      setStatus("online");
      setLastOnlineAt(new Date());

      if (wasOffline) {
        onReconnectRef.current?.();
      }

      // Reset to normal polling interval
      scheduleNextCheck(pollInterval);
    } else {
      if (!wasOfflineRef.current) {
        wasOfflineRef.current = true;
        setStatus("offline");
      }
      // Use current retry interval
      scheduleNextCheck(retryIntervalRef.current);
    }

    return isOnline;
  }, [checkHealth, initialRetryInterval, pollInterval, scheduleNextCheck]);

  // Start polling when enabled
  useEffect(() => {
    if (!enabled) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    // Initial check
    checkNow();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [enabled, checkNow]);

  // Listen for browser online/offline events as additional signal
  useEffect(() => {
    if (!enabled) return;

    const handleOnline = () => {
      // Browser thinks we're online, verify with server
      checkNow();
    };

    const handleOffline = () => {
      wasOfflineRef.current = true;
      setStatus("offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [enabled, checkNow]);

  return {
    status,
    lastOnlineAt,
    checkNow,
  };
}
