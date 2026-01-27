import { create } from "zustand";
import { persist } from "zustand/middleware";

export type TasksLayout = "lists" | "grid" | "columns" | "kanban";

interface TasksState {
  // Settings
  layout: TasksLayout;
  showCompleted: boolean;
  expandAllLists: boolean;

  // Actions
  setLayout: (layout: TasksLayout) => void;
  setShowCompleted: (show: boolean) => void;
  setExpandAllLists: (expand: boolean) => void;
}

export const useTasksStore = create<TasksState>()(
  persist(
    (set) => ({
      layout: "lists",
      showCompleted: false,
      expandAllLists: false,

      setLayout: (layout) => set({ layout }),
      setShowCompleted: (showCompleted) => set({ showCompleted }),
      setExpandAllLists: (expandAllLists) => set({ expandAllLists }),
    }),
    {
      name: "tasks-store",
      partialize: (state) => ({
        layout: state.layout,
        showCompleted: state.showCompleted,
        expandAllLists: state.expandAllLists,
      }),
    }
  )
);
