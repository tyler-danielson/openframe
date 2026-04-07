import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Plus, Trash2 } from "lucide-react";
import { api } from "../../services/api";
import { Button } from "../ui/Button";

const ICONS = ["🏃", "📚", "💰", "🎓", "💪", "🎯", "🏆", "✈️", "🏠", "🎵", "📝", "🌱"];

interface Props {
  goal?: any;
  onClose: () => void;
}

export function AddGoalModal({ goal, onClose }: Props) {
  const isEditing = !!goal;
  const queryClient = useQueryClient();

  const [name, setName] = useState(goal?.name ?? "");
  const [description, setDescription] = useState(goal?.description ?? "");
  const [icon, setIcon] = useState(goal?.icon ?? "🎯");
  const [goalType, setGoalType] = useState(goal?.goalType ?? "milestone");
  const [targetValue, setTargetValue] = useState(goal?.targetValue ?? "");
  const [targetUnit, setTargetUnit] = useState(goal?.targetUnit ?? "");
  const [targetPeriod, setTargetPeriod] = useState(goal?.targetPeriod ?? "total");
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? "");
  const [milestones, setMilestones] = useState<string[]>(
    (goal?.milestones ?? []).map((m: any) => m.name)
  );
  const [newMilestone, setNewMilestone] = useState("");
  const [isShared, setIsShared] = useState(goal?.isShared ?? false);

  const mutation = useMutation({
    mutationFn: (data: any) =>
      isEditing ? api.updateGoal(goal.id, data) : api.createGoal(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      onClose();
    },
  });

  function handleAddMilestone() {
    if (!newMilestone.trim()) return;
    setMilestones([...milestones, newMilestone.trim()]);
    setNewMilestone("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const data: any = {
      name: name.trim(),
      description: description.trim() || undefined,
      icon,
      goalType,
      isShared,
      targetDate: targetDate || undefined,
    };

    if (goalType === "quantifiable") {
      data.targetValue = targetValue;
      data.targetUnit = targetUnit;
      data.targetPeriod = targetPeriod;
    } else {
      data.milestones = milestones.map((m) => ({ name: m }));
    }

    mutation.mutate(data);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[85vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
          <h2 className="text-lg font-semibold">
            {isEditing ? "Edit Goal" : "New Goal"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-primary mb-1">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Complete React Course"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-primary mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/30 outline-none resize-none"
            />
          </div>

          {/* Icon */}
          <div>
            <label className="block text-sm font-medium text-primary mb-1">
              Icon
            </label>
            <div className="flex flex-wrap gap-2">
              {ICONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className={`w-10 h-10 flex items-center justify-center rounded-lg text-lg transition-colors ${
                    icon === emoji
                      ? "bg-primary/20 ring-2 ring-primary"
                      : "hover:bg-muted"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Goal type */}
          <div>
            <label className="block text-sm font-medium text-primary mb-1">
              Type
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setGoalType("milestone")}
                className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-colors ${
                  goalType === "milestone"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/40"
                }`}
              >
                Milestone
              </button>
              <button
                type="button"
                onClick={() => setGoalType("quantifiable")}
                className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-colors ${
                  goalType === "quantifiable"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/40"
                }`}
              >
                Quantifiable
              </button>
            </div>
          </div>

          {/* Quantifiable fields */}
          {goalType === "quantifiable" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-primary mb-1">
                    Target
                  </label>
                  <input
                    type="number"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    placeholder="e.g., 500"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/30 outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-primary mb-1">
                    Unit
                  </label>
                  <input
                    value={targetUnit}
                    onChange={(e) => setTargetUnit(e.target.value)}
                    placeholder="e.g., dollars, pages"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/30 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-primary mb-1">
                  Period
                </label>
                <select
                  value={targetPeriod}
                  onChange={(e) => setTargetPeriod(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/30 outline-none"
                >
                  <option value="total">Total (all-time)</option>
                  <option value="weekly">Per week</option>
                  <option value="monthly">Per month</option>
                  <option value="daily">Per day</option>
                </select>
              </div>
            </div>
          )}

          {/* Milestones */}
          {goalType === "milestone" && (
            <div>
              <label className="block text-sm font-medium text-primary mb-1">
                Milestones
              </label>
              <div className="space-y-2 mb-2">
                {milestones.map((m, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 bg-muted/50 px-3 py-2 rounded-lg"
                  >
                    <span className="flex-1 text-sm">{m}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setMilestones(milestones.filter((_, j) => j !== i))
                      }
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={newMilestone}
                  onChange={(e) => setNewMilestone(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && (e.preventDefault(), handleAddMilestone())
                  }
                  placeholder="Add milestone..."
                  className="flex-1 px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/30 outline-none text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddMilestone}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Target date */}
          <div>
            <label className="block text-sm font-medium text-primary mb-1">
              Target Date (optional)
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/30 outline-none"
            />
          </div>

          {/* Shared */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isShared}
              onChange={(e) => setIsShared(e.target.checked)}
              className="rounded border-border"
            />
            <span className="text-sm">Share with family</span>
          </label>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              {isEditing ? "Save" : "Create"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
