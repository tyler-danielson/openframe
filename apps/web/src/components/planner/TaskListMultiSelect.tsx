import { useQuery } from "@tanstack/react-query";
import { Loader2, ListTodo } from "lucide-react";
import { api } from "../../services/api";

interface TaskListMultiSelectProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function TaskListMultiSelect({ selectedIds, onChange }: TaskListMultiSelectProps) {
  const { data: taskLists, isLoading, error } = useQuery({
    queryKey: ["task-lists"],
    queryFn: () => api.getTaskLists(),
  });

  const handleToggle = (listId: string) => {
    if (selectedIds.includes(listId)) {
      onChange(selectedIds.filter((id) => id !== listId));
    } else {
      onChange([...selectedIds, listId]);
    }
  };

  const handleSelectAll = () => {
    if (!taskLists) return;
    const allIds = taskLists.filter((l) => l.isVisible).map((l) => l.id);
    onChange(allIds);
  };

  const handleSelectNone = () => {
    onChange([]);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-destructive py-2">
        Failed to load task lists
      </div>
    );
  }

  // Only show task lists that are visible (synced)
  const visibleLists = taskLists?.filter((l) => l.isVisible) || [];

  if (visibleLists.length === 0) {
    return (
      <div className="text-xs text-muted-foreground py-2 flex items-center gap-2">
        <ListTodo className="h-3 w-3" />
        No synced task lists found
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Quick actions */}
      <div className="flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={handleSelectAll}
          className="text-primary hover:underline"
        >
          Select all
        </button>
        <span className="text-muted-foreground">|</span>
        <button
          type="button"
          onClick={handleSelectNone}
          className="text-primary hover:underline"
        >
          Clear
        </button>
      </div>

      {/* Task list options */}
      <div className="border border-border rounded-md max-h-48 overflow-auto">
        {visibleLists.map((list) => (
          <label
            key={list.id}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted/50 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(list.id)}
              onChange={() => handleToggle(list.id)}
              className="rounded border-border"
            />
            <ListTodo className="h-3 w-3 text-primary flex-shrink-0" />
            <span className="text-sm truncate flex-1">{list.name}</span>
          </label>
        ))}
      </div>

      {selectedIds.length > 0 && (
        <div className="text-xs text-muted-foreground">
          {selectedIds.length} list{selectedIds.length !== 1 ? "s" : ""} selected
        </div>
      )}
    </div>
  );
}
