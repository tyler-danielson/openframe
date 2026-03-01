import { useQuery } from "@tanstack/react-query";
import { ListTodo, CheckCircle2, Circle } from "lucide-react";
import { startOfDay, endOfDay, format } from "date-fns";
import { api } from "../../services/api";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { useCardBlockNav } from "./useCardBlockNav";
import { cn } from "../../lib/utils";
import type { CardViewCardProps } from "./types";

export function TasksCard({ onClick, blockNavId }: CardViewCardProps) {
  const { blockNavClasses } = useCardBlockNav(blockNavId);
  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", "cardview"],
    queryFn: async () => {
      const allTasks = await api.getTasks({ status: "needsAction" });
      return allTasks.sort((a, b) => {
        const aIsToday = a.dueDate && new Date(a.dueDate) >= todayStart && new Date(a.dueDate) <= todayEnd;
        const bIsToday = b.dueDate && new Date(b.dueDate) >= todayStart && new Date(b.dueDate) <= todayEnd;
        if (aIsToday && !bIsToday) return -1;
        if (!aIsToday && bIsToday) return 1;
        return 0;
      });
    },
    refetchInterval: 60000,
  });

  const displayTasks = tasks.slice(0, 5);

  return (
    <Card
      className={cn(
        "cursor-pointer hover:bg-accent/50 transition-all duration-300 flex flex-col",
        blockNavClasses
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <ListTodo className="h-5 w-5 text-primary" />
          Tasks
          {tasks.length > 0 && (
            <span className="ml-auto text-sm font-normal text-muted-foreground">
              {tasks.length} pending
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-4 w-4 bg-muted rounded-full" />
                <div className="h-4 flex-1 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mb-2 opacity-50" />
            <p className="text-sm">All caught up!</p>
          </div>
        ) : (
          <div className="space-y-1">
            {displayTasks.map((task) => (
              <div key={task.id} className="flex items-center gap-3 py-1.5">
                <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <p className="text-sm truncate flex-1">{task.title}</p>
                {task.dueDate && (
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {format(new Date(task.dueDate), "MMM d")}
                  </span>
                )}
              </div>
            ))}
            {tasks.length > 5 && (
              <p className="text-xs text-muted-foreground mt-2">
                +{tasks.length - 5} more
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
