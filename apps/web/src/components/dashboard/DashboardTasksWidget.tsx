import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { startOfDay, endOfDay, format } from "date-fns";
import { CheckCircle2, Circle, Loader2, WifiOff } from "lucide-react";
import { api } from "../../services/api";
import type { Task } from "@openframe/shared";
import { useDataFreshness } from "../../hooks/useDataFreshness";
import { STALE_THRESHOLDS } from "../../lib/stale-thresholds";

interface DashboardTasksWidgetProps {
  className?: string;
  filter?: "today" | "other";
}

export function DashboardTasksWidget({ className, filter = "today" }: DashboardTasksWidgetProps) {
  const queryClient = useQueryClient();
  const today = new Date();

  // Fetch all incomplete tasks
  const { data: tasks = [], isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: ["tasks", "dashboard", filter],
    queryFn: async () => {
      const allTasks = await api.getTasks({ status: "needsAction" });
      const startOfToday = startOfDay(today);
      const endOfToday = endOfDay(today);

      if (filter === "today") {
        return allTasks.filter((task) => {
          if (!task.dueDate) return false;
          const dueDate = new Date(task.dueDate);
          return dueDate >= startOfToday && dueDate <= endOfToday;
        });
      } else {
        return allTasks.filter((task) => {
          if (!task.dueDate) return true;
          const dueDate = new Date(task.dueDate);
          return dueDate < startOfToday || dueDate > endOfToday;
        });
      }
    },
    refetchInterval: 60000, // Refresh every minute
  });
  const { isStale, ageLabel } = useDataFreshness(dataUpdatedAt, STALE_THRESHOLDS.dashboardTasks);

  const completeTask = useMutation({
    mutationFn: (taskId: string) => api.completeTask(taskId),
    onMutate: async (taskId) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ["tasks", "dashboard", filter] });
      const previousTasks = queryClient.getQueryData<Task[]>(["tasks", "dashboard", filter]);

      queryClient.setQueryData<Task[]>(["tasks", "dashboard", filter], (old) =>
        old?.filter((task) => task.id !== taskId)
      );

      return { previousTasks };
    },
    onError: (_err, _taskId, context) => {
      // Rollback on error
      if (context?.previousTasks) {
        queryClient.setQueryData(["tasks", "dashboard", filter], context.previousTasks);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center py-8 ${className ?? ""}`}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-center text-muted-foreground py-4 ${className ?? ""}`}>
        Unable to load tasks
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-8 text-muted-foreground ${className ?? ""}`}>
        <CheckCircle2 className="h-12 w-12 mb-2 opacity-50" />
        <p className="text-sm">{filter === "today" ? "No tasks due today" : "No other tasks"}</p>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      {isStale && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-1">
          <WifiOff className="h-3 w-3" />
          <span>Disconnected &middot; Last updated {ageLabel}</span>
        </div>
      )}
      {tasks.map((task) => (
        <div
          key={task.id}
          className="flex items-start gap-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
        >
          <button
            type="button"
            onClick={() => completeTask.mutate(task.id)}
            disabled={completeTask.isPending}
            className="mt-0.5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
            aria-label={`Mark "${task.title}" as complete`}
          >
            {completeTask.isPending && completeTask.variables === task.id ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Circle className="h-5 w-5" />
            )}
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{task.title}</p>
            {task.dueDate && (
              <p className="text-xs text-muted-foreground">
                Due {format(new Date(task.dueDate), "h:mm a")}
              </p>
            )}
            {task.notes && (
              <p className="text-sm text-muted-foreground truncate mt-1">
                {task.notes}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
