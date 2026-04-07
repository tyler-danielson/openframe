import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ListTodo, Target, Trophy, Medal } from "lucide-react";
import { TasksPage } from "./TasksPage";
import { HabitList } from "../components/habits/HabitList";
import { GoalList } from "../components/goals/GoalList";
import { Leaderboard } from "../components/gamification/Leaderboard";
import { useAuthStore } from "../stores/auth";
import { isProductivityFeatureAvailable } from "@openframe/shared";
import type { UserMode } from "@openframe/shared";

const TABS = [
  { id: "tasks", label: "Tasks", icon: ListTodo },
  { id: "habits", label: "Habits", icon: Target },
  { id: "goals", label: "Goals", icon: Trophy },
  { id: "leaderboard", label: "Leaderboard", icon: Medal },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ProductivityPage() {
  const [activeTab, setActiveTab] = useState<TabId>("tasks");
  const user = useAuthStore((s) => s.user);
  const userMode: UserMode = (user?.preferences as any)?.userMode ?? "simple";

  const visibleTabs = TABS.filter((tab) => {
    if (tab.id === "tasks" || tab.id === "habits") return true;
    return isProductivityFeatureAvailable(
      tab.id === "leaderboard" ? "leaderboard" : "goals",
      userMode
    );
  });

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-1 border-b border-border">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-primary hover:bg-primary/5"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        {activeTab === "tasks" && <TasksPage />}
        {activeTab === "habits" && <HabitList />}
        {activeTab === "goals" && <GoalList />}
        {activeTab === "leaderboard" && <Leaderboard />}
      </div>
    </div>
  );
}
