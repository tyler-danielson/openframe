import { useEffect, useRef, useCallback } from "react";

// Tiny silent WAV as a data URI (44 bytes of silence) — no external file needed
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

/**
 * Keeps the Echo Show's Silk browser tab active and prevents
 * the device from going to the Alexa home screen / sleep.
 *
 * Uses three complementary strategies:
 * 1. Silent audio loop (prevents tab suspension)
 * 2. Web Audio API oscillator at zero gain (backup)
 * 3. Periodic activity ping (prevents idle detection)
 */
export function KeepAlive() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activatedRef = useRef(false);

  const startKeepAlive = useCallback(() => {
    if (activatedRef.current) return;
    activatedRef.current = true;

    // Method 1: Silent audio loop
    const audio = new Audio(SILENT_WAV);
    audio.loop = true;
    audio.volume = 0.01;
    audioRef.current = audio;
    audio.play().catch(() => {});

    // Method 2: Web Audio API oscillator at zero gain
    try {
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
    } catch {
      // Not available — silent audio is the primary method
    }

    // Method 3: Periodic re-trigger
    intervalRef.current = setInterval(() => {
      if (audioRef.current?.paused) {
        audioRef.current.play().catch(() => {});
      }
      // Touch the DOM to prevent idle
      document.title = "OpenFrame Kiosk";
    }, 30000);
  }, []);

  useEffect(() => {
    const activate = () => {
      startKeepAlive();
      document.removeEventListener("touchstart", activate);
      document.removeEventListener("click", activate);
    };

    document.addEventListener("touchstart", activate, { once: true });
    document.addEventListener("click", activate, { once: true });

    return () => {
      document.removeEventListener("touchstart", activate);
      document.removeEventListener("click", activate);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [startKeepAlive]);

  return null;
}
