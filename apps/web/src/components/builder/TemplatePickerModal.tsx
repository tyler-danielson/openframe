import { useState } from "react";
import {
  X,
  LayoutDashboard,
  Image,
  MonitorPlay,
  AlertTriangle,
  Check,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { SCREEN_TEMPLATES, type ScreenTemplate } from "../../lib/widgets/templates";
import { useModuleStore } from "../../stores/modules";

const TEMPLATE_ICONS: Record<string, React.ElementType> = {
  LayoutDashboard,
  Image,
  MonitorPlay,
};

interface TemplatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (template: ScreenTemplate) => void;
  hasExistingWidgets: boolean;
}

export function TemplatePickerModal({
  isOpen,
  onClose,
  onApply,
  hasExistingWidgets,
}: TemplatePickerModalProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const { isEnabled } = useModuleStore();

  if (!isOpen) return null;

  const handleApply = (template: ScreenTemplate) => {
    if (hasExistingWidgets && confirmingId !== template.id) {
      setConfirmingId(template.id);
      return;
    }
    onApply(template);
    onClose();
  };

  const getMissingModules = (template: ScreenTemplate) => {
    return template.requiredModules.filter((m) => !isEnabled(m));
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div>
              <h3 className="text-lg font-semibold">Start from Template</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Choose a pre-built layout as your starting point
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Template Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {SCREEN_TEMPLATES.map((template) => {
                const Icon = TEMPLATE_ICONS[template.icon] || LayoutDashboard;
                const missingModules = getMissingModules(template);
                const isConfirming = confirmingId === template.id;

                return (
                  <div
                    key={template.id}
                    className={cn(
                      "border rounded-xl p-4 transition-all cursor-pointer hover:border-primary/50 hover:shadow-md",
                      isConfirming
                        ? "border-amber-500 bg-amber-500/5"
                        : "border-border bg-card"
                    )}
                  >
                    {/* Icon and Title */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold truncate">
                          {template.name}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {template.widgets.length} widgets
                        </p>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                      {template.description}
                    </p>

                    {/* Mini Preview Grid */}
                    <div
                      className="relative bg-muted/50 rounded-lg mb-3 overflow-hidden"
                      style={{
                        aspectRatio: `${template.gridColumns}/${template.gridRows}`,
                      }}
                    >
                      {template.widgets.map((w, i) => (
                        <div
                          key={i}
                          className="absolute bg-primary/20 border border-primary/30 rounded-sm"
                          style={{
                            left: `${(w.x / template.gridColumns) * 100}%`,
                            top: `${(w.y / template.gridRows) * 100}%`,
                            width: `${(w.width / template.gridColumns) * 100}%`,
                            height: `${(w.height / template.gridRows) * 100}%`,
                          }}
                        >
                          <span className="text-[6px] text-primary/60 p-0.5 truncate block">
                            {w.type}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Missing Modules Warning */}
                    {missingModules.length > 0 && (
                      <div className="flex items-start gap-1.5 mb-3 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          Requires: {missingModules.join(", ")}
                        </p>
                      </div>
                    )}

                    {/* Apply Button */}
                    <button
                      onClick={() => handleApply(template)}
                      className={cn(
                        "w-full py-2 px-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2",
                        isConfirming
                          ? "bg-amber-500 text-white hover:bg-amber-600"
                          : "bg-primary text-primary-foreground hover:bg-primary/90"
                      )}
                    >
                      {isConfirming ? (
                        <>
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Replace current layout?
                        </>
                      ) : (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          Use Template
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
