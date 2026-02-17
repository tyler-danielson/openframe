import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Plus, Send, RotateCcw } from "lucide-react";
import { api } from "../../services/api";
import { useCompanion } from "./CompanionContext";

export function CompanionTasksPage() {
  const queryClient = useQueryClient();
  const companion = useCompanion();
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const { data: taskLists } = useQuery({
    queryKey: ["companion-task-lists"],
    queryFn: () => api.getCompanionTaskLists(),
    staleTime: 300_000,
  });

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["companion-tasks", selectedListId, showCompleted ? "completed" : "needsAction"],
    queryFn: () =>
      api.getCompanionTasks({
        listId: selectedListId || undefined,
        status: showCompleted ? "completed" : "needsAction",
      }),
    staleTime: 30_000,
  });

  const completeMutation = useMutation({
    mutationFn: (taskId: string) => api.updateCompanionTask(taskId, { status: "completed" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companion-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["companion-active-tasks"] });
    },
  });

  const uncompleteMutation = useMutation({
    mutationFn: (taskId: string) => api.updateCompanionTask(taskId, { status: "needsAction" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companion-tasks"] });
    },
  });

  const createMutation = useMutation({
    mutationFn: (title: string) => {
      const listId = selectedListId || (taskLists && taskLists.length > 0 ? (taskLists[0] as any).id : "");
      return api.createCompanionTask({ taskListId: listId, title });
    },
    onSuccess: () => {
      setNewTaskTitle("");
      queryClient.invalidateQueries({ queryKey: ["companion-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["companion-active-tasks"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (taskId: string) => api.deleteCompanionTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companion-tasks"] });
    },
  });

  const handleSubmitTask = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTaskTitle.trim();
    if (!title) return;
    createMutation.mutate(title);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold text-foreground">Tasks</h1>
      </div>

      {/* List filter pills */}
      <div className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setSelectedListId(null)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            selectedListId === null
              ? "bg-primary text-primary-foreground"
              : "bg-card border border-border text-foreground hover:bg-primary/5"
          }`}
        >
          All
        </button>
        {(taskLists || []).map((list: any) => (
          <button
            key={list.id}
            onClick={() => setSelectedListId(list.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selectedListId === list.id
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-foreground hover:bg-primary/5"
            }`}
          >
            {list.title}
          </button>
        ))}
      </div>

      {/* Active/Completed toggle */}
      <div className="px-4 pb-3 flex gap-2">
        <button
          onClick={() => setShowCompleted(false)}
          className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
            !showCompleted ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
          }`}
        >
          Active
        </button>
        <button
          onClick={() => setShowCompleted(true)}
          className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
            showCompleted ? "text-primary border-b-2 border-primary" : "text-muted-foreground"
          }`}
        >
          Completed
        </button>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto px-4 space-y-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !tasks || tasks.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">
              {showCompleted ? "No completed tasks" : "No active tasks"}
            </p>
          </div>
        ) : (
          (tasks as any[]).map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0"
            >
              <button
                onClick={() => {
                  if (!companion.canEditTasks) return;
                  if (showCompleted) {
                    uncompleteMutation.mutate(task.id);
                  } else {
                    completeMutation.mutate(task.id);
                  }
                }}
                disabled={!companion.canEditTasks}
                className={`shrink-0 h-6 w-6 rounded-md border-2 flex items-center justify-center transition-colors min-h-[44px] min-w-[44px] ${
                  showCompleted
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-primary/40 hover:border-primary hover:bg-primary/5"
                }`}
              >
                {showCompleted && <Check className="h-3.5 w-3.5" />}
              </button>
              <div className="flex-1 min-w-0">
                <div
                  className={`text-sm ${
                    showCompleted ? "line-through text-muted-foreground" : "text-foreground"
                  }`}
                >
                  {task.title}
                </div>
                {task.dueDate && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Due {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Quick-add bar */}
      {!showCompleted && companion.canEditTasks && (
        <form
          onSubmit={handleSubmitTask}
          className="shrink-0 px-4 py-3 border-t border-border bg-card flex gap-2"
        >
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="Add a task..."
            className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          <button
            type="submit"
            disabled={!newTaskTitle.trim() || createMutation.isPending}
            className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50 transition-colors"
          >
            {createMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </form>
      )}
    </div>
  );
}
