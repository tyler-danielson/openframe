import { create } from "zustand";

export type BlockNavMode = "idle" | "selecting" | "controlling";

export interface NavigableBlock {
  id: string;
  group?: string; // "nav" for sidebar, "page" for page content
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  controls?: TVBlockControls;
  instantAction?: () => void; // If set, OK triggers this instead of entering controlling mode
}

export interface WidgetRemoteAction {
  key: string;         // "channel-change", "mute-toggle", "next-photo", etc.
  label: string;
  execute: (data?: Record<string, unknown>) => void;
}

export interface TVBlockControls {
  actions: TVControlAction[];
  remoteActions?: WidgetRemoteAction[];
}

export interface TVControlAction {
  key: string; // "up"|"down"|"left"|"right"|"enter"|"red"|"green"|"yellow"|"blue"|"play_pause"
  label: string;
  action: () => void;
}

interface BlockNavState {
  mode: BlockNavMode;
  blocks: NavigableBlock[];
  focusedBlockId: string | null;
  _debug: string; // temporary debug trace

  // Actions
  registerBlocks: (blocks: NavigableBlock[], group?: string) => void;
  clearBlocks: (group?: string) => void;
  activateSelection: (preferGroup?: string) => void;
  deactivateNavigation: () => void;
  focusBlock: (id: string) => void;
  enterBlock: () => void;
  exitBlock: () => void;
  navigateDirection: (direction: "up" | "down" | "left" | "right") => void;
  executeControl: (key: string) => boolean;
  updateBlockControls: (blockId: string, controls: TVBlockControls | null) => void;
  executeRemoteAction: (widgetId: string, actionKey: string, data?: Record<string, unknown>) => boolean;
}

export const useBlockNavStore = create<BlockNavState>()((set, get) => ({
  mode: "idle",
  blocks: [],
  focusedBlockId: null,
  _debug: "",

  registerBlocks: (newBlocks, group) => {
    if (group) {
      // Merge: remove existing blocks in this group, add new ones
      const { blocks: existing } = get();
      const tagged = newBlocks.map((b) => ({ ...b, group }));
      const filtered = existing.filter((b) => b.group !== group);
      set({ blocks: [...filtered, ...tagged] });
    } else {
      set({ blocks: newBlocks });
    }
  },

  clearBlocks: (group) => {
    if (group) {
      const { blocks, focusedBlockId } = get();
      const remaining = blocks.filter((b) => b.group !== group);
      // If the focused block was in the cleared group, unfocus
      const focusedStillExists = remaining.some((b) => b.id === focusedBlockId);
      set({
        blocks: remaining,
        ...(focusedStillExists ? {} : { focusedBlockId: null }),
        ...(remaining.length === 0 ? { mode: "idle", focusedBlockId: null } : {}),
      });
    } else {
      set({ blocks: [], mode: "idle", focusedBlockId: null });
    }
  },

  activateSelection: (preferGroup?: string) => {
    const { blocks } = get();
    if (blocks.length === 0) return;
    // If a specific group is requested (e.g., "nav" for left/back), use that
    if (preferGroup) {
      const groupBlocks = blocks.filter((b) => b.group === preferGroup);
      if (groupBlocks.length > 0) {
        const sorted = [...groupBlocks].sort((a, b) => a.y - b.y || a.x - b.x);
        set({ mode: "selecting", focusedBlockId: sorted[0]?.id ?? null });
        return;
      }
    }
    // Default: only activate on page content blocks, never fall back to sidebar
    const pageBlocks = blocks.filter((b) => b.group !== "nav");
    if (pageBlocks.length === 0) return;
    const sorted = [...pageBlocks].sort((a, b) => a.y - b.y || a.x - b.x);
    set({ mode: "selecting", focusedBlockId: sorted[0]?.id ?? null });
  },

  deactivateNavigation: () => {
    set({ mode: "idle", focusedBlockId: null });
  },

  focusBlock: (id) => {
    set({ focusedBlockId: id });
  },

  enterBlock: () => {
    const { focusedBlockId, mode, blocks } = get();
    if (mode !== "selecting" || !focusedBlockId) return;

    const block = blocks.find((b) => b.id === focusedBlockId);
    if (block?.instantAction) {
      // Execute immediately (e.g., sidebar navigation)
      block.instantAction();
      // After navigation, auto-focus the first page content block once it registers
      // Use a delay to let the new page render and register its blocks
      set({ mode: "idle", focusedBlockId: null });
      setTimeout(() => {
        const { blocks: currentBlocks } = get();
        const pageBlocks = currentBlocks.filter((b) => b.group !== "nav");
        if (pageBlocks.length > 0) {
          const sorted = [...pageBlocks].sort((a, b) => a.y - b.y || a.x - b.x);
          set({ mode: "selecting", focusedBlockId: sorted[0]?.id ?? null });
        }
      }, 300);
      return;
    }

    set({ mode: "controlling" });
  },

  exitBlock: () => {
    set({ mode: "selecting" });
  },

  navigateDirection: (direction) => {
    const { blocks, focusedBlockId } = get();
    if (!focusedBlockId || blocks.length === 0) return;

    const current = blocks.find((b) => b.id === focusedBlockId);
    if (!current) return;

    // Compute center of current block
    const cx = current.x + current.width / 2;
    const cy = current.y + current.height / 2;

    // Filter candidates in the pressed direction and score them
    let best: NavigableBlock | null = null;
    let bestScore = Infinity;

    for (const block of blocks) {
      if (block.id === focusedBlockId) continue;

      const bx = block.x + block.width / 2;
      const by = block.y + block.height / 2;

      const dx = bx - cx;
      const dy = by - cy;

      // Check if the block is in the correct direction
      let inDirection = false;
      let primaryDist = 0;
      let perpOffset = 0;

      switch (direction) {
        case "up":
          inDirection = dy < 0;
          primaryDist = Math.abs(dy);
          perpOffset = Math.abs(dx);
          break;
        case "down":
          inDirection = dy > 0;
          primaryDist = Math.abs(dy);
          perpOffset = Math.abs(dx);
          break;
        case "left":
          inDirection = dx < 0;
          primaryDist = Math.abs(dx);
          perpOffset = Math.abs(dy);
          break;
        case "right":
          inDirection = dx > 0;
          primaryDist = Math.abs(dx);
          perpOffset = Math.abs(dy);
          break;
      }

      if (!inDirection) continue;

      // Score: strongly prefer aligned blocks (low perpendicular offset)
      const score = perpOffset * 10 + primaryDist;
      if (score < bestScore) {
        bestScore = score;
        best = block;
      }
    }

    if (best) {
      set({ focusedBlockId: best.id });
    }
  },

  executeControl: (key) => {
    const { blocks, focusedBlockId, mode } = get();
    if (mode !== "controlling" || !focusedBlockId) return false;

    const block = blocks.find((b) => b.id === focusedBlockId);
    if (!block?.controls) return false;

    const action = block.controls.actions.find((a) => a.key === key);
    if (action) {
      action.action();
      return true;
    }
    return false;
  },

  updateBlockControls: (blockId, controls) => {
    const { blocks } = get();
    const newBlocks = blocks.map((b) =>
      b.id === blockId ? { ...b, controls: controls ?? undefined } : b
    );
    set({ blocks: newBlocks });
  },

  executeRemoteAction: (widgetId, actionKey, data) => {
    const { blocks } = get();
    const block = blocks.find((b) => b.id === widgetId);
    if (!block?.controls?.remoteActions) return false;

    const remoteAction = block.controls.remoteActions.find((a) => a.key === actionKey);
    if (remoteAction) {
      remoteAction.execute(data);
      return true;
    }
    return false;
  },
}));
