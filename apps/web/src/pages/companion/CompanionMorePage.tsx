import { useNavigate } from "react-router-dom";
import {
  Image,
  Tv,
  Zap,
  Newspaper,
  Cloud,
  ChefHat,
  Settings,
  LogOut,
  ChevronRight,
  User,
  UserPlus,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "../../stores/auth";
import { api } from "../../services/api";
import { Card } from "../../components/ui/Card";
import { useCompanion } from "./CompanionContext";

interface MenuItem {
  label: string;
  icon: typeof Image;
  path: string;
  /** Permission key that must be truthy to show this item */
  requirePermission?: "canViewPhotos" | "canViewIptv" | "canViewHomeAssistant" | "canViewNews" | "canViewWeather" | "canViewRecipes";
  /** Only visible to the owner (admin) */
  requireOwner?: boolean;
}

interface MenuGroup {
  label: string;
  items: MenuItem[];
}

const allMenuGroups: MenuGroup[] = [
  {
    label: "Media",
    items: [
      { label: "Photos", icon: Image, path: "/companion/more/photos", requirePermission: "canViewPhotos" },
      { label: "IPTV", icon: Tv, path: "/companion/more/iptv", requirePermission: "canViewIptv" },
    ],
  },
  {
    label: "Smart Home",
    items: [
      { label: "Home Assistant", icon: Zap, path: "/companion/more/homeassistant", requirePermission: "canViewHomeAssistant" },
    ],
  },
  {
    label: "Information",
    items: [
      { label: "News", icon: Newspaper, path: "/companion/more/news", requirePermission: "canViewNews" },
      { label: "Weather", icon: Cloud, path: "/companion/more/weather", requirePermission: "canViewWeather" },
    ],
  },
  {
    label: "Food",
    items: [
      { label: "Recipes", icon: ChefHat, path: "/companion/more/recipes", requirePermission: "canViewRecipes" },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Join Requests", icon: UserPlus, path: "/companion/more/join-requests", requireOwner: true },
      { label: "Settings", icon: Settings, path: "/companion/more/settings" },
    ],
  },
];

export function CompanionMorePage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const companion = useCompanion();

  // Join request count (only for owners)
  const { data: joinRequestCount } = useQuery({
    queryKey: ["join-request-count"],
    queryFn: () => api.getJoinRequestCount(),
    enabled: companion.isOwner,
    staleTime: 30_000,
  });

  // Filter menu groups based on permissions
  const menuGroups = allMenuGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.requireOwner && !companion.isOwner) return false;
        if (!item.requirePermission) return true;
        return companion[item.requirePermission];
      }),
    }))
    .filter((group) => group.items.length > 0);

  const handleLogout = () => {
    logout();
    navigate("/companion/login", { replace: true });
  };

  return (
    <div className="p-4 pb-6 space-y-4">
      {/* User info */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <User className="h-6 w-6 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-base font-medium text-foreground truncate">{user?.name || "User"}</div>
            <div className="text-sm text-muted-foreground truncate">{user?.email || ""}</div>
          </div>
        </div>
      </Card>

      {/* Menu groups */}
      {menuGroups.map((group) => (
        <div key={group.label}>
          <h3 className="text-sm font-semibold text-primary uppercase tracking-wide px-1 mb-2">
            {group.label}
          </h3>
          <Card className="divide-y divide-border">
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="w-full flex items-center gap-3 px-4 py-4 hover:bg-primary/5 transition-colors text-left first:rounded-t-xl last:rounded-b-xl min-h-[52px]"
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="flex-1 text-base font-medium text-foreground">{item.label}</span>
                  {item.path === "/companion/more/join-requests" && joinRequestCount?.pending ? (
                    <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground mr-1">
                      {joinRequestCount.pending}
                    </span>
                  ) : null}
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </button>
              );
            })}
          </Card>
        </div>
      ))}

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 h-14 rounded-xl border border-destructive/30 text-destructive font-medium text-base hover:bg-destructive/5 transition-colors"
      >
        <LogOut className="h-5 w-5" />
        Sign Out
      </button>
    </div>
  );
}
