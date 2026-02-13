import { useState } from "react";
import { X, Timer } from "lucide-react";
import { Button } from "../ui/Button";

interface AddTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (data: {
    name: string;
    durationSeconds: number;
    saveAsPreset: boolean;
  }) => void;
}

export function AddTimerModal({ isOpen, onClose, onStart }: AddTimerModalProps) {
  const [name, setName] = useState("");
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [saveAsPreset, setSaveAsPreset] = useState(false);

  if (!isOpen) return null;

  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  const isValid = name.trim() && totalSeconds > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    onStart({
      name: name.trim(),
      durationSeconds: totalSeconds,
      saveAsPreset,
    });
    // Reset form
    setName("");
    setHours(0);
    setMinutes(0);
    setSeconds(0);
    setSaveAsPreset(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Timer className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">New Timer</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Timer Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Boil pasta"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              autoFocus
            />
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Duration
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="block text-xs text-muted-foreground mb-1">Hours</label>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={hours}
                  onChange={(e) => setHours(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm text-center tabular-nums"
                />
              </div>
              <span className="text-lg font-bold text-muted-foreground mt-4">:</span>
              <div className="flex-1">
                <label className="block text-xs text-muted-foreground mb-1">Minutes</label>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={minutes}
                  onChange={(e) => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm text-center tabular-nums"
                />
              </div>
              <span className="text-lg font-bold text-muted-foreground mt-4">:</span>
              <div className="flex-1">
                <label className="block text-xs text-muted-foreground mb-1">Seconds</label>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={seconds}
                  onChange={(e) => setSeconds(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm text-center tabular-nums"
                />
              </div>
            </div>
          </div>

          {/* Save as preset */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={saveAsPreset}
              onChange={(e) => setSaveAsPreset(e.target.checked)}
              className="rounded border-border"
            />
            <span className="text-sm text-muted-foreground">Save as preset for quick access</span>
          </label>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid}>
              Start Timer
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
