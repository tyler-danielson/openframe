import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { api } from "../../services/api";
import { Button } from "../ui/Button";

const ICONS = ["🏃", "📖", "💊", "🧘", "🐕", "💪", "🎯", "🍎", "💤", "📝", "🎵", "🧹"];
const COLORS = ["#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#F97316"];

interface Props {
  habit?: any;
  onClose: () => void;
}

export function AddHabitModal({ habit, onClose }: Props) {
  const isEditing = !!habit;
  const queryClient = useQueryClient();

  const [name, setName] = useState(habit?.name ?? "");
  const [icon, setIcon] = useState(habit?.icon ?? "🎯");
  const [color, setColor] = useState(habit?.color ?? "#3B82F6");
  const [frequency, setFrequency] = useState(habit?.frequency ?? "daily");
  const [targetCount, setTargetCount] = useState(habit?.targetCount ?? 1);
  const [isShared, setIsShared] = useState(habit?.isShared ?? false);

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      isEditing ? api.updateHabit(habit.id, data) : api.createHabit(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
      onClose();
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({
      name: name.trim(),
      icon,
      color,
      frequency,
      targetCount,
      isShared,
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {isEditing ? "Edit Habit" : "New Habit"}
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
              placeholder="e.g., Exercise, Read 30 min"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
              autoFocus
            />
          </div>

          {/* Icon picker */}
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
                  className={cn(
                    "w-10 h-10 flex items-center justify-center rounded-lg text-lg transition-colors",
                    icon === emoji
                      ? "bg-primary/20 ring-2 ring-primary"
                      : "hover:bg-muted"
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Color picker */}
          <div>
            <label className="block text-sm font-medium text-primary mb-1">
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition-transform ${
                    color === c ? "ring-2 ring-primary scale-110" : ""
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-sm font-medium text-primary mb-1">
              Frequency
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/30 outline-none"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {/* Target count (for weekly) */}
          {frequency === "weekly" && (
            <div>
              <label className="block text-sm font-medium text-primary mb-1">
                Times per week
              </label>
              <input
                type="number"
                min={1}
                max={7}
                value={targetCount}
                onChange={(e) => setTargetCount(Number(e.target.value))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/30 outline-none"
              />
            </div>
          )}

          {/* Shared toggle */}
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

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
