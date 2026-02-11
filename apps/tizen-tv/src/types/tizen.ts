/**
 * Tizen TV API Type Definitions and Constants
 */

// TV Remote Key Codes
export const TIZEN_KEY_CODES = {
  // D-pad
  ArrowUp: 38,
  ArrowDown: 40,
  ArrowLeft: 37,
  ArrowRight: 39,
  Enter: 13,

  // Media controls
  MediaPlayPause: 10252,
  MediaPlay: 415,
  MediaPause: 19,
  MediaStop: 413,
  MediaRewind: 412,
  MediaFastForward: 417,

  // Color buttons
  ColorF0Red: 403,
  ColorF1Green: 404,
  ColorF2Yellow: 405,
  ColorF3Blue: 406,

  // Navigation
  Back: 10009,
  Exit: 10182,
  Menu: 18,
  Info: 457,
  Guide: 458,

  // Number keys (0-9)
  Digit0: 48,
  Digit1: 49,
  Digit2: 50,
  Digit3: 51,
  Digit4: 52,
  Digit5: 53,
  Digit6: 54,
  Digit7: 55,
  Digit8: 56,
  Digit9: 57,

  // Volume (usually handled by TV itself)
  VolumeUp: 447,
  VolumeDown: 448,
  VolumeMute: 449,

  // Channel
  ChannelUp: 427,
  ChannelDown: 428,
} as const;

// Key names for registration
export const TIZEN_KEY_NAMES = [
  "MediaPlayPause",
  "MediaPlay",
  "MediaPause",
  "MediaStop",
  "MediaRewind",
  "MediaFastForward",
  "ColorF0Red",
  "ColorF1Green",
  "ColorF2Yellow",
  "ColorF3Blue",
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "Info",
  "Guide",
] as const;

export type TizenKeyCode = (typeof TIZEN_KEY_CODES)[keyof typeof TIZEN_KEY_CODES];
export type TizenKeyName = (typeof TIZEN_KEY_NAMES)[number];

// Tizen API interfaces
export interface TizenInputDeviceKey {
  name: string;
  code: number;
}

export interface TizenApplication {
  appInfo: TizenApplicationInformation;
  contextId: string;
  exit(): void;
  hide(): void;
}

export interface TizenApplicationInformation {
  id: string;
  name: string;
  iconPath: string;
  version: string;
}

export enum AppCommonScreenSaverState {
  SCREEN_SAVER_OFF = 0,
  SCREEN_SAVER_ON = 1,
}

// Global type declarations
declare global {
  interface Window {
    tizen?: {
      tvinputdevice: {
        registerKey(keyName: string): void;
        registerKeyBatch(
          keyNames: string[],
          successCallback?: () => void,
          errorCallback?: (error: Error) => void
        ): void;
        unregisterKey(keyName: string): void;
        unregisterKeyBatch(
          keyNames: string[],
          successCallback?: () => void,
          errorCallback?: (error: Error) => void
        ): void;
        getSupportedKeys(): TizenInputDeviceKey[];
        getKey(keyName: string): TizenInputDeviceKey | null;
      };
      application: {
        getCurrentApplication(): TizenApplication;
      };
    };
    webapis?: {
      appcommon: {
        AppCommonScreenSaverState: typeof AppCommonScreenSaverState;
        setScreenSaver(
          state: AppCommonScreenSaverState,
          successCallback?: () => void,
          errorCallback?: (error: Error) => void
        ): void;
      };
      productinfo: {
        getFirmware(): string;
        getModel(): string;
        getModelCode(): string;
        getDuid(): string;
        isUdPanelSupported(): boolean;
        getRealModel(): string;
      };
      network: {
        getActiveConnectionType(): number;
        isConnectedToGateway(): boolean;
      };
    };
  }
}

// Ensure this file is treated as a module
export {};
