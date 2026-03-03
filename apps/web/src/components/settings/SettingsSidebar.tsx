import { Link } from "react-router-dom";
import { cn } from "../../lib/utils";

export type SettingsTab =
  | "account"
  | "connections"
  | "modules"
  | "kiosks"
  | "ai"
  | "assumptions"
  | "automations"
  | "companion"
  | "users"
  | "cloud"
  | "system"
  | "billing"
  | "instances"
  | "support";

export interface SidebarGroup {
  label: string;
  tabIds: SettingsTab[];
}

interface TabDef {
  id: SettingsTab;
  label: string;
  icon: React.ReactNode;
  description: string;
}

interface SettingsSidebarProps {
  groups: SidebarGroup[];
  filteredTabs: TabDef[];
  activeTab: SettingsTab;
  onNavigate?: () => void;
}

export function SettingsSidebar({
  groups,
  filteredTabs,
  activeTab,
  onNavigate,
}: SettingsSidebarProps) {
  const filteredTabIds = new Set(filteredTabs.map((t) => t.id));

  return (
    <aside className="w-64 shrink-0 bg-card/50 border-r border-border/50 overflow-y-auto h-full">
      <div className="p-4 pb-2">
        <h1 className="text-lg font-semibold text-foreground">Settings</h1>
      </div>
      <nav className="px-2 pb-4 space-y-4">
        {groups.map((group) => {
          const visibleTabs = group.tabIds.filter((id) => filteredTabIds.has(id));
          if (visibleTabs.length === 0) return null;

          return (
            <div key={group.label}>
              <div className="px-3 mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {group.label}
              </div>
              <ul className="space-y-0.5">
                {visibleTabs.map((tabId) => {
                  const tab = filteredTabs.find((t) => t.id === tabId);
                  if (!tab) return null;
                  const isActive = activeTab === tabId;

                  return (
                    <li key={tabId}>
                      <Link
                        to={`/settings/${tabId}`}
                        onClick={onNavigate}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                          isActive
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        )}
                      >
                        <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{tab.icon}</span>
                        <span className="flex-1 text-left">{tab.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
