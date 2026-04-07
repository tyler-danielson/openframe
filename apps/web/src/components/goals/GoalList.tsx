import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Check,
  Circle,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Trash2,
  Pencil,
  Trophy,
} from "lucide-react";
import { api } from "../../services/api";
import { Button } from "../ui/Button";
import { AddGoalModal } from "./AddGoalModal";
import { LogProgressModal } from "./LogProgressModal";

export function GoalList() {
  const [showAdd, setShowAdd] = useState(false);
  const [editingGoal, setEditingGoal] = useState<any>(null);
  const [loggingGoal, setLoggingGoal] = useState<any>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ["goals"],
    queryFn: () => api.getGoals(),
  });

  const completeMilestoneMutation = useMutation({
    mutationFn: ({
      goalId,
      milestoneId,
    }: {
      goalId: string;
      milestoneId: string;
    }) => api.completeMilestone(goalId, milestoneId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });

  const completeGoalMutation = useMutation({
    mutationFn: (id: string) => api.completeGoal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteGoal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });

  const activeGoals = goals.filter((g: any) => g.isActive && !g.completedAt);
  const completedGoals = goals.filter((g: any) => !g.isActive || g.completedAt);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading goals...
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-primary">Active Goals</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdd(true)}
          className="border-primary/40 text-primary"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Goal
        </Button>
      </div>

      {/* Active goals */}
      {activeGoals.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Trophy className="h-12 w-12 mx-auto mb-3 text-primary/30" />
          <p className="text-lg mb-2">No active goals</p>
          <p className="text-sm">Set a goal to start tracking your progress.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeGoals.map((goal: any) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onLog={() => setLoggingGoal(goal)}
              onCompleteMilestone={(milestoneId) =>
                completeMilestoneMutation.mutate({
                  goalId: goal.id,
                  milestoneId,
                })
              }
              onComplete={() => completeGoalMutation.mutate(goal.id)}
              onEdit={() => {
                setEditingGoal(goal);
                setShowAdd(true);
              }}
              onDelete={() => deleteMutation.mutate(goal.id)}
              menuOpen={menuOpen}
              setMenuOpen={setMenuOpen}
            />
          ))}
        </div>
      )}

      {/* Completed goals (collapsible) */}
      {completedGoals.length > 0 && (
        <div>
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mt-6"
          >
            {showCompleted ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            Completed Goals ({completedGoals.length})
          </button>

          {showCompleted && (
            <div className="space-y-3 mt-3 opacity-60">
              {completedGoals.map((goal: any) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onLog={() => {}}
                  onCompleteMilestone={() => {}}
                  onComplete={() => {}}
                  onEdit={() => {}}
                  onDelete={() => deleteMutation.mutate(goal.id)}
                  menuOpen={menuOpen}
                  setMenuOpen={setMenuOpen}
                  completed
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showAdd && (
        <AddGoalModal
          goal={editingGoal}
          onClose={() => {
            setShowAdd(false);
            setEditingGoal(null);
          }}
        />
      )}

      {loggingGoal && (
        <LogProgressModal
          goal={loggingGoal}
          onClose={() => setLoggingGoal(null)}
        />
      )}
    </div>
  );
}

function GoalCard({
  goal,
  onLog,
  onCompleteMilestone,
  onComplete,
  onEdit,
  onDelete,
  menuOpen,
  setMenuOpen,
  completed = false,
}: {
  goal: any;
  onLog: () => void;
  onCompleteMilestone: (id: string) => void;
  onComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
  menuOpen: string | null;
  setMenuOpen: (id: string | null) => void;
  completed?: boolean;
}) {
  const isQuantifiable = goal.goalType === "quantifiable";
  const targetVal = parseFloat(goal.targetValue || "0");
  const currentVal = parseFloat(goal.currentValue || "0");
  const progress = targetVal > 0 ? Math.min(currentVal / targetVal, 1) : 0;
  const milestones = goal.milestones ?? [];
  const completedMilestones = milestones.filter((m: any) => m.completed).length;
  const milestoneProgress =
    milestones.length > 0 ? completedMilestones / milestones.length : 0;

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">{goal.icon || "🎯"}</span>
          <h3 className="font-semibold">{goal.name}</h3>
        </div>

        {!completed && (
          <div className="relative">
            <button
              onClick={() =>
                setMenuOpen(menuOpen === goal.id ? null : goal.id)
              }
              className="p-1 rounded hover:bg-muted"
            >
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </button>
            {menuOpen === goal.id && (
              <div className="absolute right-0 top-8 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[140px]">
                <button
                  onClick={() => {
                    setMenuOpen(null);
                    onEdit();
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                >
                  <Pencil className="h-3 w-3" /> Edit
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(null);
                    onComplete();
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                >
                  <Check className="h-3 w-3" /> Mark Complete
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(null);
                    onDelete();
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted text-destructive flex items-center gap-2"
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Progress bar */}
      {isQuantifiable && (
        <div className="mt-2">
          <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-muted-foreground">
              {currentVal} / {targetVal} {goal.targetUnit || ""}
            </span>
            <span className="text-primary font-medium">
              {Math.round(progress * 100)}%
            </span>
          </div>
          {!completed && (
            <Button
              variant="outline"
              size="sm"
              onClick={onLog}
              className="mt-2 border-primary/40 text-primary"
            >
              + Log Progress
            </Button>
          )}
        </div>
      )}

      {/* Milestones */}
      {!isQuantifiable && milestones.length > 0 && (
        <div className="mt-2">
          <div className="w-full h-3 bg-muted rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${milestoneProgress * 100}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground mb-2">
            {completedMilestones}/{milestones.length} milestones
          </p>
          <div className="flex flex-wrap gap-2">
            {milestones.map((m: any) => (
              <button
                key={m.id}
                onClick={() => !m.completed && !completed && onCompleteMilestone(m.id)}
                disabled={m.completed || completed}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors ${
                  m.completed
                    ? "bg-primary/10 text-primary"
                    : "bg-muted hover:bg-primary/5 text-muted-foreground"
                }`}
              >
                {m.completed ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
                {m.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Footer info */}
      {goal.targetDate && (
        <p className="text-xs text-muted-foreground mt-3">
          Due: {goal.targetDate}
        </p>
      )}
    </div>
  );
}
