import { useEffect, useCallback, useRef } from "react";
import { TIZEN_KEY_CODES, TIZEN_KEY_NAMES, AppCommonScreenSaverState } from "@/types/tizen";

export type KeyAction =
  | "up"
  | "down"
  | "left"
  | "right"
  | "enter"
  | "back"
  | "exit"
  | "menu"
  | "play_pause"
  | "play"
  | "pause"
  | "stop"
  | "rewind"
  | "fast_forward"
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "info"
  | "guide"
  | "digit_0"
  | "digit_1"
  | "digit_2"
  | "digit_3"
  | "digit_4"
  | "digit_5"
  | "digit_6"
  | "digit_7"
  | "digit_8"
  | "digit_9";

export type KeyHandler = (action: KeyAction) => void;

/**
 * Map key codes to actions
 */
function keyCodeToAction(keyCode: number): KeyAction | null {
  switch (keyCode) {
    case TIZEN_KEY_CODES.ArrowUp:
      return "up";
    case TIZEN_KEY_CODES.ArrowDown:
      return "down";
    case TIZEN_KEY_CODES.ArrowLeft:
      return "left";
    case TIZEN_KEY_CODES.ArrowRight:
      return "right";
    case TIZEN_KEY_CODES.Enter:
      return "enter";
    case TIZEN_KEY_CODES.Back:
      return "back";
    case TIZEN_KEY_CODES.Exit:
      return "exit";
    case TIZEN_KEY_CODES.Menu:
      return "menu";
    case TIZEN_KEY_CODES.MediaPlayPause:
      return "play_pause";
    case TIZEN_KEY_CODES.MediaPlay:
      return "play";
    case TIZEN_KEY_CODES.MediaPause:
      return "pause";
    case TIZEN_KEY_CODES.MediaStop:
      return "stop";
    case TIZEN_KEY_CODES.MediaRewind:
      return "rewind";
    case TIZEN_KEY_CODES.MediaFastForward:
      return "fast_forward";
    case TIZEN_KEY_CODES.ColorF0Red:
      return "red";
    case TIZEN_KEY_CODES.ColorF1Green:
      return "green";
    case TIZEN_KEY_CODES.ColorF2Yellow:
      return "yellow";
    case TIZEN_KEY_CODES.ColorF3Blue:
      return "blue";
    case TIZEN_KEY_CODES.Info:
      return "info";
    case TIZEN_KEY_CODES.Guide:
      return "guide";
    case TIZEN_KEY_CODES.Digit0:
      return "digit_0";
    case TIZEN_KEY_CODES.Digit1:
      return "digit_1";
    case TIZEN_KEY_CODES.Digit2:
      return "digit_2";
    case TIZEN_KEY_CODES.Digit3:
      return "digit_3";
    case TIZEN_KEY_CODES.Digit4:
      return "digit_4";
    case TIZEN_KEY_CODES.Digit5:
      return "digit_5";
    case TIZEN_KEY_CODES.Digit6:
      return "digit_6";
    case TIZEN_KEY_CODES.Digit7:
      return "digit_7";
    case TIZEN_KEY_CODES.Digit8:
      return "digit_8";
    case TIZEN_KEY_CODES.Digit9:
      return "digit_9";
    default:
      return null;
  }
}

/**
 * Register special keys with Tizen TV
 */
function registerTizenKeys(): void {
  if (typeof window !== "undefined" && window.tizen?.tvinputdevice) {
    try {
      window.tizen.tvinputdevice.registerKeyBatch(
        [...TIZEN_KEY_NAMES],
        () => console.log("Tizen keys registered successfully"),
        (err: Error) => console.warn("Failed to register Tizen keys:", err)
      );
    } catch (e: unknown) {
      console.warn("Tizen key registration error:", e);
    }
  }
}

/**
 * Unregister special keys
 */
function unregisterTizenKeys(): void {
  if (typeof window !== "undefined" && window.tizen?.tvinputdevice) {
    try {
      window.tizen.tvinputdevice.unregisterKeyBatch(
        [...TIZEN_KEY_NAMES],
        () => console.log("Tizen keys unregistered"),
        (err: Error) => console.warn("Failed to unregister Tizen keys:", err)
      );
    } catch (e: unknown) {
      console.warn("Tizen key unregistration error:", e);
    }
  }
}

/**
 * Hook for handling Tizen TV remote key events
 */
export function useTizenKeys(handler: KeyHandler, enabled: boolean = true): void {
  const handlerRef = useRef(handler);

  // Keep handler ref updated
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      const action = keyCodeToAction(event.keyCode);
      if (action) {
        event.preventDefault();
        event.stopPropagation();
        handlerRef.current(action);
      }
    },
    [enabled]
  );

  useEffect(() => {
    if (!enabled) return;

    // Register Tizen-specific keys
    registerTizenKeys();

    // Add keyboard event listener
    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      unregisterTizenKeys();
    };
  }, [enabled, handleKeyDown]);
}

/**
 * Disable screen saver on Tizen TV
 */
export function disableScreenSaver(): void {
  if (typeof window !== "undefined" && window.webapis?.appcommon) {
    try {
      window.webapis.appcommon.setScreenSaver(
        AppCommonScreenSaverState.SCREEN_SAVER_OFF,
        () => console.log("Screen saver disabled"),
        (err: Error) => console.warn("Failed to disable screen saver:", err)
      );
    } catch (e: unknown) {
      console.warn("Screen saver disable error:", e);
    }
  }
}

/**
 * Exit the Tizen application
 */
export function exitApp(): void {
  if (typeof window !== "undefined" && window.tizen?.application) {
    try {
      window.tizen.application.getCurrentApplication().exit();
    } catch (e: unknown) {
      console.warn("Exit app error:", e);
    }
  }
}

/**
 * Check if running on actual Tizen TV
 */
export function isTizenTV(): boolean {
  return typeof window !== "undefined" && !!window.tizen;
}
