import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { SectionTitle, type EditableWidgetProps } from "./types";
import { usePlannerTasks, formatTaskDueDate, getDueDateClass } from "../../../hooks/usePlannerTasks";
import { api } from "../../../services/api";

interface TaskItem {
  id: string;
  text: string;
  completed: boolean;
}

export function EditableTasks({ widget, isSelected, onSelect, onConfigChange, colors }: EditableWidgetProps) {
  const queryClient = useQueryClient();
  const config = widget.config;
  const title = (config.title as string) || "Tasks";
  const maxItems = (config.maxItems as number) || 5;
  const showCheckboxes = config.showCheckboxes !== false;
  const showDueDate = config.showDueDate !== false;
  const taskListIds = (config.taskListIds as string[]) || [];
  const isPriority = title.toLowerCase().includes("priority") || title.toLowerCase().includes("focus");

  // Connected mode: fetch real tasks if taskListIds are configured
  const isConnectedMode = taskListIds.length > 0;
  const { data: tasks, isLoading, error } = usePlannerTasks(taskListIds);

  // Track completing tasks for optimistic UI
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());

  // Manual mode: use local taskItems
  const taskItems = (config.taskItems as TaskItem[]) || Array.from({ length: maxItems }, (_, i) => ({
    id: `task-${i}`,
    text: "",
    completed: false,
  }));

  // Ensure we have the right number of items for manual mode
  const items = taskItems.length >= maxItems
    ? taskItems.slice(0, maxItems)
    : [...taskItems, ...Array.from({ length: maxItems - taskItems.length }, (_, i) => ({
        id: `task-${taskItems.length + i}`,
        text: "",
        completed: false,
      }))];

  const handleTaskChange = (index: number, updates: Partial<TaskItem>) => {
    const newItems = items.map((item, i) =>
      i === index ? { ...item, ...updates } : item
    );
    onConfigChange({ ...config, taskItems: newItems });
  };

  const handleCompleteTask = async (taskId: string) => {
    setCompletingIds((prev) => new Set(prev).add(taskId));
    try {
      await api.completeTask(taskId);
      // Refetch tasks
      queryClient.invalidateQueries({ queryKey: ["planner-tasks", taskListIds] });
    } catch (err) {
      console.error("Failed to complete task:", err);
    } finally {
      setCompletingIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  // Connected mode rendering
  if (isConnectedMode) {
    const displayTasks = (tasks || [])
      .filter((t) => !completingIds.has(t.id))
      .slice(0, maxItems);

    return (
      <div
        style={{
          padding: "12px 14px",
          height: "100%",
          fontFamily: "'DM Sans', sans-serif",
          color: colors.ink,
        }}
        onClick={onSelect}
      >
        <SectionTitle colors={colors}>{title}</SectionTitle>

        {isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "20px 0" }}>
            <Loader2
              style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }}
              color={colors.inkFaint}
            />
          </div>
        ) : error ? (
          <div style={{ fontSize: 11, color: colors.inkFaint, padding: "8px 0" }}>
            Failed to load tasks
          </div>
        ) : displayTasks.length === 0 ? (
          <div style={{ fontSize: 11, color: colors.inkFaint, padding: "8px 0" }}>
            No tasks
          </div>
        ) : (
          displayTasks.map((task, i) => {
            const dueDateText = showDueDate ? formatTaskDueDate(task.dueDate) : null;
            const dueDateColorClass = getDueDateClass(task.dueDate);
            const isOverdue = dueDateText === "Overdue";

            return (
              <div
                key={task.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: isPriority ? "6px 0" : "5px 0",
                  borderBottom: `1px solid ${colors.ruleLineLight}`,
                }}
              >
                {isPriority ? (
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 12,
                      color: colors.inkFaint,
                      width: 18,
                      textAlign: "center",
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </span>
                ) : showCheckboxes ? (
                  <input
                    type="checkbox"
                    checked={false}
                    onChange={() => handleCompleteTask(task.id)}
                    style={{
                      width: 16,
                      height: 16,
                      flexShrink: 0,
                      accentColor: colors.checkGreen,
                      cursor: "pointer",
                    }}
                  />
                ) : null}
                <span
                  style={{
                    flex: 1,
                    fontSize: 12,
                    fontFamily: "'DM Sans', sans-serif",
                    color: colors.ink,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {task.title}
                </span>
                {dueDateText && (
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: "'JetBrains Mono', monospace",
                      color: isOverdue ? "#dc2626" : colors.inkFaint,
                      fontWeight: isOverdue ? 500 : 400,
                      flexShrink: 0,
                    }}
                  >
                    {dueDateText}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    );
  }

  // Manual mode rendering (existing behavior)
  return (
    <div
      style={{
        padding: "12px 14px",
        height: "100%",
        fontFamily: "'DM Sans', sans-serif",
        color: colors.ink,
      }}
      onClick={onSelect}
    >
      <SectionTitle colors={colors}>{title}</SectionTitle>
      {items.map((item, i) => (
        <div
          key={item.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: isPriority ? "6px 0" : "5px 0",
            borderBottom: `1px solid ${colors.ruleLineLight}`,
          }}
        >
          {isPriority ? (
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                color: colors.inkFaint,
                width: 18,
                textAlign: "center",
                flexShrink: 0,
              }}
            >
              {i + 1}
            </span>
          ) : showCheckboxes ? (
            <input
              type="checkbox"
              checked={item.completed}
              onChange={(e) => handleTaskChange(i, { completed: e.target.checked })}
              style={{
                width: 16,
                height: 16,
                flexShrink: 0,
                accentColor: colors.checkGreen,
                cursor: "pointer",
              }}
            />
          ) : null}
          <input
            type="text"
            value={item.text}
            onChange={(e) => handleTaskChange(i, { text: e.target.value })}
            placeholder=""
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: 12,
              fontFamily: "'DM Sans', sans-serif",
              color: item.completed ? colors.inkFaint : colors.ink,
              textDecoration: item.completed ? "line-through" : "none",
            }}
          />
        </div>
      ))}
    </div>
  );
}
