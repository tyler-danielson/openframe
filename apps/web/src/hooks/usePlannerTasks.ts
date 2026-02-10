import { useQuery } from "@tanstack/react-query";
import { isToday, isTomorrow, isPast, startOfDay, format } from "date-fns";
import { api } from "../services/api";
import type { Task } from "@openframe/shared";

/**
 * Hook to fetch tasks for the planner widgets.
 * Returns incomplete tasks from the specified task lists, sorted by due date.
 */
export function usePlannerTasks(taskListIds: string[]) {
  return useQuery({
    queryKey: ["planner-tasks", taskListIds],
    queryFn: async () => {
      // Fetch tasks from all selected lists in parallel
      const taskPromises = taskListIds.map((listId) =>
        api.getTasks({ listId, status: "needsAction" })
      );
      const results = await Promise.all(taskPromises);

      // Flatten and sort tasks
      const allTasks = results.flat();
      return sortTasks(allTasks);
    },
    enabled: taskListIds.length > 0,
    staleTime: 60 * 1000, // Consider fresh for 1 minute
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}

/**
 * Sort tasks by due date (nulls last), then alphabetically by title
 */
function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    // Tasks with due dates come first
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;

    // Both have due dates - sort by date
    if (a.dueDate && b.dueDate) {
      const dateA = new Date(a.dueDate).getTime();
      const dateB = new Date(b.dueDate).getTime();
      if (dateA !== dateB) return dateA - dateB;
    }

    // Same date or both null - sort alphabetically
    return a.title.localeCompare(b.title);
  });
}

/**
 * Format task due date for display
 * Returns "Overdue", "Today", "Tomorrow", or formatted date
 */
export function formatTaskDueDate(dueDate: Date | string | null): string | null {
  if (!dueDate) return null;

  const date = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  const dateOnly = startOfDay(date);
  const today = startOfDay(new Date());

  if (isToday(dateOnly)) {
    return "Today";
  }

  if (isTomorrow(dateOnly)) {
    return "Tomorrow";
  }

  if (isPast(dateOnly) && dateOnly < today) {
    return "Overdue";
  }

  // Format as "Mon 12" or "Feb 12" depending on how far away
  const daysAway = Math.floor((dateOnly.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (daysAway <= 7) {
    return format(date, "EEE"); // "Mon", "Tue", etc.
  }

  return format(date, "MMM d"); // "Feb 12"
}

/**
 * Get CSS class for due date badge based on urgency
 */
export function getDueDateClass(dueDate: Date | string | null): string {
  if (!dueDate) return "";

  const date = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  const dateOnly = startOfDay(date);
  const today = startOfDay(new Date());

  if (isPast(dateOnly) && dateOnly < today) {
    return "text-destructive"; // Overdue
  }

  if (isToday(dateOnly)) {
    return "text-primary font-medium"; // Today
  }

  if (isTomorrow(dateOnly)) {
    return "text-primary/80"; // Tomorrow
  }

  return "text-muted-foreground"; // Future
}
