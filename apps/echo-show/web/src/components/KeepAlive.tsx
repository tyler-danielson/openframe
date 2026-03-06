import { useEffect, useRef, useCallback } from "react";

/**
 * Silent audio keep-alive component.
 *
 * Plays a silent MP3 in a loop to prevent the Echo Show from
 * timing out the Alexa skill session or the Silk browser tab.
 *
 * Must be activated after a user interaction (autoplay policy).
 */
export function KeepAlive() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activatedRef = useRef(false);

  const startKeepAlive = useCallback(() => {
    if (activatedRef.current) return;
    activatedRef.current = true;

    // Method 1: Silent MP3 loop
    const audio = new Audio("/silent.mp3");
    audio.loop = true;
    audio.volume = 0.01; // Near-silent but not zero (some browsers ignore volume=0)
    audioRef.current = audio;

    audio.play().catch((err) => {
      console.warn("[KeepAlive] Audio play failed:", err);
    });

    // Method 2: Web Audio API oscillator at zero gain (backup)
    try {
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
    } catch {
      // Web Audio API not available — silent MP3 is the primary method
    }

    // Method 3: Periodic re-trigger to handle audio element being garbage collected
    intervalRef.current = setInterval(() => {
      if (audioRef.current?.paused) {
        audioRef.current.play().catch(() => {});
      }
    }, 30000); // Check every 30 seconds
  }, []);

  useEffect(() => {
    // Activate on first user interaction
    const activateOnInteraction = () => {
      startKeepAlive();
      document.removeEventListener("touchstart", activateOnInteraction);
      document.removeEventListener("click", activateOnInteraction);
    };

    document.addEventListener("touchstart", activateOnInteraction, { once: true });
    document.addEventListener("click", activateOnInteraction, { once: true });

    return () => {
      document.removeEventListener("touchstart", activateOnInteraction);
      document.removeEventListener("click", activateOnInteraction);

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

  // Hidden audio element as fallback
  return (
    <audio
      src="/silent.mp3"
      loop
      style={{ display: "none" }}
      aria-hidden="true"
    />
  );
}
