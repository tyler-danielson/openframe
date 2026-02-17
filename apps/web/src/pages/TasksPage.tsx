import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Plus,
  RefreshCw,
  Check,
  Circle,
  Calendar,
  Trash2,
  ChevronDown,
  ChevronRight,
  ListTodo,
  LayoutGrid,
  Columns3,
  List,
  Kanban,
  PenTool,
  X,
} from "lucide-react";
import { api } from "../services/api";
import { Button } from "../components/ui/Button";
import { HandwritingCanvas } from "../components/ui/HandwritingCanvas";
import { cn } from "../lib/utils";
import { useTasksStore, type TasksLayout } from "../stores/tasks";
import { useAuthStore } from "../stores/auth";
import { buildOAuthUrl } from "../utils/oauth-scopes";
import type { Task, TaskList } from "@openframe/shared";

export function TasksPage() {
  const queryClient = useQueryClient();
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [expandedLists, setExpandedLists] = useState<Set<string>>(new Set());
  const [activeAddList, setActiveAddList] = useState<string | null>(null);
  const [showHandwriting, setShowHandwriting] = useState(false);
  const [handwritingStatus, setHandwritingStatus] = useState<"drawing" | "creating" | "success" | "error">("drawing");
  const [handwritingError, setHandwritingError] = useState<string | null>(null);
  const [insufficientScope, setInsufficientScope] = useState(false);

  const { layout, setLayout, showCompleted, setShowCompleted, expandAllLists } = useTasksStore();

  // Fetch task lists
  const { data: taskLists = [], isLoading: loadingLists } = useQuery({
    queryKey: ["task-lists"],
    queryFn: () => api.getTaskLists(),
  });

  // Fetch tasks
  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ["tasks", selectedListId],
    queryFn: () => api.getTasks({ listId: selectedListId || undefined }),
    enabled: taskLists.length > 0,
  });

  // Auto-expand all lists when expandAllLists is enabled
  useEffect(() => {
    if (expandAllLists && taskLists.length > 0) {
      setExpandedLists(new Set(taskLists.map((l) => l.id)));
    }
  }, [expandAllLists, taskLists]);

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: () => api.syncTasks(),
    onSuccess: () => {
      setInsufficientScope(false);
      queryClient.invalidateQueries({ queryKey: ["task-lists"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (error: Error) => {
      if (error.message === "insufficient_scope") {
        setInsufficientScope(true);
      }
    },
  });

  // Complete task mutation
  const completeMutation = useMutation({
    mutationFn: (taskId: string) => api.completeTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  // Update task mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { status: "needsAction" | "completed" } }) =>
      api.updateTask(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  // Create task mutation
  const createMutation = useMutation({
    mutationFn: (data: { taskListId: string; title: string }) => api.createTask(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setNewTaskTitle("");
      setActiveAddList(null);
    },
  });

  // Delete task mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  // Get default task list (first one)
  const defaultTaskList = taskLists[0];

  // Handle handwriting recognition for tasks
  const handleHandwritingRecognized = (text: string) => {
    if (!defaultTaskList) {
      setHandwritingError("No task list available");
      setHandwritingStatus("error");
      return;
    }

    setHandwritingStatus("creating");

    // Clean up the recognized text
    const taskTitle = text.trim().replace(/\s+/g, " ");
    if (!taskTitle) {
      setHandwritingError("Could not recognize text");
      setHandwritingStatus("error");
      return;
    }

    // Capitalize first letter
    const formattedTitle = taskTitle.charAt(0).toUpperCase() + taskTitle.slice(1);

    // Create the task
    createMutation.mutate(
      { taskListId: defaultTaskList.id, title: formattedTitle },
      {
        onSuccess: () => {
          setHandwritingStatus("success");
          setTimeout(() => {
            setShowHandwriting(false);
            setHandwritingStatus("drawing");
          }, 1500);
        },
        onError: (error: Error) => {
          setHandwritingError(error.message || "Failed to create task");
          setHandwritingStatus("error");
        },
      }
    );
  };

  // Close handwriting overlay
  const handleCloseHandwriting = () => {
    setShowHandwriting(false);
    setHandwritingStatus("drawing");
    setHandwritingError(null);
  };

  // Retry handwriting
  const handleRetryHandwriting = () => {
    setHandwritingStatus("drawing");
    setHandwritingError(null);
  };

  const toggleListExpanded = (listId: string) => {
    setExpandedLists((prev) => {
      const next = new Set(prev);
      if (next.has(listId)) {
        next.delete(listId);
      } else {
        next.add(listId);
      }
      return next;
    });
  };

  const handleToggleTask = (task: Task) => {
    const newStatus = task.status === "completed" ? "needsAction" : "completed";
    updateMutation.mutate({ id: task.id, data: { status: newStatus } });
  };

  const handleAddTask = (listId: string) => {
    if (!newTaskTitle.trim()) return;
    createMutation.mutate({ taskListId: listId, title: newTaskTitle.trim() });
  };

  // Group tasks by list
  const tasksByList = tasks.reduce((acc, task) => {
    const listId = task.taskListId;
    if (!acc[listId]) acc[listId] = [];
    acc[listId].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

  // Filter tasks based on showCompleted
  const filterTasks = (taskList: Task[]) => {
    if (showCompleted) return taskList;
    return taskList.filter((t) => t.status !== "completed");
  };

  // Get all tasks filtered
  const allFilteredTasks = filterTasks(tasks);

  // Layout icons
  const layoutOptions: { value: TasksLayout; icon: React.ElementType; label: string }[] = [
    { value: "lists", icon: List, label: "Lists" },
    { value: "grid", icon: LayoutGrid, label: "Grid" },
    { value: "columns", icon: Columns3, label: "Columns" },
    { value: "kanban", icon: Kanban, label: "Kanban" },
  ];

  // No lists state
  if (!loadingLists && taskLists.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <ListTodo className="h-10 w-10 text-primary" />
        </div>
        <h2 className="mt-6 text-2xl font-semibold">No Task Lists</h2>
        <p className="mt-2 text-center text-muted-foreground">
          Sync your Google Tasks to get started.
        </p>
        <Button
          className="mt-6"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
        >
          {syncMutation.isPending ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Sync Google Tasks
        </Button>
        {insufficientScope && (
          <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-4 text-center">
            <p className="text-sm text-primary">Task access not yet authorized.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => {
                const token = useAuthStore.getState().accessToken;
                window.location.href = buildOAuthUrl("google", "tasks", token, window.location.href);
              }}
            >
              Authorize Google Tasks
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Task item component
  const TaskItem = ({ task, showList = false }: { task: Task; showList?: boolean }) => {
    const list = taskLists.find((l) => l.id === task.taskListId);
    return (
      <div
        className={cn(
          "flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors rounded-lg",
          layout === "grid" && "flex-col items-start"
        )}
      >
        <button
          onClick={() => handleToggleTask(task)}
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            task.status === "completed"
              ? "border-green-500 bg-green-500 text-white"
              : "border-muted-foreground hover:border-primary"
          )}
        >
          {task.status === "completed" && <Check className="h-3 w-3" />}
        </button>
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "truncate",
              task.status === "completed" && "line-through text-muted-foreground"
            )}
          >
            {task.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            {showList && list && (
              <span className="text-xs text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded">
                {list.name}
              </span>
            )}
            {task.dueDate && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {format(new Date(task.dueDate), "MMM d, yyyy")}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => deleteMutation.mutate(task.id)}
          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  };

  // Render Lists Layout (default)
  const renderListsLayout = () => (
    <div className="space-y-4">
      {taskLists.map((list) => {
        const listTasks = filterTasks(tasksByList[list.id] || []);
        const isExpanded = expandedLists.has(list.id);
        const pendingCount = (tasksByList[list.id] || []).filter(
          (t) => t.status !== "completed"
        ).length;

        return (
          <div
            key={list.id}
            className="rounded-lg border border-border bg-card overflow-hidden"
          >
            {/* List header */}
            <button
              onClick={() => toggleListExpanded(list.id)}
              className="flex w-full items-center justify-between p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <h3 className="font-medium">{list.name}</h3>
                {pendingCount > 0 && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {pendingCount}
                  </span>
                )}
              </div>
            </button>

            {/* Tasks */}
            {isExpanded && (
              <div className="border-t border-border">
                {listTasks.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">No tasks</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {listTasks.map((task) => (
                      <li key={task.id}>
                        <TaskItem task={task} />
                      </li>
                    ))}
                  </ul>
                )}

                {/* Add task input */}
                <div className="flex items-center gap-2 p-4 border-t border-border bg-muted/30">
                  <Circle className="h-5 w-5 text-muted-foreground" />
                  <input
                    type="text"
                    value={activeAddList === list.id ? newTaskTitle : ""}
                    onChange={(e) => {
                      setActiveAddList(list.id);
                      setNewTaskTitle(e.target.value);
                    }}
                    onFocus={() => setActiveAddList(list.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleAddTask(list.id);
                      }
                    }}
                    placeholder="Add a task..."
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleAddTask(list.id)}
                    disabled={!newTaskTitle.trim() || createMutation.isPending}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // Render Grid Layout
  const renderGridLayout = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {allFilteredTasks.map((task) => (
        <div
          key={task.id}
          className="rounded-lg border border-border bg-card p-3 hover:shadow-md transition-shadow"
        >
          <TaskItem task={task} showList />
        </div>
      ))}
      {allFilteredTasks.length === 0 && (
        <div className="col-span-full text-center py-8 text-muted-foreground">
          No tasks to display
        </div>
      )}
    </div>
  );

  // Render Columns Layout (side-by-side lists)
  const renderColumnsLayout = () => (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {taskLists.map((list) => {
        const listTasks = filterTasks(tasksByList[list.id] || []);
        const pendingCount = (tasksByList[list.id] || []).filter(
          (t) => t.status !== "completed"
        ).length;

        return (
          <div
            key={list.id}
            className="flex-shrink-0 w-80 rounded-lg border border-border bg-card flex flex-col max-h-[calc(100vh-200px)]"
          >
            {/* Column header */}
            <div className="p-4 border-b border-border bg-muted/30">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{list.name}</h3>
                {pendingCount > 0 && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {pendingCount}
                  </span>
                )}
              </div>
            </div>

            {/* Tasks */}
            <div className="flex-1 overflow-y-auto p-2">
              {listTasks.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground text-center">No tasks</p>
              ) : (
                <div className="space-y-2">
                  {listTasks.map((task) => (
                    <div key={task.id} className="rounded border border-border bg-background">
                      <TaskItem task={task} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add task */}
            <div className="p-3 border-t border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={activeAddList === list.id ? newTaskTitle : ""}
                  onChange={(e) => {
                    setActiveAddList(list.id);
                    setNewTaskTitle(e.target.value);
                  }}
                  onFocus={() => setActiveAddList(list.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleAddTask(list.id);
                    }
                  }}
                  placeholder="Add a task..."
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleAddTask(list.id)}
                  disabled={!newTaskTitle.trim() || createMutation.isPending}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  // Render Kanban Layout (by status)
  const renderKanbanLayout = () => {
    const pendingTasks = tasks.filter((t) => t.status !== "completed");
    const completedTasks = tasks.filter((t) => t.status === "completed");

    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {/* To Do column */}
        <div className="flex-shrink-0 w-96 rounded-lg border border-border bg-card flex flex-col max-h-[calc(100vh-200px)]">
          <div className="p-4 border-b border-border bg-muted/30">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">To Do</h3>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {pendingTasks.length}
              </span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {pendingTasks.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground text-center">No tasks</p>
            ) : (
              <div className="space-y-2">
                {pendingTasks.map((task) => (
                  <div key={task.id} className="rounded border border-border bg-background">
                    <TaskItem task={task} showList />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Completed column */}
        {showCompleted && (
          <div className="flex-shrink-0 w-96 rounded-lg border border-border bg-card flex flex-col max-h-[calc(100vh-200px)]">
            <div className="p-4 border-b border-border bg-green-500/10">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-green-700 dark:text-green-400">Completed</h3>
                <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                  {completedTasks.length}
                </span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {completedTasks.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground text-center">No completed tasks</p>
              ) : (
                <div className="space-y-2">
                  {completedTasks.map((task) => (
                    <div key={task.id} className="rounded border border-border bg-background opacity-60">
                      <TaskItem task={task} showList />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col relative">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
        <h1 className="text-lg font-semibold">Tasks</h1>
        <div className="flex items-center gap-3">
          {/* Layout selector */}
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            {layoutOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setLayout(option.value)}
                className={cn(
                  "p-2 transition-colors",
                  layout === option.value
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground"
                )}
                title={option.label}
              >
                <option.icon className="h-4 w-4" />
              </button>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
              className="rounded"
            />
            Show completed
          </label>
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            <RefreshCw
              className={cn("mr-2 h-4 w-4", syncMutation.isPending && "animate-spin")}
            />
            Sync
          </Button>
        </div>
      </header>

      {insufficientScope && (
        <div className="mx-4 mt-2 flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-2">
          <span className="text-sm text-primary">Task access not yet authorized.</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const token = useAuthStore.getState().accessToken;
              window.location.href = buildOAuthUrl("google", "tasks", token, window.location.href);
            }}
          >
            Authorize
          </Button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loadingLists || loadingTasks ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {layout === "lists" && renderListsLayout()}
            {layout === "grid" && renderGridLayout()}
            {layout === "columns" && renderColumnsLayout()}
            {layout === "kanban" && renderKanbanLayout()}
          </>
        )}
      </div>

      {/* Pen FAB button */}
      <button
        onClick={() => setShowHandwriting(true)}
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-md hover:shadow-lg hover:bg-primary/90 transition-all flex items-center justify-center"
        title="Write task by hand"
      >
        <PenTool className="h-6 w-6" />
      </button>

      {/* Handwriting overlay */}
      {showHandwriting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-2xl mx-4 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Write a Task</h2>
                {defaultTaskList && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Will be added to: {defaultTaskList.name}
                  </p>
                )}
              </div>
              <button
                onClick={handleCloseHandwriting}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {handwritingStatus === "drawing" && (
                <HandwritingCanvas
                  onRecognized={handleHandwritingRecognized}
                  onCancel={handleCloseHandwriting}
                  placeholder="Write your task here... (e.g., 'buy groceries')"
                  className="h-64"
                />
              )}

              {handwritingStatus === "creating" && (
                <div className="h-64 flex flex-col items-center justify-center">
                  <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mb-4" />
                  <p className="text-muted-foreground">Creating task...</p>
                </div>
              )}

              {handwritingStatus === "success" && (
                <div className="h-64 flex flex-col items-center justify-center">
                  <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                    <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="font-medium text-green-600 dark:text-green-400">Task created!</p>
                </div>
              )}

              {handwritingStatus === "error" && (
                <div className="h-64 flex flex-col items-center justify-center">
                  <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                    <X className="h-8 w-8 text-red-600 dark:text-red-400" />
                  </div>
                  <p className="font-medium text-red-600 dark:text-red-400">
                    {handwritingError || "Something went wrong"}
                  </p>
                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={handleRetryHandwriting}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                    >
                      Try Again
                    </button>
                    <button
                      onClick={handleCloseHandwriting}
                      className="px-4 py-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
