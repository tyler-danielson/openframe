import * as Dialog from "@radix-ui/react-dialog";
import { X, Timer, Plus, Check } from "lucide-react";
import { Button } from "../ui/Button";
import { useScreensaverStore, type WidgetInstance } from "../../stores/screensaver";
import type { CalendarEvent } from "@openframe/shared";

interface CountdownPlaceholderPickerProps {
  event: CalendarEvent;
  open: boolean;
  onClose: () => void;
}

export function CountdownPlaceholderPicker({
  event,
  open,
  onClose,
}: CountdownPlaceholderPickerProps) {
  const layoutConfig = useScreensaverStore((state) => state.layoutConfig);
  const updateBuilderWidget = useScreensaverStore((state) => state.updateBuilderWidget);
  const addWidget = useScreensaverStore((state) => state.addWidget);

  const widgets = layoutConfig.widgets || [];

  // Find countdown widgets that are placeholders (no event assigned)
  const placeholders = widgets.filter(
    (w): w is WidgetInstance =>
      w.type === "countdown" && !w.config.eventId && !w.config.targetDate
  );

  // Find countdown widgets that already have this event assigned
  const assignedToThisEvent = widgets.filter(
    (w): w is WidgetInstance =>
      w.type === "countdown" && w.config.eventId === event.id
  );

  const handleAssign = (widgetId: string) => {
    updateBuilderWidget(widgetId, {
      config: {
        eventId: event.id,
        label: "", // Clear manual label, will use event title
        targetDate: "", // Clear manual date, will use event start time
      },
    });
    onClose();
  };

  const handleCreateNew = () => {
    addWidget({
      type: "countdown",
      x: 0,
      y: 0,
      width: 3,
      height: 2,
      config: {
        eventId: event.id,
        displayMode: "full",
        showDays: true,
        showHours: true,
        showMinutes: true,
        showSeconds: false,
      },
    });
    onClose();
  };

  const getDisplayModeLabel = (mode: string) => {
    switch (mode) {
      case "days":
        return "Sleeps";
      case "full":
      default:
        return "Full Timer";
    }
  };

  const getPositionLabel = (widget: WidgetInstance) => {
    return `Col ${widget.x + 1}, Row ${widget.y + 1}`;
  };

  return (
    <Dialog.Root open={open} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-fade-in z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 max-h-[85vh] w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-xl border border-border bg-card p-4 shadow-xl data-[state=open]:animate-slide-up z-50">
          <div className="mb-4 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Timer className="h-5 w-5 text-primary" />
              </div>
              <div>
                <Dialog.Title className="text-lg font-semibold">
                  Add Countdown
                </Dialog.Title>
                <p className="text-sm text-muted-foreground">
                  {event.title}
                </p>
              </div>
            </div>
            <Dialog.Close asChild>
              <button className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            {/* Already assigned notice */}
            {assignedToThisEvent.length > 0 && (
              <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3">
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <Check className="h-4 w-4" />
                  <span>
                    This event is already assigned to {assignedToThisEvent.length} countdown
                    {assignedToThisEvent.length > 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            )}

            {/* Available placeholders */}
            {placeholders.length > 0 ? (
              <div>
                <h3 className="text-sm font-medium mb-2">Available Placeholders</h3>
                <div className="space-y-2">
                  {placeholders.map((placeholder) => (
                    <button
                      key={placeholder.id}
                      onClick={() => handleAssign(placeholder.id)}
                      className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <Timer className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">
                            {(placeholder.config.label as string) || "Countdown Placeholder"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {getDisplayModeLabel(placeholder.config.displayMode as string)} · {getPositionLabel(placeholder)}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-primary">Assign</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <Timer className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-1">
                  No countdown placeholders available
                </p>
                <p className="text-xs text-muted-foreground">
                  Create a new countdown widget or add placeholders in the Screensaver Builder
                </p>
              </div>
            )}

            {/* Create new button */}
            <Button
              onClick={handleCreateNew}
              className="w-full"
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create New Countdown Widget
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
