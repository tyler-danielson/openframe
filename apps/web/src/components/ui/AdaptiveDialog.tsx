import { type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import type { ModalLayout } from "../../hooks/useAdaptiveModalLayout";

interface AdaptiveDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  layout: ModalLayout;
}

/**
 * Dialog shell that adapts its width based on the layout mode.
 * Uses the same custom overlay pattern as other modals in the app.
 *
 * - vertical: max-w-md (standard single-column)
 * - horizontal: max-w-3xl (wide two-column)
 */
export function AdaptiveDialog({ open, onClose, title, children, layout }: AdaptiveDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div
        className={cn(
          "relative z-10 w-full rounded-xl border border-border bg-card p-6 shadow-xl",
          "transition-[max-width] duration-200",
          layout === "horizontal"
            ? "max-w-3xl max-h-[90vh] overflow-y-auto"
            : "max-w-md max-h-[90vh] overflow-y-auto"
        )}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
