import { useEffect } from "react";

interface TVControlsOverlayProps {
  visible: boolean;
  onDismiss: () => void;
}

export function TVControlsOverlay({ visible, onDismiss }: TVControlsOverlayProps) {
  // Dismiss on any key press
  useEffect(() => {
    if (!visible) return;

    const handleKey = () => onDismiss();
    window.addEventListener("keydown", handleKey, { once: true });
    return () => window.removeEventListener("keydown", handleKey);
  }, [visible, onDismiss]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9998] bg-black/70 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-300"
      onClick={onDismiss}
    >
      <div
        className="bg-card/95 backdrop-blur-md border border-primary/30 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold text-primary text-center mb-5">
          Remote Controls
        </h2>

        <div className="space-y-4">
          {/* Navigation */}
          <div>
            <h3 className="text-sm font-medium text-primary/80 uppercase tracking-wide mb-2">
              Navigation
            </h3>
            <div className="space-y-1.5">
              <ControlRow label="D-pad" description="Scroll" />
              <ControlRow label="OK" description="Select" />
              <ControlRow label="Back" description="Go back" />
            </div>
          </div>

          {/* Pages */}
          <div>
            <h3 className="text-sm font-medium text-primary/80 uppercase tracking-wide mb-2">
              Pages
            </h3>
            <div className="space-y-1.5">
              <ControlRow label="CH ▲" description="Next page" />
              <ControlRow label="CH ▼" description="Previous page" />
            </div>
          </div>

          {/* Actions */}
          <div>
            <h3 className="text-sm font-medium text-primary/80 uppercase tracking-wide mb-2">
              Actions
            </h3>
            <div className="space-y-1.5">
              <ControlRow label="▶❚❚" description="Refresh kiosk" />
              <ControlRow label="◀◀" description="Show this help" />
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-5">
          Press any button or tap to dismiss
        </p>
      </div>
    </div>
  );
}

function ControlRow({ label, description }: { label: string; description: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <kbd className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/30 font-mono text-xs">
        {label}
      </kbd>
      <span className="text-muted-foreground ml-auto">{description}</span>
    </div>
  );
}
