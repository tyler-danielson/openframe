import { useEffect } from "react";

export interface HelpItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
}

interface SidebarHelpOverlayProps {
  visible: boolean;
  onDismiss: () => void;
  navItems: HelpItem[];
  controlItems: HelpItem[];
}

export function SidebarHelpOverlay({ visible, onDismiss, navItems, controlItems }: SidebarHelpOverlayProps) {
  useEffect(() => {
    if (!visible) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [visible, onDismiss]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9998] bg-black/70 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-300"
      onClick={onDismiss}
    >
      <div
        className="bg-card/95 backdrop-blur-md border border-primary/30 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold text-primary text-center mb-5">
          Sidebar Guide
        </h2>

        <div className="space-y-4">
          {navItems.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-primary/80 uppercase tracking-wide mb-2">
                Pages
              </h3>
              <div className="space-y-1.5">
                {navItems.map((item) => (
                  <HelpRow key={item.label} item={item} />
                ))}
              </div>
            </div>
          )}

          {controlItems.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-primary/80 uppercase tracking-wide mb-2">
                Controls
              </h3>
              <div className="space-y-1.5">
                {controlItems.map((item) => (
                  <HelpRow key={item.label} item={item} />
                ))}
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center mt-5">
          Tap outside or press Escape to close
        </p>
      </div>
    </div>
  );
}

function HelpRow({ item }: { item: HelpItem }) {
  const Icon = item.icon;
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <span className="font-medium text-foreground">{item.label}</span>
      <span className="text-muted-foreground ml-auto text-right text-xs">{item.description}</span>
    </div>
  );
}
