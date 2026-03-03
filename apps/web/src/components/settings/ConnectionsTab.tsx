import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Trash2,
  Unlink,
  X,
} from "lucide-react";
import { api } from "../../services/api";
import { useAuthStore } from "../../stores/auth";
import { appUrl } from "../../lib/cloud";
import { buildOAuthUrl } from "../../utils/oauth-scopes";
import { Button } from "../ui/Button";

type SettingsTab =
  | "account"
  | "connections"
  | "calendars"
  | "tasks"
  | "modules"
  | "entertainment"
  | "appearance"
  | "ai"
  | "assumptions"
  | "automations"
  | "cameras"
  | "homeassistant"
  | "kiosks"
  | "companion"
  | "users"
  | "cloud"
  | "system"
  | "billing"
  | "instances"
  | "support";

interface ConnectionsTabProps {
  onNavigateToTab: (tab: SettingsTab | null) => void;
}

// --- Service definitions ---

type ServiceCategory =
  | "calendar"
  | "media"
  | "smarthome"
  | "productivity"
  | "communication"
  | "information";

interface ServiceDef {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  bgColor: string;
  category: ServiceCategory;
  configTab?: SettingsTab;
  configSubtab?: string;
}

const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  calendar: "Calendar & Email",
  media: "Music & Media",
  smarthome: "Smart Home",
  productivity: "Productivity",
  communication: "Communication",
  information: "Information",
};

const CATEGORY_ORDER: ServiceCategory[] = [
  "calendar",
  "media",
  "smarthome",
  "productivity",
  "communication",
  "information",
];

// Google SVG icon
const GoogleIcon = (
  <svg className="h-5 w-5" viewBox="0 0 24 24">
    <path fill="#EA4335" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#4285F4" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

// Microsoft SVG icon
const MicrosoftIcon = (
  <svg className="h-5 w-5" viewBox="0 0 24 24">
    <rect fill="#F25022" x="1" y="1" width="10" height="10" />
    <rect fill="#7FBA00" x="13" y="1" width="10" height="10" />
    <rect fill="#00A4EF" x="1" y="13" width="10" height="10" />
    <rect fill="#FFB900" x="13" y="13" width="10" height="10" />
  </svg>
);

const SERVICES: ServiceDef[] = [
  // Calendar & Email
  {
    id: "google",
    name: "Google",
    description: "Calendar, Gmail, YouTube",
    icon: GoogleIcon,
    bgColor: "bg-primary/10",
    category: "calendar",
    configTab: "calendars",
  },
  {
    id: "microsoft",
    name: "Microsoft",
    description: "Outlook Calendar & Tasks",
    icon: MicrosoftIcon,
    bgColor: "bg-primary/10",
    category: "calendar",
    configTab: "calendars",
  },
  {
    id: "caldav",
    name: "CalDAV",
    description: "CalDAV calendar servers",
    icon: <span className="text-lg">📅</span>,
    bgColor: "bg-primary/10",
    category: "calendar",
    configTab: "calendars",
  },
  {
    id: "ics",
    name: "ICS Subscriptions",
    description: "iCalendar feed URLs",
    icon: <span className="text-lg">🔗</span>,
    bgColor: "bg-primary/10",
    category: "calendar",
    configTab: "calendars",
  },
  // Music & Media
  {
    id: "spotify",
    name: "Spotify",
    description: "Music playback & control",
    icon: <span className="text-lg">🎵</span>,
    bgColor: "bg-primary/10",
    category: "media",
    configTab: "entertainment",
    configSubtab: "spotify",
  },
  {
    id: "plex",
    name: "Plex",
    description: "Media server streaming",
    icon: <span className="text-lg">🎬</span>,
    bgColor: "bg-primary/10",
    category: "media",
    configTab: "entertainment",
    configSubtab: "plex",
  },
  {
    id: "audiobookshelf",
    name: "Audiobookshelf",
    description: "Audiobooks & podcasts",
    icon: <span className="text-lg">📚</span>,
    bgColor: "bg-primary/10",
    category: "media",
    configTab: "entertainment",
    configSubtab: "audiobookshelf",
  },
  {
    id: "iptv",
    name: "IPTV",
    description: "Live TV streaming",
    icon: <span className="text-lg">📺</span>,
    bgColor: "bg-primary/10",
    category: "media",
    configTab: "entertainment",
    configSubtab: "iptv",
  },
  {
    id: "youtube",
    name: "YouTube",
    description: "Video search & bookmarks",
    icon: <span className="text-lg">▶️</span>,
    bgColor: "bg-primary/10",
    category: "media",
  },
  // Smart Home
  {
    id: "homeassistant",
    name: "Home Assistant",
    description: "Smart home control",
    icon: <span className="text-lg">🏠</span>,
    bgColor: "bg-primary/10",
    category: "smarthome",
    configTab: "homeassistant",
  },
  // Productivity
  {
    id: "remarkable",
    name: "reMarkable",
    description: "Tablet sync & agenda push",
    icon: <span className="text-lg">📝</span>,
    bgColor: "bg-primary/10",
    category: "productivity",
    configTab: "ai",
  },
  {
    id: "capacities",
    name: "Capacities",
    description: "Notes & knowledge base",
    icon: <span className="text-lg">🧠</span>,
    bgColor: "bg-primary/10",
    category: "productivity",
    configTab: "ai",
  },
  // Communication
  {
    id: "telegram",
    name: "Telegram",
    description: "Bot notifications & reminders",
    icon: <span className="text-lg">💬</span>,
    bgColor: "bg-primary/10",
    category: "communication",
    configTab: "ai",
  },
  // Information
  {
    id: "weather",
    name: "Weather",
    description: "OpenWeatherMap forecasts",
    icon: <span className="text-lg">🌤️</span>,
    bgColor: "bg-primary/10",
    category: "information",
    configTab: "appearance",
  },
  {
    id: "news",
    name: "News & RSS",
    description: "Feed subscriptions",
    icon: <span className="text-lg">📰</span>,
    bgColor: "bg-primary/10",
    category: "information",
    configTab: "entertainment",
    configSubtab: "news",
  },
  {
    id: "sports",
    name: "Sports",
    description: "ESPN scores & schedules",
    icon: <span className="text-lg">🏈</span>,
    bgColor: "bg-primary/10",
    category: "information",
    configTab: "entertainment",
    configSubtab: "sports",
  },
];

export function ConnectionsTab({ onNavigateToTab }: ConnectionsTabProps) {
  const queryClient = useQueryClient();
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalCategory, setAddModalCategory] = useState<ServiceCategory | "all">("all");
  const [addModalSearch, setAddModalSearch] = useState("");

  // --- Data fetching (all in parallel, no module gating) ---
  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.getMe(),
  });

  const { data: calendars = [] } = useQuery({
    queryKey: ["calendars"],
    queryFn: () => api.getCalendars(),
  });

  const { data: spotifyAccounts = [] } = useQuery({
    queryKey: ["spotify-accounts"],
    queryFn: () => api.getSpotifyAccounts(),
  });

  const { data: haConfig } = useQuery({
    queryKey: ["ha-config"],
    queryFn: () => api.getHomeAssistantConfig(),
  });

  const { data: plexServers = [] } = useQuery({
    queryKey: ["plex-servers"],
    queryFn: () => api.getPlexServers(),
  });

  const { data: audiobookshelfServers = [] } = useQuery({
    queryKey: ["audiobookshelf-servers"],
    queryFn: () => api.getAudiobookshelfServers(),
  });

  const { data: iptvServers = [] } = useQuery({
    queryKey: ["iptv-servers"],
    queryFn: () => api.getIptvServers(),
  });

  const { data: telegramStatus } = useQuery({
    queryKey: ["telegram-status"],
    queryFn: () => api.getTelegramStatus(),
  });

  const { data: remarkableStatus } = useQuery({
    queryKey: ["remarkable-status"],
    queryFn: () => api.getRemarkableStatus(),
  });

  const { data: capacitiesStatus } = useQuery({
    queryKey: ["capacities-status"],
    queryFn: () => api.getCapacitiesStatus(),
  });

  const { data: newsFeeds = [] } = useQuery({
    queryKey: ["news-feeds"],
    queryFn: () => api.getNewsFeeds(),
  });

  const { data: weatherSettings = [] } = useQuery({
    queryKey: ["settings", "weather"],
    queryFn: () => api.getCategorySettings("weather"),
  });

  const { data: googleSettings = [] } = useQuery({
    queryKey: ["settings", "google"],
    queryFn: () => api.getCategorySettings("google"),
  });

  const { data: favoriteTeams = [] } = useQuery({
    queryKey: ["favorite-teams"],
    queryFn: () => api.getFavoriteTeams(),
  });

  // --- Disconnect mutations ---
  const disconnectTelegram = useMutation({
    mutationFn: () => api.disconnectTelegram(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["telegram-status"] });
      setConfirmDisconnect(null);
      setDisconnecting(null);
    },
  });

  const disconnectRemarkable = useMutation({
    mutationFn: () => api.disconnectRemarkable(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["remarkable-status"] });
      setConfirmDisconnect(null);
      setDisconnecting(null);
    },
  });

  const disconnectCapacities = useMutation({
    mutationFn: () => api.disconnectCapacities(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capacities-status"] });
      setConfirmDisconnect(null);
      setDisconnecting(null);
    },
  });

  const deleteHAConfig = useMutation({
    mutationFn: () => api.deleteHomeAssistantConfig(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ha-config"] });
      setConfirmDisconnect(null);
      setDisconnecting(null);
    },
  });

  // --- Status helpers ---

  function getServiceStatus(service: ServiceDef): {
    connected: boolean;
    detail: string;
    count?: number;
  } {
    switch (service.id) {
      case "google":
        return {
          connected: !!user?.linkedProviders?.includes("google"),
          detail: user?.linkedProviders?.includes("google") ? "Account linked" : "Not connected",
        };
      case "microsoft":
        return {
          connected: !!user?.linkedProviders?.includes("microsoft"),
          detail: user?.linkedProviders?.includes("microsoft") ? "Account linked" : "Not connected",
        };
      case "spotify": {
        const connected = !!user?.linkedProviders?.includes("spotify") || spotifyAccounts.length > 0;
        return {
          connected,
          detail: connected
            ? `${spotifyAccounts.length} account${spotifyAccounts.length !== 1 ? "s" : ""}`
            : "Not connected",
          count: spotifyAccounts.length,
        };
      }
      case "caldav": {
        const caldavCals = calendars.filter((c) => c.provider === "caldav");
        return {
          connected: caldavCals.length > 0,
          detail: `${caldavCals.length} calendar${caldavCals.length !== 1 ? "s" : ""}`,
          count: caldavCals.length,
        };
      }
      case "ics": {
        const icsCals = calendars.filter((c) => c.provider === "ics");
        return {
          connected: icsCals.length > 0,
          detail: `${icsCals.length} subscription${icsCals.length !== 1 ? "s" : ""}`,
          count: icsCals.length,
        };
      }
      case "homeassistant":
        return {
          connected: !!haConfig?.url,
          detail: haConfig?.url || "Not connected",
        };
      case "plex":
        return {
          connected: plexServers.length > 0,
          detail: `${plexServers.length} server${plexServers.length !== 1 ? "s" : ""}`,
          count: plexServers.length,
        };
      case "audiobookshelf":
        return {
          connected: audiobookshelfServers.length > 0,
          detail: `${audiobookshelfServers.length} server${audiobookshelfServers.length !== 1 ? "s" : ""}`,
          count: audiobookshelfServers.length,
        };
      case "iptv":
        return {
          connected: iptvServers.length > 0,
          detail: `${iptvServers.length} server${iptvServers.length !== 1 ? "s" : ""}`,
          count: iptvServers.length,
        };
      case "telegram":
        return {
          connected: !!telegramStatus?.connected,
          detail: telegramStatus?.connected
            ? `@${telegramStatus.botUsername}`
            : "Not connected",
        };
      case "remarkable":
        return {
          connected: !!remarkableStatus?.connected,
          detail: remarkableStatus?.connected ? "Device linked" : "Not connected",
        };
      case "capacities":
        return {
          connected: !!capacitiesStatus?.connected,
          detail: capacitiesStatus?.connected
            ? `${capacitiesStatus.spaces?.length ?? 0} space${(capacitiesStatus.spaces?.length ?? 0) !== 1 ? "s" : ""}`
            : "Not connected",
        };
      case "weather": {
        const apiKey = weatherSettings.find((s) => s.key === "api_key");
        return {
          connected: !!apiKey?.value,
          detail: apiKey?.value ? "API key configured" : "Not connected",
        };
      }
      case "youtube": {
        const ytKey = googleSettings.find((s) => s.key === "youtube_api_key");
        return {
          connected: !!ytKey?.value,
          detail: ytKey?.value ? "API key configured" : "Not connected",
        };
      }
      case "news":
        return {
          connected: newsFeeds.length > 0,
          detail: `${newsFeeds.length} feed${newsFeeds.length !== 1 ? "s" : ""}`,
          count: newsFeeds.length,
        };
      case "sports":
        return {
          connected: favoriteTeams.length > 0,
          detail: `${favoriteTeams.length} team${favoriteTeams.length !== 1 ? "s" : ""}`,
          count: favoriteTeams.length,
        };
      default:
        return { connected: false, detail: "Not connected" };
    }
  }

  function handleConnect(service: ServiceDef) {
    setShowAddModal(false);
    const token = useAuthStore.getState().accessToken;
    switch (service.id) {
      case "google":
        window.location.href = buildOAuthUrl("google", "base", token, appUrl("/settings?tab=connections"));
        return;
      case "microsoft":
        window.location.href = buildOAuthUrl("microsoft", "base", token, appUrl("/settings?tab=connections"));
        return;
      case "spotify":
        window.location.href = api.getSpotifyAuthUrl();
        return;
      default:
        // For all other services, navigate to their config tab
        if (service.configTab) {
          onNavigateToTab(service.configTab);
        }
    }
  }

  function handleDisconnect(serviceId: string) {
    setDisconnecting(serviceId);
    switch (serviceId) {
      case "telegram":
        disconnectTelegram.mutate();
        break;
      case "remarkable":
        disconnectRemarkable.mutate();
        break;
      case "capacities":
        disconnectCapacities.mutate();
        break;
      case "homeassistant":
        deleteHAConfig.mutate();
        break;
      default: {
        // For OAuth and multi-resource services, navigate to config tab
        const service = SERVICES.find((s) => s.id === serviceId);
        if (service?.configTab) {
          onNavigateToTab(service.configTab);
        }
        setDisconnecting(null);
        setConfirmDisconnect(null);
      }
    }
  }

  // Split services into connected vs unconnected
  const connectedServices = SERVICES.filter((s) => getServiceStatus(s).connected);
  const unconnectedServices = SERVICES.filter((s) => !getServiceStatus(s).connected);

  // Group connected services by category
  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    services: connectedServices.filter((s) => s.category === cat),
  })).filter((g) => g.services.length > 0);

  // Filter unconnected services for the add modal (by category + search)
  const filteredAddServices = useMemo(() => {
    let list = unconnectedServices;
    if (addModalCategory !== "all") {
      list = list.filter((s) => s.category === addModalCategory);
    }
    if (addModalSearch.trim()) {
      const q = addModalSearch.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q)
      );
    }
    return list;
  }, [unconnectedServices, addModalCategory, addModalSearch]);

  return (
    <div className="space-y-6">
      {/* Header with Add button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Link2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">
              {connectedServices.length} connected service{connectedServices.length !== 1 ? "s" : ""}
            </p>
            <p className="text-sm text-muted-foreground">
              Manage your linked accounts and integrations
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setAddModalCategory("all");
            setAddModalSearch("");
            setShowAddModal(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Connection
        </Button>
      </div>

      {/* Connected services list */}
      {connectedServices.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
          <Link2 className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No connections yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Click "Add Connection" to link your first service
          </p>
        </div>
      ) : (
        grouped.map((group) => (
          <div key={group.category}>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary">
              {group.label}
            </h3>
            <div className="space-y-2">
              {group.services.map((service) => {
                const status = getServiceStatus(service);
                const isConfirming = confirmDisconnect === service.id;
                const isDisconnecting = disconnecting === service.id;

                return (
                  <div
                    key={service.id}
                    className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${service.bgColor}`}
                      >
                        {service.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{service.name}</p>
                          <span className="flex items-center gap-1 text-xs text-primary">
                            <Check className="h-3 w-3" />
                            Connected
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {status.detail}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      {isConfirming ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            Disconnect?
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setConfirmDisconnect(null)}
                            disabled={isDisconnecting}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive border-destructive/40 hover:bg-destructive/10"
                            onClick={() => handleDisconnect(service.id)}
                            disabled={isDisconnecting}
                          >
                            {isDisconnecting ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Unlink className="mr-1 h-3 w-3" />
                            )}
                            Disconnect
                          </Button>
                        </div>
                      ) : (
                        <>
                          {service.configTab && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onNavigateToTab(service.configTab!)}
                            >
                              <Settings className="mr-1 h-3 w-3" />
                              Configure
                            </Button>
                          )}
                          {["telegram", "remarkable", "capacities", "homeassistant"].includes(service.id) && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-muted-foreground hover:text-destructive hover:border-destructive/40"
                              onClick={() => setConfirmDisconnect(service.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                          {["google", "microsoft", "spotify"].includes(service.id) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleConnect(service)}
                            >
                              <RefreshCw className="mr-1 h-3 w-3" />
                              Reconnect
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Add Connection Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowAddModal(false)}
          />

          {/* Modal — anchored to top */}
          <div className="absolute left-1/2 top-8 z-10 flex w-full max-w-2xl -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl" style={{ maxHeight: "calc(100vh - 4rem)" }}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold">Add a Connection</h2>
              <div className="flex items-center gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={addModalSearch}
                    onChange={(e) => setAddModalSearch(e.target.value)}
                    className="h-9 w-48 rounded-lg border border-border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  {addModalSearch && (
                    <button
                      onClick={() => setAddModalSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Body: sidebar + grid */}
            <div className="flex flex-1 overflow-hidden">
              {/* Category sidebar */}
              <div className="w-48 shrink-0 border-r border-border overflow-y-auto bg-muted/30 py-2">
                <button
                  type="button"
                  onClick={() => setAddModalCategory("all")}
                  className={`w-full px-4 py-2 text-left text-sm font-medium transition-colors ${
                    addModalCategory === "all"
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-primary/10"
                  }`}
                >
                  All
                </button>
                {CATEGORY_ORDER.map((cat) => {
                  const catServices = unconnectedServices.filter((s) => s.category === cat);
                  if (catServices.length === 0) return null;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setAddModalCategory(cat)}
                      className={`w-full px-4 py-2 text-left text-sm font-medium transition-colors ${
                        addModalCategory === cat
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-primary/10"
                      }`}
                    >
                      {CATEGORY_LABELS[cat]}
                    </button>
                  );
                })}
              </div>

              {/* Service grid */}
              <div className="flex-1 overflow-y-auto p-4">
                {filteredAddServices.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Search className="h-8 w-8 mb-3" />
                    <p className="text-sm">
                      {unconnectedServices.length === 0
                        ? "All services are already connected"
                        : "No services match your search"}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {filteredAddServices.map((service) => (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => handleConnect(service)}
                        className="flex items-start gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                      >
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${service.bgColor}`}
                        >
                          {service.icon}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium">{service.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {service.description}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
