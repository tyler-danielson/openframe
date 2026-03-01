import { useBlockNavStore } from "../../stores/block-nav";

export function useCardBlockNav(blockNavId: string) {
  const blockNavMode = useBlockNavStore((s) => s.mode);
  const focusedBlockId = useBlockNavStore((s) => s.focusedBlockId);

  const isFocused = focusedBlockId === blockNavId;
  let blockNavClasses = "";
  if (blockNavMode !== "idle") {
    if (blockNavMode === "selecting" && isFocused) {
      blockNavClasses = "ring-3 ring-primary/80 shadow-[0_0_20px_hsl(var(--primary)/0.4)] z-10";
    } else if (blockNavMode === "controlling" && isFocused) {
      blockNavClasses = "ring-4 ring-primary z-10";
    } else if (blockNavMode === "controlling" && !isFocused) {
      blockNavClasses = "opacity-30";
    }
  }

  return { blockNavClasses, isFocused, blockNavMode };
}
