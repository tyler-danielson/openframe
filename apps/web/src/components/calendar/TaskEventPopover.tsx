import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Check, ExternalLink, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { api } from "../../services/api";
import { Button } from "../ui/Button";
import type { CalendarEvent } from "@openframe/shared";
import { useNavigate } from "react-router-dom";

interface TaskEventPopoverProps {
  event: CalendarEvent;
  onClose: () => void;
}

export function TaskEventPopover({ event, onClose }: TaskEventPopoverProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const meta = event.metadata as {
    taskId: string;
    taskListId: string;
    taskListName?: string;
    dueDate: string | null;
    hasExplicitDueDate: boolean;
    isOverdue: boolean;
    notes: string | null;
  };

  const completeTask = useMutation({
    mutationFn: () => api.completeTask(meta.taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-calendar-events"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-lg shadow-xl p-5 max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <span className="text-xl">✅</span>
            {event.title}
          </h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-accent">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-2 mb-4 text-sm text-muted-foreground">
          {meta.hasExplicitDueDate && meta.dueDate && (
            <p className={meta.isOverdue ? "text-destructive font-medium" : ""}>
              {meta.isOverdue && <AlertCircle className="h-3.5 w-3.5 inline mr-1" />}
              Due: {format(new Date(meta.dueDate), "EEEE, MMMM d, yyyy")}
              {meta.isOverdue && " (overdue)"}
            </p>
          )}
          {!meta.hasExplicitDueDate && (
            <p>No due date</p>
          )}
          {meta.taskListName && (
            <p>List: {meta.taskListName}</p>
          )}
          {meta.notes && (
            <p className="text-foreground/80">{meta.notes}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => completeTask.mutate()}
            disabled={completeTask.isPending}
            className="flex-1"
          >
            <Check className="h-4 w-4 mr-1" />
            Complete Task
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onClose();
              navigate("/productivity");
            }}
            className="gap-1"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View
          </Button>
        </div>
      </div>
    </div>
  );
}
