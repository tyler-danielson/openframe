import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { api } from "../../services/api";
import { Button } from "../ui/Button";

interface Props {
  goal: any;
  onClose: () => void;
}

export function LogProgressModal({ goal, onClose }: Props) {
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      api.logGoalProgress(goal.id, {
        value,
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      onClose();
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value) return;
    mutation.mutate();
  }

  const currentVal = parseFloat(goal.currentValue || "0");
  const targetVal = parseFloat(goal.targetValue || "0");
  const remaining = Math.max(0, targetVal - currentVal);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-sm mx-4">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">Log Progress</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="text-center mb-2">
            <span className="text-2xl">{goal.icon || "🎯"}</span>
            <p className="font-medium mt-1">{goal.name}</p>
            <p className="text-sm text-muted-foreground">
              {currentVal} / {targetVal} {goal.targetUnit || ""}
              {remaining > 0 && ` · ${remaining} remaining`}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary mb-1">
              Amount {goal.targetUnit ? `(${goal.targetUnit})` : ""}
            </label>
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g., 50"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none text-center text-lg"
              autoFocus
              step="any"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-primary mb-1">
              Notes (optional)
            </label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What did you do?"
              className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/30 outline-none text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!value}>
              Log
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
