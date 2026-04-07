import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Check, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { api } from "../../services/api";
import { Button } from "../ui/Button";
import type { CalendarEvent } from "@openframe/shared";
import { useNavigate } from "react-router-dom";

interface RoutineEventPopoverProps {
  event: CalendarEvent;
  onClose: () => void;
}

export function RoutineEventPopover({ event, onClose }: RoutineEventPopoverProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const meta = event.metadata as {
    routineId: string;
    isCompleted: boolean;
    assignedProfileId: string | null;
    icon: string | null;
    category: string | null;
    frequency: string;
    daysOfWeek: number[] | null;
  };

  const dateStr = format(new Date(event.startTime), "yyyy-MM-dd");

  const toggleCompletion = useMutation({
    mutationFn: () =>
      api.toggleRoutineCompletion(meta.routineId, {
        date: dateStr,
        profileId: meta.assignedProfileId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routine-calendar-events"] });
      queryClient.invalidateQueries({ queryKey: ["routines"] });
      onClose();
    },
  });

  const frequencyLabel = () => {
    if (meta.frequency === "daily") return "Every day";
    if (meta.daysOfWeek && meta.daysOfWeek.length > 0) {
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      return `Every ${meta.daysOfWeek.map((d) => dayNames[d]).join(", ")}`;
    }
    return meta.frequency === "weekly" ? "Weekly" : "Custom";
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-lg shadow-xl p-5 max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <span className="text-xl">{meta.icon || "🔄"}</span>
            {event.title.replace(meta.icon ? `${meta.icon} ` : "", "")}
          </h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-accent">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-2 mb-4 text-sm text-muted-foreground">
          <p>{frequencyLabel()}</p>
          <p>{format(new Date(event.startTime), "EEEE, MMMM d, yyyy")}</p>
        </div>

        <div className="mb-4">
          {meta.isCompleted ? (
            <div className="flex items-center gap-2 text-sm text-primary">
              <Check className="h-4 w-4" />
              <span>Completed</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-4 w-4 rounded border border-muted-foreground/40" />
              <span>Not completed</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => toggleCompletion.mutate()}
            disabled={toggleCompletion.isPending}
            variant={meta.isCompleted ? "outline" : "default"}
            className="flex-1"
          >
            {meta.isCompleted ? "Undo" : "Mark Complete"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onClose();
              navigate("/routines");
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
