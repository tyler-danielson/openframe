import { useBlockNavStore } from "../stores/block-nav";

const KEY_ICONS: Record<string, string> = {
  up: "▲",
  down: "▼",
  left: "◀",
  right: "▶",
  enter: "OK",
  play_pause: "▶❚❚",
  red: "🔴",
  green: "🟢",
  yellow: "🟡",
  blue: "🔵",
};

export function BlockNavOverlay() {
  const mode = useBlockNavStore((s) => s.mode);
  const blocks = useBlockNavStore((s) => s.blocks);
  const focusedBlockId = useBlockNavStore((s) => s.focusedBlockId);

  if (mode !== "controlling" || !focusedBlockId) return null;

  const block = blocks.find((b) => b.id === focusedBlockId);
  if (!block) return null;

  const controls = block.controls?.actions ?? [];

  // Position the tooltip: if block is in the top half, show below; otherwise above
  const gridRows = 9; // default
  const blockCenterY = block.y + block.height / 2;
  const showBelow = blockCenterY < gridRows / 2;

  return (
    <div
      style={{
        gridColumn: `${block.x + 1} / span ${Math.min(block.width, 4)}`,
        gridRow: showBelow
          ? `${block.y + block.height + 1} / span 2`
          : `${Math.max(block.y - 1, 1)} / span 2`,
        zIndex: 50,
        pointerEvents: "none",
      }}
      className="flex items-start justify-center p-2"
    >
      <div className="bg-black/90 backdrop-blur-md border border-primary/30 rounded-2xl px-4 py-3 max-w-xs pointer-events-auto">
        {block.label && (
          <div className="text-primary text-xs font-semibold mb-2 text-center">
            {block.label}
          </div>
        )}

        {controls.length > 0 ? (
          <div className="space-y-1.5">
            {controls.map((ctrl) => (
              <div key={ctrl.key} className="flex items-center gap-2 text-xs">
                <span className="inline-flex items-center justify-center min-w-[2rem] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono text-[10px] border border-primary/20">
                  {KEY_ICONS[ctrl.key] ?? ctrl.key}
                </span>
                <span className="text-white/80">{ctrl.label}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-white/50 text-xs text-center">No controls</div>
        )}

        <div className="mt-2 pt-2 border-t border-white/10 text-center">
          <span className="text-white/40 text-[10px]">Press Back to return</span>
        </div>
      </div>
    </div>
  );
}
