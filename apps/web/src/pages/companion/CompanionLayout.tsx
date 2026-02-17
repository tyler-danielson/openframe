import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Home, CalendarDays, CheckSquare, Monitor, MoreHorizontal } from "lucide-react";
import { CompanionProvider, useCompanion } from "./CompanionContext";

interface TabDef {
  path: string;
  label: string;
  icon: typeof Home;
  exact?: boolean;
  /** Permission key that must be truthy to show this tab */
  requirePermission?: "canViewCalendar" | "canViewTasks" | "canViewKiosks";
}

const allTabs: TabDef[] = [
  { path: "/companion", label: "Home", icon: Home, exact: true },
  { path: "/companion/calendar", label: "Calendar", icon: CalendarDays, requirePermission: "canViewCalendar" },
  { path: "/companion/tasks", label: "Tasks", icon: CheckSquare, requirePermission: "canViewTasks" },
  { path: "/companion/kiosks", label: "Kiosks", icon: Monitor, requirePermission: "canViewKiosks" },
  { path: "/companion/more", label: "More", icon: MoreHorizontal },
];

function CompanionLayoutInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const companion = useCompanion();

  const tabs = allTabs.filter((tab) => {
    if (!tab.requirePermission) return true;
    return companion[tab.requirePermission];
  });

  const isTabActive = (tab: TabDef) => {
    if (tab.exact) {
      return location.pathname === "/companion" || location.pathname === "/companion/";
    }
    return location.pathname.startsWith(tab.path);
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-background text-foreground">
      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      {/* Bottom Tab Bar */}
      <nav className="shrink-0 bg-card border-t border-border h-16 flex items-stretch safe-area-bottom">
        {tabs.map((tab) => {
          const active = isTabActive(tab);
          const Icon = tab.icon;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors min-h-[44px] ${
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export function CompanionLayout() {
  return (
    <CompanionProvider>
      <CompanionLayoutInner />
    </CompanionProvider>
  );
}
