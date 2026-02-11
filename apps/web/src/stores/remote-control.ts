import { create } from "zustand";

// Command types supported by the kiosk remote control
export type KioskCommandType =
  | "refresh"
  | "reload-photos"
  | "navigate"
  | "fullscreen"
  | "multiview-add"
  | "multiview-remove"
  | "multiview-clear"
  | "multiview-set"
  | "screensaver";

export interface KioskCommand {
  type: KioskCommandType;
  payload?: Record<string, unknown>;
  timestamp: number;
}

interface RemoteControlState {
  // Pending commands queue
  pendingCommands: KioskCommand[];

  // Add command to queue (called by KioskDisplayPage when polling)
  addCommand: (cmd: KioskCommand) => void;

  // Consume next command (called by MultiViewPage or other handlers)
  consumeCommand: () => KioskCommand | undefined;

  // Clear all pending commands
  clearCommands: () => void;
}

export const useRemoteControlStore = create<RemoteControlState>((set, get) => ({
  pendingCommands: [],

  addCommand: (cmd) =>
    set((state) => ({
      pendingCommands: [...state.pendingCommands, cmd],
    })),

  consumeCommand: () => {
    const { pendingCommands } = get();
    if (pendingCommands.length === 0) return undefined;
    const [first, ...rest] = pendingCommands;
    set({ pendingCommands: rest });
    return first;
  },

  clearCommands: () => set({ pendingCommands: [] }),
}));
