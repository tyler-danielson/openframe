import { useEffect } from "react";

/*
 * Keep Silk Open — prevents Amazon's Silk browser (Echo Show, Fire tablets)
 * from closing the page after ~10 minutes of inactivity.
 *
 * Technique ported from https://gitlab.com/DaGammla/keep-silk-open
 * (MIT License, Copyright (c) 2022 DaGammla): play a short silent audio
 * file and re-fetch it with a cache-busting query every time it ends. The
 * recurring media + network activity resets Silk's idle timer. The audio
 * starts muted so autoplay is permitted, then unmutes on the first user
 * interaction (the file is silent either way, so nothing is audible).
 *
 * The media file is ~10 s of encoded silence (MPEG-2.5 Layer III, 8 kbps,
 * 8 kHz mono), synthesized and served as /keep-silk-open.mp3 by the
 * keepSilkOpenAsset plugin in vite.config.ts — so the re-fetch happens
 * roughly every 10 seconds.
 */

// Vite guarantees BASE_URL ends with "/"
const AUDIO_URL = `${import.meta.env.BASE_URL}keep-silk-open.mp3`;

const ACTIVATION_EVENTS = ["keydown", "pointerdown", "click"] as const;

export function isSilkBrowser(): boolean {
  return /\bsilk\b/i.test(navigator.userAgent);
}

/** Opt-in for non-Silk kiosk browsers via a `keepawake` query param on any URL. */
function keepAwakeRequested(): boolean {
  return new URLSearchParams(window.location.search).has("keepawake");
}

/**
 * Mount once near the app root. No-op unless running in Silk (or forced),
 * so it is safe on every page.
 */
export function useSilkKeepAlive(options?: { force?: boolean }) {
  const force = options?.force ?? false;

  useEffect(() => {
    if (!force && !isSilkBrowser() && !keepAwakeRequested()) return;

    const freshSrc = () => `${AUDIO_URL}?q=${Date.now()}`;

    const audio = document.createElement("audio");
    audio.src = freshSrc();
    audio.muted = true;
    audio.autoplay = true;
    audio.setAttribute("aria-hidden", "true");
    audio.style.display = "none";
    document.body.appendChild(audio);

    const reload = () => {
      audio.src = freshSrc();
      audio.currentTime = 0;
      audio.play().catch(() => {});
    };

    audio.onended = reload;

    const startMedia = () => {
      reload();
      audio.muted = false;
    };

    const removeListeners = () => {
      ACTIVATION_EVENTS.forEach((ev) => document.removeEventListener(ev, startMedia));
    };

    // Once playback is actually running, interaction listeners are no longer needed
    audio.onplaying = removeListeners;

    ACTIVATION_EVENTS.forEach((ev) => document.addEventListener(ev, startMedia));

    return () => {
      removeListeners();
      audio.onended = null;
      audio.onplaying = null;
      audio.pause();
      audio.remove();
    };
  }, [force]);
}
