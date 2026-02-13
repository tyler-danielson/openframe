import { useCallback, useRef, useEffect } from "react";
import { useToast } from "../components/ui/Toaster";

function playBeepSequence() {
  try {
    const ctx = new AudioContext();
    const beep = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    // Three ascending beeps
    beep(880, ctx.currentTime, 0.15);
    beep(1100, ctx.currentTime + 0.2, 0.15);
    beep(1320, ctx.currentTime + 0.4, 0.3);
    // Repeat after a pause
    beep(880, ctx.currentTime + 1.0, 0.15);
    beep(1100, ctx.currentTime + 1.2, 0.15);
    beep(1320, ctx.currentTime + 1.4, 0.3);
    return ctx;
  } catch {
    return null;
  }
}

export function useTimerAlarm() {
  const { toast } = useToast();
  const audioCtxRef = useRef<AudioContext | null>(null);
  const permissionRequested = useRef(false);

  useEffect(() => {
    if (permissionRequested.current) return;
    if ("Notification" in window && Notification.permission === "default") {
      permissionRequested.current = true;
      Notification.requestPermission();
    }
  }, []);

  const playAlarm = useCallback((timerName: string) => {
    toast({ title: `Timer "${timerName}" is done!`, type: "success" });

    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Kitchen Timer", {
        body: `"${timerName}" is done!`,
        icon: "/favicon.ico",
      });
    }

    // Try mp3 first, fall back to Web Audio beeps
    try {
      const audio = new Audio("/sounds/timer-alarm.mp3");
      audio.volume = 0.7;
      audio.play().catch(() => {
        audioCtxRef.current = playBeepSequence();
      });
    } catch {
      audioCtxRef.current = playBeepSequence();
    }
  }, [toast]);

  const stopAlarm = useCallback(() => {
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }, []);

  return { playAlarm, stopAlarm };
}
