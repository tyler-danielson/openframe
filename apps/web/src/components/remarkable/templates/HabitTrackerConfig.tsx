import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { X, Loader2, Save, Plus, Trash2, GripVertical } from "lucide-react";
import { format, addMonths } from "date-fns";
import { api, type RemarkableTemplate } from "../../../services/api";
import { Button } from "../../ui/Button";

interface HabitTrackerConfigProps {
  template?: RemarkableTemplate;
  onClose: () => void;
  onSave: () => void;
}

const DEFAULT_HABITS = [
  "Exercise",
  "Reading",
  "Meditation",
  "Hydration",
  "Sleep 7+ hrs",
  "Healthy eating",
  "No social media",
  "Journaling",
];

export function HabitTrackerConfig({
  template,
  onClose,
  onSave,
}: HabitTrackerConfigProps) {
  const isEditing = !!template;

  const [name, setName] = useState(template?.name || "Habit Tracker");
  const [folderPath, setFolderPath] = useState(template?.folderPath || "/Calendar/Habit Tracker");
  const [habits, setHabits] = useState<string[]>(
    (template?.config?.habits as string[]) || DEFAULT_HABITS
  );
  const [trackerMonth, setTrackerMonth] = useState<string>(
    (template?.config?.trackerMonth as string) || format(new Date(), "yyyy-MM")
  );
  const [newHabit, setNewHabit] = useState("");

  // Create/Update template
  const saveTemplate = useMutation({
    mutationFn: async () => {
      const config = {
        habits,
        trackerMonth,
      };

      if (isEditing && template) {
        return api.updateRemarkableTemplate(template.id, { name, folderPath, config });
      } else {
        return api.createRemarkableTemplate({
          name,
          templateType: "habit_tracker",
          folderPath,
          config,
        });
      }
    },
    onSuccess: () => {
      onSave();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveTemplate.mutate();
  };

  const addHabit = () => {
    if (newHabit.trim() && habits.length < 15) {
      setHabits([...habits, newHabit.trim()]);
      setNewHabit("");
    }
  };

  const removeHabit = (index: number) => {
    setHabits(habits.filter((_, i) => i !== index));
  };

  const moveHabit = (from: number, to: number) => {
    if (to < 0 || to >= habits.length) return;
    const newHabits = [...habits];
    const removed = newHabits.splice(from, 1)[0];
    if (removed) {
      newHabits.splice(to, 0, removed);
      setHabits(newHabits);
    }
  };

  // Generate month options (current month + next 12 months)
  const monthOptions = Array.from({ length: 13 }, (_, i) => {
    const date = addMonths(new Date(), i);
    return {
      value: format(date, "yyyy-MM"),
      label: format(date, "MMMM yyyy"),
    };
  });

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {isEditing ? "Edit Habit Tracker" : "Create Habit Tracker"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-6">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block font-medium mb-1">
              Template Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
              placeholder="My Habit Tracker"
              required
            />
          </div>

          {/* Folder path */}
          <div>
            <label htmlFor="folderPath" className="block font-medium mb-1">
              Folder Path
            </label>
            <input
              id="folderPath"
              type="text"
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md bg-background font-mono text-sm"
              placeholder="/Calendar/Habit Tracker"
            />
          </div>

          {/* Month */}
          <div>
            <label htmlFor="month" className="block font-medium mb-1">
              Month
            </label>
            <select
              id="month"
              value={trackerMonth}
              onChange={(e) => setTrackerMonth(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
            >
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Habits */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-medium">Habits ({habits.length}/15)</label>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto border border-input rounded-md p-2">
              {habits.map((habit, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-2 bg-muted/50 rounded-md group"
                >
                  <button
                    type="button"
                    className="cursor-grab text-muted-foreground hover:text-foreground"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                  <span className="flex-1 text-sm">{habit}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => moveHabit(index, index - 1)}
                      disabled={index === 0}
                      className="p-1 hover:bg-muted rounded text-xs disabled:opacity-50"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveHabit(index, index + 1)}
                      disabled={index === habits.length - 1}
                      className="p-1 hover:bg-muted rounded text-xs disabled:opacity-50"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeHabit(index)}
                      className="p-1 hover:bg-muted rounded text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {habits.length < 15 && (
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={newHabit}
                  onChange={(e) => setNewHabit(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addHabit();
                    }
                  }}
                  className="flex-1 px-3 py-1.5 border border-input rounded-md bg-background text-sm"
                  placeholder="Add a habit..."
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addHabit}
                  disabled={!newHabit.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={saveTemplate.isPending || habits.length === 0}
            >
              {saveTemplate.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {isEditing ? "Save Changes" : "Create Template"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
