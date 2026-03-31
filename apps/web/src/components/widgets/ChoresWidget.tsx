import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ClipboardList } from "lucide-react";
import { api } from "../../services/api";
import type { WidgetStyle, FontSizePreset } from "../../stores/screensaver";
import { getFontSizeConfig } from "../../lib/font-size";
import { cn } from "../../lib/utils";

interface ChoresWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
  widgetId?: string;
}

interface ChoreAssignment {
  profileId: string;
  profileName: string;
  profileColor: string;
  completed: boolean;
  completedAt?: string;
}

interface ChoreWithAssignments {
  id: string;
  name: string;
  dueDate?: string;
  status: "pending" | "completed" | "overdue";
  assignments: ChoreAssignment[];
}

const FONT_SIZE_CLASSES: Record<Exclude<FontSizePreset, "custom">, { title: string; meta: string; label: string }> = {
  xs: { title: "text-[10px]", meta: "text-[8px]", label: "text-[9px]" },
  sm: { title: "text-xs", meta: "text-[9px]", label: "text-[10px]" },
  md: { title: "text-sm", meta: "text-[10px]", label: "text-xs" },
  lg: { title: "text-base", meta: "text-xs", label: "text-sm" },
  xl: { title: "text-lg", meta: "text-sm", label: "text-base" },
};

const CUSTOM_SCALE = {
  title: 1,
  meta: 0.7,
  label: 0.85,
};

function getDueLabel(dueDate?: string): { text: string; isOverdue: boolean } {
  if (!dueDate) return { text: "", isOverdue: false };
  const due = new Date(dueDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { text: "Overdue", isOverdue: true };
  if (diffDays === 0) return { text: "Today", isOverdue: false };
  if (diffDays === 1) return { text: "Tomorrow", isOverdue: false };
  return { text: `In ${diffDays}d`, isOverdue: false };
}

export function ChoresWidget({ config, style, isBuilder }: ChoresWidgetProps) {
  const maxItems = (config.maxItems as number) ?? 6;
  const showCompleted = (config.showCompleted as boolean) ?? false;
  const showDueDate = (config.showDueDate as boolean) ?? true;
  const showAssignee = (config.showAssignee as boolean) ?? true;
  const groupBy = (config.groupBy as string) ?? "none";

  const { preset, isCustom, customValue } = getFontSizeConfig(style);
  const sizeClasses = isCustom ? null : FONT_SIZE_CLASSES[preset as Exclude<FontSizePreset, "custom">];

  const getCustomFontSize = (scale: number) => {
    if (!customValue) return undefined;
    const value = parseFloat(customValue);
    const unit = customValue.replace(/[\d.]/g, "") || "px";
    return `${value * scale}${unit}`;
  };

  const { data, isLoading } = useQuery({
    queryKey: ["chores"],
    queryFn: () => api.getChores() as Promise<{ chores: ChoreWithAssignments[] }>,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    enabled: !isBuilder,
  });

  const chores = data?.chores ?? [];

  const filteredChores = useMemo(() => {
    let result = chores;
    if (!showCompleted) {
      result = result.filter((c) => c.status !== "completed");
    }
    return result.slice(0, maxItems);
  }, [chores, showCompleted, maxItems]);

  // Group chores if needed
  const groupedChores = useMemo(() => {
    if (groupBy === "none") return null;

    const groups: Record<string, ChoreWithAssignments[]> = {};
    for (const chore of filteredChores) {
      let key: string;
      if (groupBy === "assignee") {
        key = chore.assignments[0]?.profileName || "Unassigned";
      } else {
        key = chore.status === "completed" ? "Completed" : chore.status === "overdue" ? "Overdue" : "Pending";
      }
      if (!groups[key]) groups[key] = [];
      groups[key]!.push(chore);
    }
    return groups;
  }, [filteredChores, groupBy]);

  // Mock data for builder preview
  const mockChores: ChoreWithAssignments[] = [
    { id: "1", name: "Take out trash", dueDate: new Date().toISOString(), status: "pending", assignments: [{ profileId: "1", profileName: "Alex", profileColor: "#3B82F6", completed: false }] },
    { id: "2", name: "Load dishwasher", dueDate: new Date().toISOString(), status: "pending", assignments: [{ profileId: "2", profileName: "Sam", profileColor: "#10B981", completed: false }] },
    { id: "3", name: "Vacuum living room", dueDate: new Date(Date.now() - 86400000).toISOString(), status: "overdue", assignments: [{ profileId: "1", profileName: "Alex", profileColor: "#3B82F6", completed: false }] },
    { id: "4", name: "Feed the dog", dueDate: new Date().toISOString(), status: "completed", assignments: [{ profileId: "3", profileName: "Mom", profileColor: "#F59E0B", completed: true }] },
  ];

  const displayChores = isBuilder
    ? mockChores.filter(c => showCompleted || c.status !== "completed").slice(0, maxItems)
    : filteredChores;

  if (!isBuilder && isLoading) {
    return (
      <div
        className="flex h-full items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <span className="text-sm opacity-50">Loading chores...</span>
      </div>
    );
  }

  if (!isBuilder && displayChores.length === 0) {
    return (
      <div
        className="flex h-full flex-col items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <ClipboardList className="h-8 w-8 opacity-30 mb-2" />
        <span className="text-sm opacity-50">No chores right now</span>
      </div>
    );
  }

  const renderChoreRow = (chore: ChoreWithAssignments) => {
    const { text: dueText, isOverdue } = getDueLabel(chore.dueDate);
    const assignee = chore.assignments[0];
    const isCompleted = chore.status === "completed";

    return (
      <div key={chore.id} className="flex items-center gap-2 min-h-[28px]">
        {/* Assignee avatar */}
        {showAssignee && assignee && (
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-white flex-shrink-0"
            style={{ backgroundColor: assignee.profileColor, fontSize: "10px", fontWeight: 600 }}
          >
            {assignee.profileName.charAt(0).toUpperCase()}
          </div>
        )}

        {/* Chore name */}
        <span
          className={cn(
            sizeClasses?.title,
            "truncate flex-1",
            isCompleted && "line-through opacity-50"
          )}
          style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.title) } : undefined}
        >
          {chore.name}
        </span>

        {/* Due date */}
        {showDueDate && dueText && (
          <span
            className={cn(
              sizeClasses?.meta,
              "flex-shrink-0",
              isOverdue ? "text-red-400" : "opacity-60"
            )}
            style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.meta) } : undefined}
          >
            {dueText}
          </span>
        )}

        {/* Status indicator */}
        <div className={cn(
          "w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0",
          isCompleted ? "border-green-500 bg-green-500/20" : "border-white/30"
        )}>
          {isCompleted && <Check className="w-3 h-3 text-green-400" />}
        </div>
      </div>
    );
  };

  return (
    <div
      className={cn(
        "relative flex h-full flex-col p-4 rounded-lg overflow-hidden",
        "bg-black/40 backdrop-blur-sm"
      )}
      style={{ color: style?.textColor || "#ffffff" }}
    >
      {groupedChores ? (
        <div className="flex-1 space-y-3 overflow-hidden">
          {Object.entries(groupedChores).map(([group, items]) => (
            <div key={group}>
              <div
                className={cn(sizeClasses?.label, "opacity-50 uppercase tracking-wide mb-1.5")}
                style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.label) } : undefined}
              >
                {group}
              </div>
              <div className="space-y-1.5">
                {items.map(renderChoreRow)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 space-y-1.5 overflow-hidden">
          {displayChores.map(renderChoreRow)}
        </div>
      )}
    </div>
  );
}
