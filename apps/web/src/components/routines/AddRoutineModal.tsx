import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "../ui/Button";
import type { RoutineWithCompletions, FamilyProfile, RoutineFrequency } from "@openframe/shared";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface AddRoutineModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string;
    icon: string | null;
    category: string | null;
    frequency: RoutineFrequency;
    daysOfWeek: number[] | null;
    assignedProfileId: string | null;
  }) => void;
  editingRoutine?: RoutineWithCompletions | null;
  profiles: FamilyProfile[];
}

export function AddRoutineModal({
  open,
  onClose,
  onSave,
  editingRoutine,
  profiles,
}: AddRoutineModalProps) {
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("");
  const [category, setCategory] = useState("");
  const [frequency, setFrequency] = useState<RoutineFrequency>("daily");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [assignedProfileId, setAssignedProfileId] = useState<string>("");

  useEffect(() => {
    if (editingRoutine) {
      setTitle(editingRoutine.title);
      setIcon(editingRoutine.icon || "");
      setCategory(editingRoutine.category || "");
      setFrequency(editingRoutine.frequency);
      setDaysOfWeek(editingRoutine.daysOfWeek || []);
      setAssignedProfileId(editingRoutine.assignedProfileId || "");
    } else {
      setTitle("");
      setIcon("");
      setCategory("");
      setFrequency("daily");
      setDaysOfWeek([]);
      setAssignedProfileId("");
    }
  }, [editingRoutine, open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSave({
      title: title.trim(),
      icon: icon.trim() || null,
      category: category.trim() || null,
      frequency,
      daysOfWeek: frequency === "weekly" ? daysOfWeek : null,
      assignedProfileId: assignedProfileId || null,
    });
  };

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            {editingRoutine ? "Edit Routine" : "Add Routine"}
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Brush Teeth"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
          </div>

          {/* Icon & Category row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Icon (emoji)
              </label>
              <input
                type="text"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="🪥"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Category
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g., morning"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Frequency
            </label>
            <div className="flex gap-2">
              {(["daily", "weekly", "custom"] as RoutineFrequency[]).map(
                (f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFrequency(f)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                      frequency === f
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {f}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Days of week (for weekly) */}
          {frequency === "weekly" && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Days
              </label>
              <div className="flex gap-1.5">
                {DAY_LABELS.map((label, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={`flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium transition-colors ${
                      daysOfWeek.includes(i)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Assigned profile */}
          {profiles.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Assign to
              </label>
              <select
                value={assignedProfileId}
                onChange={(e) => setAssignedProfileId(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Anyone</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.icon ? `${p.icon} ` : ""}
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim()}>
              {editingRoutine ? "Save" : "Add Routine"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
