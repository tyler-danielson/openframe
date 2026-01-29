import { useState, useEffect } from "react";
import { X, Timer, Clock } from "lucide-react";
import { Button } from "../ui/Button";
import { TouchTimePicker } from "../ui/TouchTimePicker";
import { cn } from "../../lib/utils";

export interface EntityTimer {
  id: string;
  entityId: string;
  action: "turn_on" | "turn_off";
  triggerAt: string;
  fadeEnabled: boolean;
  fadeDuration: number;
  createdAt: string;
}

interface EntityTimerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  entityId: string;
  entityName: string;
  currentState: "on" | "off" | string;
  domain: "light" | "switch";
  existingTimer?: EntityTimer | null;
  onCreateTimer: (data: {
    entityId: string;
    action: "turn_on" | "turn_off";
    triggerAt: string;
    fadeEnabled: boolean;
    fadeDuration: number;
  }) => Promise<void>;
  onCancelTimer: (timerId: string) => Promise<void>;
}

type TimeMode = "duration" | "specific";
type DurationPreset = 5 | 15 | 30 | 60 | 120 | "custom";

const DURATION_PRESETS: { value: DurationPreset; label: string }[] = [
  { value: 5, label: "5m" },
  { value: 15, label: "15m" },
  { value: 30, label: "30m" },
  { value: 60, label: "1h" },
  { value: 120, label: "2h" },
  { value: "custom", label: "Custom" },
];

const FADE_DURATIONS: { value: number; label: string }[] = [
  { value: 60, label: "1 min" },
  { value: 300, label: "5 min" },
  { value: 600, label: "10 min" },
  { value: 900, label: "15 min" },
  { value: 1800, label: "30 min" },
];

export function EntityTimerMenu({
  isOpen,
  onClose,
  entityId,
  entityName,
  currentState,
  domain,
  existingTimer,
  onCreateTimer,
  onCancelTimer,
}: EntityTimerMenuProps) {
  // Smart default: action is opposite of current state
  const defaultAction = currentState === "on" ? "turn_off" : "turn_on";

  const [action, setAction] = useState<"turn_on" | "turn_off">(defaultAction);
  const [timeMode, setTimeMode] = useState<TimeMode>("duration");
  const [selectedPreset, setSelectedPreset] = useState<DurationPreset>(15);
  const [customMinutes, setCustomMinutes] = useState(15);
  const [specificTime, setSpecificTime] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30);
    return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
  });
  const [fadeEnabled, setFadeEnabled] = useState(false);
  const [fadeDuration, setFadeDuration] = useState(300); // 5 minutes default
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when entity changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setAction(currentState === "on" ? "turn_off" : "turn_on");
      setTimeMode("duration");
      setSelectedPreset(15);
      setFadeEnabled(false);
    }
  }, [isOpen, entityId, currentState]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      let triggerAt: Date;

      if (timeMode === "duration") {
        const minutes = selectedPreset === "custom" ? customMinutes : selectedPreset;
        triggerAt = new Date();
        triggerAt.setMinutes(triggerAt.getMinutes() + minutes);
      } else {
        // Specific time
        const [hours, mins] = specificTime.split(":").map(Number);
        triggerAt = new Date();
        triggerAt.setHours(hours ?? 0, mins ?? 0, 0, 0);

        // If the time is in the past, assume it's for tomorrow
        if (triggerAt <= new Date()) {
          triggerAt.setDate(triggerAt.getDate() + 1);
        }
      }

      await onCreateTimer({
        entityId,
        action,
        triggerAt: triggerAt.toISOString(),
        fadeEnabled: domain === "light" && fadeEnabled,
        fadeDuration: domain === "light" && fadeEnabled ? fadeDuration : 0,
      });

      onClose();
    } catch (error) {
      console.error("Failed to create timer:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelExisting = async () => {
    if (!existingTimer) return;
    setIsSubmitting(true);
    try {
      await onCancelTimer(existingTimer.id);
      onClose();
    } catch (error) {
      console.error("Failed to cancel timer:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatRemainingTime = (triggerAt: string): string => {
    const target = new Date(triggerAt);
    const now = new Date();
    const diffMs = target.getTime() - now.getTime();

    if (diffMs <= 0) return "Now";

    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m`;

    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Timer for {entityName}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Existing Timer Banner */}
          {existingTimer && (
            <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-sm">
                  Timer active: {existingTimer.action === "turn_on" ? "Turn On" : "Turn Off"} in{" "}
                  <strong>{formatRemainingTime(existingTimer.triggerAt)}</strong>
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelExisting}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </div>
          )}

          {/* Action Selection */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Action
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setAction("turn_off")}
                className={cn(
                  "flex-1 py-3 px-4 rounded-lg font-medium transition-all",
                  action === "turn_off"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                Turn Off
              </button>
              <button
                onClick={() => setAction("turn_on")}
                className={cn(
                  "flex-1 py-3 px-4 rounded-lg font-medium transition-all",
                  action === "turn_on"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                Turn On
              </button>
            </div>
          </div>

          {/* Time Selection */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              When
            </label>

            {/* Mode Toggle */}
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setTimeMode("duration")}
                className={cn(
                  "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all",
                  timeMode === "duration"
                    ? "bg-secondary text-secondary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                In duration...
              </button>
              <button
                onClick={() => setTimeMode("specific")}
                className={cn(
                  "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all",
                  timeMode === "specific"
                    ? "bg-secondary text-secondary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                At specific time...
              </button>
            </div>

            {/* Duration Presets */}
            {timeMode === "duration" && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {DURATION_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => setSelectedPreset(preset.value)}
                      className={cn(
                        "py-2 px-4 rounded-lg font-medium transition-all",
                        selectedPreset === preset.value
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Custom duration input */}
                {selectedPreset === "custom" && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="1440"
                      value={customMinutes}
                      onChange={(e) => setCustomMinutes(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-24 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-center"
                    />
                    <span className="text-muted-foreground">minutes</span>
                  </div>
                )}
              </div>
            )}

            {/* Specific Time Picker */}
            {timeMode === "specific" && (
              <TouchTimePicker
                value={specificTime}
                onChange={setSpecificTime}
              />
            )}
          </div>

          {/* Fade Option (lights only) */}
          {domain === "light" && (
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setFadeEnabled(!fadeEnabled)}
                  className={cn(
                    "relative h-6 w-11 rounded-full transition-colors",
                    fadeEnabled ? "bg-primary" : "bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
                      fadeEnabled ? "left-5" : "left-0.5"
                    )}
                  />
                </div>
                <span className="text-sm font-medium">
                  Fade gradually
                </span>
              </label>

              {fadeEnabled && (
                <div className="mt-3 pl-14">
                  <div className="flex flex-wrap gap-2">
                    {FADE_DURATIONS.map((fd) => (
                      <button
                        key={fd.value}
                        onClick={() => setFadeDuration(fd.value)}
                        className={cn(
                          "py-1.5 px-3 rounded-lg text-sm font-medium transition-all",
                          fadeDuration === fd.value
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        )}
                      >
                        {fd.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-4 border-t border-border">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Setting..." : "Set Timer"}
          </Button>
        </div>
      </div>
    </div>
  );
}
