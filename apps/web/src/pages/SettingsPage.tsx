import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { RefreshCw, Key, Plus, ExternalLink, User, Calendar, Monitor, Image as ImageIcon, Tv, FolderOpen, CheckCircle, XCircle, LogIn, Video, Home, Trash2, Loader2, Star, Search, ListTodo, List, LayoutGrid, Columns3, Kanban, Music, Pencil, Speaker, Smartphone, ChevronDown, ChevronUp, Settings, Sparkles, Crown, Trophy, Eye, EyeOff, Play, Zap, Clock, Power, Bell, ToggleLeft, ToggleRight, Newspaper, Rss, Globe } from "lucide-react";
import type { Camera } from "@openframe/shared";
import { api, type SettingCategoryDefinition, type SystemSetting, type HAAvailableCamera, COLOR_SCHEMES, type ColorScheme } from "../services/api";
import { useAuthStore } from "../stores/auth";
import { useCalendarStore } from "../stores/calendar";
import { useScreensaverStore, type ScreensaverLayout, type ScreensaverTransition, type ClockPosition, type ClockSize } from "../stores/screensaver";
import { ToggleGroup } from "../components/ui/Toggle";
import { useTasksStore, type TasksLayout } from "../stores/tasks";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { LocalPhotoAlbums } from "../components/photos/LocalPhotoAlbums";
import { AlbumPhotoGrid } from "../components/photos/AlbumPhotoGrid";
import { ManageAllPhotos } from "../components/photos/ManageAllPhotos";
import { EntityPicker } from "../components/homeassistant/EntityPicker";
import { TeamSelector, FavoriteTeamCard } from "../components/sports";
import type { HomeAssistantRoom, FavoriteSportsTeam, Automation, AutomationParseResult, AutomationTriggerType, AutomationActionType, TimeTriggerConfig, StateTriggerConfig, DurationTriggerConfig, ServiceCallActionConfig, NotificationActionConfig, NewsFeed, PresetFeed } from "@openframe/shared";

// Parent tabs for URL routing
type SettingsTab = "account" | "calendars" | "tasks" | "entertainment" | "appearance" | "ai" | "automations" | "cameras" | "homeassistant" | "system";

// Entertainment sub-tabs
type EntertainmentSubTab = "sports" | "spotify" | "iptv" | "news";

const validTabs: SettingsTab[] = ["account", "calendars", "tasks", "entertainment", "appearance", "ai", "automations", "cameras", "homeassistant", "system"];
const validEntertainmentSubTabs: EntertainmentSubTab[] = ["sports", "spotify", "iptv", "news"];

const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: "account", label: "Account", icon: <User className="h-4 w-4" /> },
  { id: "calendars", label: "Calendars", icon: <Calendar className="h-4 w-4" /> },
  { id: "tasks", label: "Tasks", icon: <ListTodo className="h-4 w-4" /> },
  { id: "entertainment", label: "Entertainment", icon: <Play className="h-4 w-4" /> },
  { id: "appearance", label: "Appearance", icon: <Monitor className="h-4 w-4" /> },
  { id: "ai", label: "AI", icon: <Sparkles className="h-4 w-4" /> },
  { id: "automations", label: "Automations", icon: <Zap className="h-4 w-4" /> },
  { id: "cameras", label: "Cameras", icon: <Video className="h-4 w-4" /> },
  { id: "homeassistant", label: "Home Assistant", icon: <Home className="h-4 w-4" /> },
  { id: "system", label: "System", icon: <Settings className="h-4 w-4" /> },
];

// Sub-tab config for entertainment
const entertainmentSubTabs: { id: EntertainmentSubTab; label: string; icon: React.ReactNode }[] = [
  { id: "sports", label: "Sports", icon: <Trophy className="h-4 w-4" /> },
  { id: "spotify", label: "Spotify", icon: <Music className="h-4 w-4" /> },
  { id: "iptv", label: "IPTV", icon: <Tv className="h-4 w-4" /> },
  { id: "news", label: "News", icon: <Newspaper className="h-4 w-4" /> },
];

function KioskSettings() {
  const queryClient = useQueryClient();
  const setKioskStatus = useAuthStore((state) => state.setKioskStatus);

  const { data: kioskStatus, isLoading } = useQuery({
    queryKey: ["kiosk-status-me"],
    queryFn: () => api.getMyKioskStatus(),
  });

  const enableKiosk = useMutation({
    mutationFn: () => api.enableKiosk(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kiosk-status-me"] });
      setKioskStatus(true);
    },
  });

  const disableKiosk = useMutation({
    mutationFn: () => api.disableKiosk(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kiosk-status-me"] });
      setKioskStatus(false);
    },
  });

  const isEnabled = kioskStatus?.enabled ?? false;
  const isPending = enableKiosk.isPending || disableKiosk.isPending;

  return (
    <Card className="border-2 border-primary/40">
      <CardHeader>
        <CardTitle>Kiosk Mode</CardTitle>
        <CardDescription>
          Allow any device on your network to access the calendar without logging in
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Enable Kiosk Mode</p>
            <p className="text-sm text-muted-foreground">
              When enabled, any device can view and edit your calendar
            </p>
          </div>
          {isLoading ? (
            <div className="h-6 w-11 animate-pulse rounded-full bg-muted" />
          ) : (
            <button
              type="button"
              role="switch"
              aria-checked={isEnabled}
              onClick={() => {
                if (isEnabled) {
                  disableKiosk.mutate();
                } else {
                  enableKiosk.mutate();
                }
              }}
              disabled={isPending}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isEnabled ? "bg-primary" : "bg-muted"
              } ${isPending ? "opacity-50" : ""}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          )}
        </div>

        {isEnabled && (
          <div className="rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
            <div className="flex items-start gap-3">
              <Tv className="mt-0.5 h-5 w-5 text-green-600 dark:text-green-400" />
              <div>
                <p className="font-semibold text-green-900 dark:text-green-100">
                  Kiosk Mode is Active
                </p>
                <p className="mt-1 text-sm text-green-800 dark:text-green-200">
                  Any device on your local network can now access your calendar at this URL:
                </p>
                <code className="mt-2 block rounded bg-white px-3 py-2 text-sm font-mono font-semibold text-gray-900 border border-green-200 dark:bg-gray-900 dark:text-gray-100 dark:border-green-700">
                  {window.location.origin}
                </code>
                <p className="mt-2 text-sm text-green-700 dark:text-green-300">
                  They will have full access to view and create/edit events.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-border p-4">
          <h4 className="font-medium">How it works</h4>
          <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-muted-foreground" />
              Your Google Calendar credentials are stored securely on the server
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-muted-foreground" />
              Other devices use your credentials to access the calendar
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-muted-foreground" />
              Settings are protected and require login to access
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-muted-foreground" />
              Perfect for tablets, smart displays, or shared family devices
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function SystemSettings() {
  const queryClient = useQueryClient();
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, Record<string, string>>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, "idle" | "saving" | "saved" | "error">>({});
  const [locationSearch, setLocationSearch] = useState("");
  const [locationStatus, setLocationStatus] = useState<"idle" | "searching" | "success" | "error">("idle");
  const [locationError, setLocationError] = useState<string | null>(null);

  // Fetch setting definitions
  const { data: definitions = [], isLoading: isLoadingDefs, error: defsError } = useQuery({
    queryKey: ["setting-definitions"],
    queryFn: () => api.getSettingDefinitions(),
  });

  // Fetch current settings
  const { data: settings = [], isLoading: isLoadingSettings, error: settingsError } = useQuery({
    queryKey: ["system-settings"],
    queryFn: () => api.getAllSettings(),
  });

  const isLoading = isLoadingDefs || isLoadingSettings;
  const error = defsError || settingsError;

  // Initialize form values from settings
  const getSettingValue = (category: string, key: string): string => {
    // Check form values first (for unsaved changes)
    if (formValues[category]?.[key] !== undefined) {
      return formValues[category][key];
    }
    // Then check saved settings
    const setting = settings.find((s) => s.category === category && s.key === key);
    return setting?.value || "";
  };

  const handleInputChange = (category: string, key: string, value: string) => {
    setFormValues((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value,
      },
    }));
    // Reset save status when user makes changes
    setSaveStatus((prev) => ({ ...prev, [category]: "idle" }));
  };

  const saveCategory = useMutation({
    mutationFn: async ({ category, values }: { category: string; values: Record<string, string | null> }) => {
      await api.updateCategorySettings(category, values);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
      setSaveStatus((prev) => ({ ...prev, [variables.category]: "saved" }));
      // Clear form values for this category since they're saved
      setFormValues((prev) => {
        const newValues = { ...prev };
        delete newValues[variables.category];
        return newValues;
      });
      // Reset status after 2 seconds
      setTimeout(() => {
        setSaveStatus((prev) => ({ ...prev, [variables.category]: "idle" }));
      }, 2000);
    },
    onError: (_, variables) => {
      setSaveStatus((prev) => ({ ...prev, [variables.category]: "error" }));
    },
  });

  const handleSaveCategory = (category: string, categoryDef: SettingCategoryDefinition) => {
    setSaveStatus((prev) => ({ ...prev, [category]: "saving" }));

    const values: Record<string, string | null> = {};
    for (const setting of categoryDef.settings) {
      const value = getSettingValue(category, setting.key);
      // Skip masked values (unchanged secrets)
      if (value !== "••••••••") {
        values[setting.key] = value || null;
      }
    }

    saveCategory.mutate({ category, values });
  };

  const handleLocationLookup = async () => {
    if (!locationSearch.trim()) return;

    setLocationStatus("searching");
    setLocationError(null);

    try {
      const result = await api.geocodeAddress(locationSearch);
      // Update the form values for weather
      setFormValues((prev) => ({
        ...prev,
        weather: {
          ...prev.weather,
          latitude: result.latitude,
          longitude: result.longitude,
        },
      }));
      setLocationStatus("success");
      setLocationSearch(result.formattedAddress);
      // Reset save status since we have new values
      setSaveStatus((prev) => ({ ...prev, weather: "idle" }));
    } catch (err) {
      setLocationStatus("error");
      setLocationError(err instanceof Error ? err.message : "Failed to lookup location");
    }
  };

  return (
    <Card className="border-2 border-primary/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          System Settings
        </CardTitle>
        <CardDescription>
          Configure API keys and integrations. Secrets are encrypted and stored securely in the database.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {definitions.map((categoryDef) => (
          <div
            key={categoryDef.category}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
          >
            <button
              type="button"
              onClick={() =>
                setExpandedCategory(
                  expandedCategory === categoryDef.category ? null : categoryDef.category
                )
              }
              className="flex w-full items-center justify-between p-4 text-left"
            >
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100">{categoryDef.label}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">{categoryDef.description}</p>
              </div>
              {expandedCategory === categoryDef.category ? (
                <ChevronUp className="h-5 w-5 text-gray-500" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-500" />
              )}
            </button>

            {expandedCategory === categoryDef.category && (
              <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-4">
                {/* Location lookup for weather category */}
                {categoryDef.category === "weather" && (
                  <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 p-4 mb-4">
                    <label className="block text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                      Lookup Location
                    </label>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                      Enter a city name or address to auto-fill latitude and longitude (requires Google Maps API key)
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={locationSearch}
                        onChange={(e) => {
                          setLocationSearch(e.target.value);
                          setLocationStatus("idle");
                        }}
                        placeholder="e.g., New York, NY or 123 Main St, Boston"
                        className="flex-1 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:border-primary focus:outline-none"
                        onKeyDown={(e) => e.key === "Enter" && handleLocationLookup()}
                      />
                      <Button
                        onClick={handleLocationLookup}
                        disabled={locationStatus === "searching" || !locationSearch.trim()}
                        className="whitespace-nowrap"
                      >
                        {locationStatus === "searching" ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {locationStatus === "success" && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-2 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Location found! Latitude and longitude have been updated below.
                      </p>
                    )}
                    {locationStatus === "error" && locationError && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-2 flex items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        {locationError}
                      </p>
                    )}
                  </div>
                )}

                {categoryDef.settings.map((settingDef) => (
                  <div key={settingDef.key}>
                    <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                      {settingDef.label}
                      {settingDef.isSecret && (
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">(encrypted)</span>
                      )}
                    </label>
                    {settingDef.description && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                        {settingDef.description}
                      </p>
                    )}
                    <input
                      type={settingDef.isSecret ? "password" : "text"}
                      value={getSettingValue(categoryDef.category, settingDef.key)}
                      onChange={(e) =>
                        handleInputChange(categoryDef.category, settingDef.key, e.target.value)
                      }
                      placeholder={settingDef.placeholder}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:border-primary focus:outline-none"
                    />
                  </div>
                ))}

                <div className="flex items-center justify-between pt-2">
                  <div className="text-sm">
                    {saveStatus[categoryDef.category] === "saved" && (
                      <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                        <CheckCircle className="h-4 w-4" />
                        Saved
                      </span>
                    )}
                    {saveStatus[categoryDef.category] === "error" && (
                      <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
                        <XCircle className="h-4 w-4" />
                        Error saving
                      </span>
                    )}
                  </div>
                  <Button
                    onClick={() => handleSaveCategory(categoryDef.category, categoryDef)}
                    disabled={saveStatus[categoryDef.category] === "saving"}
                  >
                    {saveStatus[categoryDef.category] === "saving" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Saving...
                      </>
                    ) : (
                      "Save"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="text-center py-8 text-gray-600 dark:text-gray-400">
            <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin opacity-50" />
            <p>Loading settings...</p>
          </div>
        )}

        {error && !isLoading && (
          <div className="text-center py-8 text-red-600 dark:text-red-400">
            <XCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Failed to load settings</p>
            <p className="text-sm mt-2">{error instanceof Error ? error.message : "Unknown error"}</p>
          </div>
        )}

        {!isLoading && !error && definitions.length === 0 && (
          <div className="text-center py-8 text-gray-600 dark:text-gray-400">
            <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No settings configured</p>
          </div>
        )}

        <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 p-4 mt-4">
          <h4 className="font-medium text-blue-900 dark:text-blue-100">About System Settings</h4>
          <ul className="mt-2 space-y-1 text-sm text-blue-800 dark:text-blue-200">
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
              API keys and secrets are encrypted before storing in the database
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
              Settings configured here override any environment variables
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
              Changes take effect immediately (some features may need a page refresh)
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function IptvSettings() {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [serverName, setServerName] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const { data: servers = [], isLoading } = useQuery({
    queryKey: ["iptv-servers"],
    queryFn: () => api.getIptvServers(),
  });

  const addServer = useMutation({
    mutationFn: async (data: { name: string; serverUrl: string; username: string; password: string }) => {
      const server = await api.addIptvServer(data);
      // Auto-sync after adding
      await api.syncIptvServer(server.id);
      return server;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["iptv-servers"] });
      queryClient.invalidateQueries({ queryKey: ["iptv-categories"] });
      queryClient.invalidateQueries({ queryKey: ["iptv-channels"] });
      setShowAddForm(false);
      setServerName("");
      setServerUrl("");
      setUsername("");
      setPassword("");
      setAddError(null);
    },
    onError: (error) => {
      setAddError(error instanceof Error ? error.message : "Failed to add server");
    },
  });

  const deleteServer = useMutation({
    mutationFn: (id: string) => api.deleteIptvServer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["iptv-servers"] });
      queryClient.invalidateQueries({ queryKey: ["iptv-categories"] });
      queryClient.invalidateQueries({ queryKey: ["iptv-channels"] });
    },
  });

  const syncServer = useMutation({
    mutationFn: (id: string) => api.syncIptvServer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["iptv-categories"] });
      queryClient.invalidateQueries({ queryKey: ["iptv-channels"] });
    },
  });

  const handleDeleteServer = (server: { id: string; name: string }) => {
    if (confirm(`Delete IPTV server "${server.name}"? This will remove all associated channels.`)) {
      deleteServer.mutate(server.id);
    }
  };

  const handleAddServer = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    addServer.mutate({ name: serverName, serverUrl, username, password });
  };

  return (
    <Card className="border-2 border-primary/40">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>IPTV Servers</CardTitle>
            <CardDescription>
              Manage your Xtreme Codes IPTV servers
            </CardDescription>
          </div>
          {!showAddForm && (
            <Button size="sm" onClick={() => setShowAddForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Server
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Server Form */}
        {showAddForm && (
          <form onSubmit={handleAddServer} className="space-y-4 rounded-lg border border-border p-4">
            <h4 className="font-medium">Add New IPTV Server</h4>
            {addError && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
                <p className="text-sm text-destructive">{addError}</p>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Server Name</label>
                <input
                  type="text"
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  placeholder="My IPTV Server"
                  required
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Server URL</label>
                <input
                  type="url"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="http://example.com:8080"
                  required
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username"
                  required
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="password"
                  required
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={addServer.isPending}>
                {addServer.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Server"
                )}
              </Button>
            </div>
          </form>
        )}

        {/* Server List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : servers.length === 0 && !showAddForm ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <Tv className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              No IPTV servers configured
            </p>
            <Button size="sm" className="mt-4" onClick={() => setShowAddForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Server
            </Button>
          </div>
        ) : servers.length > 0 ? (
          <div className="space-y-3">
            {servers.map((server) => (
              <div
                key={server.id}
                className="flex items-center justify-between rounded-lg border border-border p-4"
              >
                <div>
                  <p className="font-medium">{server.name}</p>
                  <p className="text-sm text-muted-foreground">{server.serverUrl}</p>
                  <p className="text-xs text-muted-foreground">
                    Username: {server.username}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => syncServer.mutate(server.id)}
                    disabled={syncServer.isPending}
                  >
                    <RefreshCw className={`h-4 w-4 ${syncServer.isPending ? "animate-spin" : ""}`} />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteServer(server)}
                    disabled={deleteServer.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function IptvChannelManager() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "category">("name");

  const { data: categories = [] } = useQuery({
    queryKey: ["iptv-categories"],
    queryFn: () => api.getIptvCategories(),
  });

  const { data: channels = [], isLoading } = useQuery({
    queryKey: ["iptv-channels", selectedCategory, search],
    queryFn: () => api.getIptvChannels({
      categoryId: selectedCategory || undefined,
      search: search || undefined,
    }),
  });

  const { data: favorites = [] } = useQuery({
    queryKey: ["iptv-favorites"],
    queryFn: () => api.getIptvFavorites(),
  });

  const favoriteIds = new Set(favorites.map((f: { id: string }) => f.id));

  const toggleFavorite = useMutation({
    mutationFn: async ({ channelId, isFavorite }: { channelId: string; isFavorite: boolean }) => {
      if (isFavorite) {
        await api.removeIptvFavorite(channelId);
      } else {
        await api.addIptvFavorite(channelId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["iptv-favorites"] });
      queryClient.invalidateQueries({ queryKey: ["iptv-channels"] });
    },
  });

  // Filter and sort channels
  const displayedChannels = useMemo(() => {
    let result = [...channels];

    if (showFavoritesOnly) {
      result = result.filter((ch: { id: string }) => favoriteIds.has(ch.id));
    }

    if (sortBy === "name") {
      result.sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));
    } else if (sortBy === "category") {
      result.sort((a: { categoryName?: string }, b: { categoryName?: string }) =>
        (a.categoryName || "").localeCompare(b.categoryName || "")
      );
    }

    return result.slice(0, 100); // Limit display to 100 channels for performance
  }, [channels, showFavoritesOnly, favoriteIds, sortBy]);

  return (
    <Card className="border-2 border-primary/40">
      <CardHeader>
        <CardTitle>Channel Manager</CardTitle>
        <CardDescription>
          Search, filter, and manage your favorite channels ({favorites.length} favorites)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search channels..."
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          {/* Category filter */}
          <select
            value={selectedCategory || ""}
            onChange={(e) => setSelectedCategory(e.target.value || null)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm min-w-[150px]"
          >
            <option value="">All Categories</option>
            {categories.map((cat: { id: string; name: string; channelCount: number }) => (
              <option key={cat.id} value={cat.id}>
                {cat.name} ({cat.channelCount})
              </option>
            ))}
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "name" | "category")}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="name">Sort by Name</option>
            <option value="category">Sort by Category</option>
          </select>

          {/* Favorites toggle */}
          <Button
            variant={showFavoritesOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className="whitespace-nowrap"
          >
            <Star className={`mr-2 h-4 w-4 ${showFavoritesOnly ? "fill-current" : ""}`} />
            Favorites ({favorites.length})
          </Button>
        </div>

        {/* Results info */}
        <p className="text-sm text-muted-foreground">
          Showing {displayedChannels.length} of {showFavoritesOnly ? favorites.length : channels.length} channels
          {displayedChannels.length === 100 && " (limited to 100)"}
        </p>

        {/* Channel list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : displayedChannels.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <Tv className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              {showFavoritesOnly ? "No favorite channels" : "No channels found"}
            </p>
          </div>
        ) : (
          <div className="max-h-[400px] overflow-y-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Channel</th>
                  <th className="px-3 py-2 text-left font-medium">Category</th>
                  <th className="px-3 py-2 text-center font-medium w-20">Favorite</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {displayedChannels.map((channel: { id: string; name: string; categoryName?: string; logoUrl?: string }) => {
                  const isFav = favoriteIds.has(channel.id);
                  return (
                    <tr key={channel.id} className="hover:bg-muted/50">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          {channel.logoUrl && (
                            <img
                              src={channel.logoUrl}
                              alt=""
                              className="h-6 w-6 rounded object-contain bg-black"
                              onError={(e) => (e.currentTarget.style.display = "none")}
                            />
                          )}
                          <span className="truncate max-w-[250px]">{channel.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        <span className="truncate max-w-[150px] block">{channel.categoryName || "-"}</span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => toggleFavorite.mutate({ channelId: channel.id, isFavorite: isFav })}
                          disabled={toggleFavorite.isPending}
                          className={`p-1 rounded hover:bg-muted ${isFav ? "text-yellow-500" : "text-muted-foreground"}`}
                        >
                          <Star className={`h-4 w-4 ${isFav ? "fill-current" : ""}`} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CamerasSettings() {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCamera, setEditingCamera] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formMjpegUrl, setFormMjpegUrl] = useState("");
  const [formSnapshotUrl, setFormSnapshotUrl] = useState("");
  const [formRtspUrl, setFormRtspUrl] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");

  const { data: cameras = [], isLoading } = useQuery({
    queryKey: ["cameras"],
    queryFn: () => api.getCameras(),
  });

  // Check HA connection and get enabled HA cameras
  const { data: haConfig } = useQuery({
    queryKey: ["homeassistant", "config"],
    queryFn: () => api.getHomeAssistantConfig(),
  });

  const { data: haCameras = [] } = useQuery({
    queryKey: ["ha-cameras"],
    queryFn: () => api.getHomeAssistantCameras(),
    enabled: !!haConfig?.url,
  });

  const haConnected = !!haConfig?.url;

  const createCamera = useMutation({
    mutationFn: (data: {
      name: string;
      mjpegUrl?: string;
      snapshotUrl?: string;
      rtspUrl?: string;
      username?: string;
      password?: string;
    }) => api.createCamera(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cameras"] });
      resetForm();
      setShowAddForm(false);
    },
  });

  const deleteCamera = useMutation({
    mutationFn: (id: string) => api.deleteCamera(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cameras"] });
    },
  });

  const updateCamera = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{
      name: string;
      mjpegUrl: string | null;
      snapshotUrl: string | null;
      rtspUrl: string | null;
      username: string | null;
      password: string | null;
      isEnabled: boolean;
    }> }) => api.updateCamera(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cameras"] });
      resetForm();
      setEditingCamera(null);
    },
  });

  const resetForm = () => {
    setFormName("");
    setFormMjpegUrl("");
    setFormSnapshotUrl("");
    setFormRtspUrl("");
    setFormUsername("");
    setFormPassword("");
  };

  const handleEdit = (camera: Camera) => {
    setEditingCamera(camera.id);
    setFormName(camera.name);
    setFormMjpegUrl(camera.mjpegUrl || "");
    setFormSnapshotUrl(camera.snapshotUrl || "");
    setFormRtspUrl(camera.rtspUrl || "");
    setFormUsername(camera.username || "");
    setFormPassword("");
    setShowAddForm(false);
  };

  const handleSubmitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    createCamera.mutate({
      name: formName.trim(),
      mjpegUrl: formMjpegUrl.trim() || undefined,
      snapshotUrl: formSnapshotUrl.trim() || undefined,
      rtspUrl: formRtspUrl.trim() || undefined,
      username: formUsername.trim() || undefined,
      password: formPassword || undefined,
    });
  };

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCamera || !formName.trim()) return;

    updateCamera.mutate({
      id: editingCamera,
      data: {
        name: formName.trim(),
        mjpegUrl: formMjpegUrl.trim() || null,
        snapshotUrl: formSnapshotUrl.trim() || null,
        rtspUrl: formRtspUrl.trim() || null,
        username: formUsername.trim() || null,
        password: formPassword || undefined, // Only update if provided
      },
    });
  };

  const handleDeleteCamera = (camera: { id: string; name: string }) => {
    if (confirm(`Delete camera "${camera.name}"?`)) {
      deleteCamera.mutate(camera.id);
    }
  };

  const handleCancelForm = () => {
    resetForm();
    setShowAddForm(false);
    setEditingCamera(null);
  };

  const renderForm = (isEdit: boolean) => (
    <form onSubmit={isEdit ? handleSubmitEdit : handleSubmitAdd} className="space-y-4 rounded-lg border border-border p-4 bg-muted/30">
      <h4 className="font-medium">{isEdit ? "Edit Camera" : "Add New Camera"}</h4>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="text-sm font-medium">Camera Name *</label>
          <input
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="e.g., Front Door, Backyard"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            required
          />
        </div>

        <div className="sm:col-span-2">
          <label className="text-sm font-medium">MJPEG Stream URL</label>
          <input
            type="url"
            value={formMjpegUrl}
            onChange={(e) => setFormMjpegUrl(e.target.value)}
            placeholder="http://camera-ip/mjpeg/stream"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-muted-foreground">Live video stream (recommended for browser viewing)</p>
        </div>

        <div className="sm:col-span-2">
          <label className="text-sm font-medium">Snapshot URL</label>
          <input
            type="url"
            value={formSnapshotUrl}
            onChange={(e) => setFormSnapshotUrl(e.target.value)}
            placeholder="http://camera-ip/snapshot.jpg"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-muted-foreground">Static image URL (refreshed periodically)</p>
        </div>

        <div className="sm:col-span-2">
          <label className="text-sm font-medium">RTSP URL</label>
          <input
            type="text"
            value={formRtspUrl}
            onChange={(e) => setFormRtspUrl(e.target.value)}
            placeholder="rtsp://camera-ip:554/stream"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-muted-foreground">For future use with RTSP proxy</p>
        </div>

        <div>
          <label className="text-sm font-medium">Username</label>
          <input
            type="text"
            value={formUsername}
            onChange={(e) => setFormUsername(e.target.value)}
            placeholder="Camera username"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Password</label>
          <input
            type="password"
            value={formPassword}
            onChange={(e) => setFormPassword(e.target.value)}
            placeholder={isEdit ? "Leave blank to keep current" : "Camera password"}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={createCamera.isPending || updateCamera.isPending}>
          {(createCamera.isPending || updateCamera.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEdit ? "Save Changes" : "Add Camera"}
        </Button>
        <Button type="button" variant="outline" onClick={handleCancelForm}>
          Cancel
        </Button>
      </div>
    </form>
  );

  return (
    <>
      <Card className="border-2 border-primary/40">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>IP Cameras</CardTitle>
              <CardDescription>
                Configure and manage your IP cameras
              </CardDescription>
            </div>
          {!showAddForm && !editingCamera && (
            <Button onClick={() => setShowAddForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Camera
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showAddForm && renderForm(false)}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : cameras.length === 0 && !showAddForm ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <Video className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              No cameras configured
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Camera
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {cameras.map((camera) => (
              <div key={camera.id}>
                {editingCamera === camera.id ? (
                  renderForm(true)
                ) : (
                  <div className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-3 w-3 rounded-full ${
                          camera.isEnabled ? "bg-green-500" : "bg-muted"
                        }`}
                      />
                      <div>
                        <p className="font-medium">{camera.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {camera.mjpegUrl || camera.snapshotUrl || camera.rtspUrl || "No URL configured"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={camera.isEnabled}
                          onChange={(e) =>
                            updateCamera.mutate({
                              id: camera.id,
                              data: { isEnabled: e.target.checked },
                            })
                          }
                          className="rounded"
                        />
                        Enabled
                      </label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(camera)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteCamera(camera)}
                        disabled={deleteCamera.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>

      {/* Home Assistant Cameras (read-only reference) */}
      {haConnected && (
        <Card className="border-2 border-primary/40">
          <CardHeader>
            <CardTitle>Home Assistant Cameras</CardTitle>
            <CardDescription>
              Cameras from your Home Assistant instance
            </CardDescription>
          </CardHeader>
          <CardContent>
            {haCameras.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center">
                <Home className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No Home Assistant cameras configured
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => window.location.href = "/settings?tab=homeassistant"}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Cameras in Home Assistant Settings
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {haCameras.length} camera{haCameras.length !== 1 ? "s" : ""} configured via Home Assistant
                </p>
                <div className="space-y-2">
                  {haCameras.map((camera) => (
                    <div
                      key={camera.entityId}
                      className="flex items-center gap-3 rounded-lg border border-border p-3 bg-muted/30"
                    >
                      <Home className="h-4 w-4 text-blue-500" />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{camera.name}</p>
                        <p className="text-xs text-muted-foreground">{camera.entityId}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {camera.refreshInterval}s • {camera.aspectRatio}
                      </span>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.href = "/settings?tab=homeassistant"}
                >
                  Manage in Home Assistant Settings
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}

type HandwritingProvider = "tesseract" | "gemini" | "openai" | "claude" | "google_vision";

const HANDWRITING_PROVIDERS: { value: HandwritingProvider; label: string; description: string; price: string }[] = [
  { value: "tesseract", label: "Tesseract (Local)", description: "Free, works offline. Best for clear handwriting.", price: "Free" },
  { value: "gemini", label: "Google Gemini", description: "Recommended - Best value with excellent accuracy.", price: "~$0.001/image" },
  { value: "openai", label: "OpenAI GPT-4o", description: "Great for complex text and context understanding.", price: "~$0.01-0.03/image" },
  { value: "claude", label: "Anthropic Claude", description: "Good accuracy with strong context understanding.", price: "~$0.01-0.02/image" },
  { value: "google_vision", label: "Google Cloud Vision", description: "Best pure OCR accuracy for document-style text.", price: "~$0.0015/image" },
];

function HandwritingSettings() {
  const queryClient = useQueryClient();
  const [selectedProvider, setSelectedProvider] = useState<HandwritingProvider>("tesseract");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // Fetch current settings
  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["system-settings"],
    queryFn: () => api.getAllSettings(),
  });

  // Initialize selected provider from settings
  useEffect(() => {
    const providerSetting = settings.find((s) => s.category === "handwriting" && s.key === "provider");
    if (providerSetting?.value) {
      setSelectedProvider(providerSetting.value as HandwritingProvider);
    }
  }, [settings]);

  const saveSettings = useMutation({
    mutationFn: async () => {
      await api.updateCategorySettings("handwriting", { provider: selectedProvider });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
      queryClient.invalidateQueries({ queryKey: ["handwriting-provider"] });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    },
    onError: () => {
      setSaveStatus("error");
    },
  });

  const selectedProviderInfo = HANDWRITING_PROVIDERS.find((p) => p.value === selectedProvider);

  return (
    <Card className="border-2 border-primary/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Pencil className="h-5 w-5" />
          Handwriting Recognition
        </CardTitle>
        <CardDescription>
          Configure how handwritten text is recognized. Choose between free local processing or AI providers for better accuracy.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Provider Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                Recognition Provider
              </label>
              <select
                value={selectedProvider}
                onChange={(e) => {
                  setSelectedProvider(e.target.value as HandwritingProvider);
                  setSaveStatus("idle");
                }}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-gray-100 focus:border-primary focus:outline-none"
              >
                {HANDWRITING_PROVIDERS.map((provider) => (
                  <option key={provider.value} value={provider.value}>
                    {provider.label} ({provider.price})
                  </option>
                ))}
              </select>
            </div>

            {/* Provider Info Box */}
            {selectedProviderInfo && (
              <div className={`rounded-lg border p-4 ${
                selectedProvider === "tesseract"
                  ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950"
                  : selectedProvider === "gemini"
                  ? "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950"
                  : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    selectedProvider === "tesseract"
                      ? "bg-green-600/20"
                      : selectedProvider === "gemini"
                      ? "bg-blue-600/20"
                      : "bg-gray-600/20"
                  }`}>
                    <Pencil className={`h-4 w-4 ${
                      selectedProvider === "tesseract"
                        ? "text-green-700 dark:text-green-400"
                        : selectedProvider === "gemini"
                        ? "text-blue-700 dark:text-blue-400"
                        : "text-gray-700 dark:text-gray-400"
                    }`} />
                  </div>
                  <div>
                    <p className={`font-medium ${
                      selectedProvider === "tesseract"
                        ? "text-green-900 dark:text-green-100"
                        : selectedProvider === "gemini"
                        ? "text-blue-900 dark:text-blue-100"
                        : "text-gray-900 dark:text-gray-100"
                    }`}>
                      {selectedProviderInfo.label}
                    </p>
                    <p className={`text-sm ${
                      selectedProvider === "tesseract"
                        ? "text-green-700 dark:text-green-300"
                        : selectedProvider === "gemini"
                        ? "text-blue-700 dark:text-blue-300"
                        : "text-gray-600 dark:text-gray-400"
                    }`}>
                      {selectedProviderInfo.description}
                    </p>
                    <p className={`text-xs mt-1 ${
                      selectedProvider === "tesseract"
                        ? "text-green-600 dark:text-green-400"
                        : selectedProvider === "gemini"
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-gray-500 dark:text-gray-500"
                    }`}>
                      Cost: {selectedProviderInfo.price}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Note about API Keys */}
            {selectedProvider !== "tesseract" && (
              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 p-3">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Configure your API key in the <strong>API Keys</strong> section on the right.
                </p>
              </div>
            )}

            {/* Save Button */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="text-sm">
                {saveStatus === "saved" && (
                  <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                    <CheckCircle className="h-4 w-4" />
                    Settings saved
                  </span>
                )}
                {saveStatus === "error" && (
                  <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
                    <XCircle className="h-4 w-4" />
                    Error saving
                  </span>
                )}
              </div>
              <Button
                onClick={() => saveSettings.mutate()}
                disabled={saveStatus === "saving"}
              >
                {saveStatus === "saving" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  "Save Settings"
                )}
              </Button>
            </div>

            {/* Info Box */}
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">About Handwriting Recognition</h4>
              <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400 mb-4">
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-gray-400" />
                  <strong>Tesseract:</strong> Runs entirely in your browser, no API key needed
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-gray-400" />
                  <strong>AI Providers:</strong> Send handwriting images to cloud for recognition
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-gray-400" />
                  <strong>Fallback:</strong> If AI fails, automatically falls back to Tesseract
                </li>
              </ul>

              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Provider Comparison</h4>
              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-green-500" />
                  <div>
                    <strong>Tesseract (Local)</strong> — Free, offline, good for clear handwriting. No data leaves your device.
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <div>
                    <strong>Google Gemini</strong> — Best value (~$0.001/image). Excellent accuracy, fast responses. Recommended for most users.
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-purple-500" />
                  <div>
                    <strong>OpenAI GPT-4o</strong> — Premium (~$0.01-0.03/image). Great for messy handwriting and complex context.
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-orange-500" />
                  <div>
                    <strong>Anthropic Claude</strong> — Premium (~$0.01-0.02/image). Strong reasoning, good with unclear text.
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-red-500" />
                  <div>
                    <strong>Google Cloud Vision</strong> — Low cost (~$0.0015/image). Pure OCR, best for printed or document-style text.
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AIProviderKeys() {
  const queryClient = useQueryClient();
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, "idle" | "saving" | "saved" | "error">>({});
  const [testStatus, setTestStatus] = useState<Record<string, "idle" | "testing" | "success" | "error">>({});
  const [testErrors, setTestErrors] = useState<Record<string, string>>({});

  const providers = [
    { id: "openai", name: "OpenAI", keyName: "openai_api_key", placeholder: "sk-...", color: "purple", testName: "openai", link: "https://platform.openai.com/api-keys" },
    { id: "anthropic", name: "Anthropic", keyName: "anthropic_api_key", placeholder: "sk-ant-...", color: "orange", testName: "claude", link: "https://console.anthropic.com/settings/keys" },
    { id: "gemini", name: "Google Gemini", keyName: "gemini_api_key", placeholder: "AIza...", color: "blue", testName: "gemini", link: "https://aistudio.google.com/app/apikey" },
    { id: "google_vision", name: "Google Cloud Vision", keyName: "google_vision_api_key", placeholder: "AIza...", color: "red", testName: "google_vision", link: "https://console.cloud.google.com/apis/credentials" },
  ];

  // Fetch current settings
  const { data: settings = [] } = useQuery({
    queryKey: ["system-settings"],
    queryFn: () => api.getAllSettings(),
  });

  const getSettingValue = (keyName: string): string => {
    if (formValues[keyName] !== undefined) {
      return formValues[keyName];
    }
    const setting = settings.find((s) => s.category === "handwriting" && s.key === keyName);
    return setting?.value || "";
  };

  const handleInputChange = (keyName: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [keyName]: value }));
    setSaveStatus((prev) => ({ ...prev, [keyName]: "idle" }));
  };

  const saveKey = useMutation({
    mutationFn: async (keyName: string) => {
      const value = formValues[keyName];
      if (value === "••••••••") return;
      await api.updateCategorySettings("handwriting", { [keyName]: value || null });
    },
    onSuccess: (_, keyName) => {
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
      queryClient.invalidateQueries({ queryKey: ["handwriting-provider"] });
      setSaveStatus((prev) => ({ ...prev, [keyName]: "saved" }));
      setFormValues((prev) => {
        const newValues = { ...prev };
        delete newValues[keyName];
        return newValues;
      });
      setTimeout(() => setSaveStatus((prev) => ({ ...prev, [keyName]: "idle" })), 2000);
    },
    onError: (_, keyName) => {
      setSaveStatus((prev) => ({ ...prev, [keyName]: "error" }));
    },
  });

  const handleTest = async (provider: typeof providers[0]) => {
    setTestStatus((prev) => ({ ...prev, [provider.id]: "testing" }));
    setTestErrors((prev) => ({ ...prev, [provider.id]: "" }));

    try {
      await api.testHandwritingProvider(provider.testName);
      setTestStatus((prev) => ({ ...prev, [provider.id]: "success" }));
      setTimeout(() => setTestStatus((prev) => ({ ...prev, [provider.id]: "idle" })), 3000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Connection failed";
      setTestErrors((prev) => ({ ...prev, [provider.id]: errorMessage }));
      setTestStatus((prev) => ({ ...prev, [provider.id]: "error" }));
      setTimeout(() => {
        setTestStatus((prev) => ({ ...prev, [provider.id]: "idle" }));
        setTestErrors((prev) => ({ ...prev, [provider.id]: "" }));
      }, 5000);
    }
  };

  const getColorClasses = (color: string) => {
    switch (color) {
      case "purple": return { dot: "bg-purple-500", border: "border-purple-200 dark:border-purple-800", bg: "bg-purple-50 dark:bg-purple-950" };
      case "orange": return { dot: "bg-orange-500", border: "border-orange-200 dark:border-orange-800", bg: "bg-orange-50 dark:bg-orange-950" };
      case "blue": return { dot: "bg-blue-500", border: "border-blue-200 dark:border-blue-800", bg: "bg-blue-50 dark:bg-blue-950" };
      case "red": return { dot: "bg-red-500", border: "border-red-200 dark:border-red-800", bg: "bg-red-50 dark:bg-red-950" };
      default: return { dot: "bg-gray-500", border: "border-gray-200 dark:border-gray-700", bg: "bg-gray-50 dark:bg-gray-800" };
    }
  };

  return (
    <Card className="h-fit border-2 border-primary/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          API Keys
        </CardTitle>
        <CardDescription>
          Manage API keys for each AI provider
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {providers.map((provider) => {
          const colors = getColorClasses(provider.color);
          const currentValue = getSettingValue(provider.keyName);
          const isConfigured = currentValue && currentValue !== "" && currentValue !== "••••••••";
          const providerSaveStatus = saveStatus[provider.keyName] || "idle";
          const providerTestStatus = testStatus[provider.id] || "idle";
          const providerTestError = testErrors[provider.id] || "";

          return (
            <div
              key={provider.id}
              className={`rounded-lg border ${colors.border} ${colors.bg} p-3 space-y-2`}
            >
              {/* Provider Header with Actions */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${colors.dot}`} />
                  <span className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">{provider.name}</span>
                  <a
                    href={provider.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 flex-shrink-0"
                  >
                    Get key
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {providerTestStatus === "success" && (
                    <span className="text-xs text-green-600 dark:text-green-400">Connected</span>
                  )}
                  {providerTestStatus === "error" && (
                    <span className="text-xs text-red-600 dark:text-red-400 truncate max-w-[150px]" title={providerTestError}>
                      {providerTestError || "Failed"}
                    </span>
                  )}
                  {providerSaveStatus === "saved" && (
                    <span className="text-xs text-green-600 dark:text-green-400">Saved</span>
                  )}
                  {isConfigured && !providerSaveStatus.match(/saved/) && !providerTestStatus.match(/success|error/) && (
                    <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                  )}
                  <button
                    onClick={() => handleTest(provider)}
                    disabled={providerTestStatus === "testing" || !currentValue}
                    className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {providerTestStatus === "testing" ? "..." : "Test"}
                  </button>
                  <button
                    onClick={() => {
                      setSaveStatus((prev) => ({ ...prev, [provider.keyName]: "saving" }));
                      saveKey.mutate(provider.keyName);
                    }}
                    disabled={providerSaveStatus === "saving" || formValues[provider.keyName] === undefined}
                    className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {providerSaveStatus === "saving" ? "..." : "Save"}
                  </button>
                </div>
              </div>

              {/* API Key Input */}
              <input
                type="password"
                value={formValues[provider.keyName] ?? currentValue}
                onChange={(e) => handleInputChange(provider.keyName, e.target.value)}
                placeholder={provider.placeholder}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-primary focus:outline-none"
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function AISettings() {
  return (
    <div className="space-y-6">
      {/* AI Settings Header - Full Width */}
      <Card className="border-2 border-primary/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Features
          </CardTitle>
          <CardDescription>
            Configure AI-powered features. You can use different providers for different features, or share API keys across features.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 p-4">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">About AI Integration</h4>
            <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
                API keys are encrypted and stored securely in the database
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
                Each feature can be configured to use a different provider
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
                Local/free options are available when you want to avoid API costs
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Three Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Column 1 - Handwriting Recognition */}
        <HandwritingSettings />

        {/* Column 2 - Placeholder for future AI features */}
        <Card className="border-dashed h-fit border-2 border-primary/40">
          <CardHeader>
            <CardTitle className="text-muted-foreground">More AI Features Coming Soon</CardTitle>
            <CardDescription>
              Future AI-powered features will appear here, such as:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                Smart event suggestions from natural language
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                Photo captioning and search
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                Voice command processing
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Column 3 - API Keys Management */}
        <AIProviderKeys />
      </div>
    </div>
  );
}

// Helper functions for automation display
function formatTriggerSummary(triggerType: AutomationTriggerType, config: TimeTriggerConfig | StateTriggerConfig | DurationTriggerConfig): string {
  if (triggerType === "time") {
    const timeConfig = config as TimeTriggerConfig;
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const days = timeConfig.days?.map((d) => dayNames[d]).join(", ") || "Every day";
    return `${timeConfig.time} (${days})`;
  }
  if (triggerType === "state") {
    const stateConfig = config as StateTriggerConfig;
    const entityName = stateConfig.entityId.split(".")[1]?.replace(/_/g, " ") || stateConfig.entityId;
    return `${entityName}: ${stateConfig.fromState || "*"} → ${stateConfig.toState}`;
  }
  if (triggerType === "duration") {
    const durationConfig = config as DurationTriggerConfig;
    const entityName = durationConfig.entityId.split(".")[1]?.replace(/_/g, " ") || durationConfig.entityId;
    return `${entityName} ${durationConfig.targetState} for ${durationConfig.durationMinutes}min`;
  }
  return "Unknown trigger";
}

function formatActionSummary(actionType: AutomationActionType, config: ServiceCallActionConfig | NotificationActionConfig): string {
  if (actionType === "service_call") {
    const serviceConfig = config as ServiceCallActionConfig;
    const entityName = serviceConfig.entityId.split(".")[1]?.replace(/_/g, " ") || serviceConfig.entityId;
    return `${serviceConfig.service.replace(/_/g, " ")} ${entityName}`;
  }
  if (actionType === "notification") {
    const notifConfig = config as NotificationActionConfig;
    return notifConfig.title;
  }
  return "Unknown action";
}

function getTriggerIcon(triggerType: AutomationTriggerType) {
  switch (triggerType) {
    case "time": return <Clock className="h-3 w-3" />;
    case "state": return <Power className="h-3 w-3" />;
    case "duration": return <Clock className="h-3 w-3" />;
    default: return <Zap className="h-3 w-3" />;
  }
}

function getActionIcon(actionType: AutomationActionType) {
  switch (actionType) {
    case "service_call": return <Power className="h-3 w-3" />;
    case "notification": return <Bell className="h-3 w-3" />;
    default: return <Zap className="h-3 w-3" />;
  }
}

function AutomationsSettings() {
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [parseResult, setParseResult] = useState<AutomationParseResult | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAutomationId, setEditAutomationId] = useState<string | null>(null);

  // Fetch automations
  const { data: automations = [], isLoading } = useQuery({
    queryKey: ["automations"],
    queryFn: () => api.getAutomations(),
  });

  // Check if HA is configured
  const { data: haConfig } = useQuery({
    queryKey: ["homeassistant", "config"],
    queryFn: () => api.getHomeAssistantConfig(),
  });

  const isHaConfigured = !!(haConfig && haConfig.url);

  // Parse mutation
  const parseMutation = useMutation({
    mutationFn: (prompt: string) => api.parseAutomation(prompt),
    onSuccess: (result) => {
      setParseResult(result);
      setEditName(result.name);
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof api.createAutomation>[0]) => api.createAutomation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
      setParseResult(null);
      setPrompt("");
      setEditName("");
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof api.updateAutomation>[1] }) =>
      api.updateAutomation(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAutomation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations"] });
    },
  });

  // Test mutation
  const testMutation = useMutation({
    mutationFn: (id: string) => api.testAutomation(id),
  });

  const handleParse = () => {
    if (!prompt.trim()) return;
    parseMutation.mutate(prompt);
  };

  const handleCreate = () => {
    if (!parseResult) return;
    createMutation.mutate({
      name: editName || parseResult.name,
      description: prompt,
      triggerType: parseResult.trigger.type,
      triggerConfig: parseResult.trigger.config,
      actionType: parseResult.action.type,
      actionConfig: parseResult.action.config,
    });
  };

  const handleCancel = () => {
    setParseResult(null);
    setPrompt("");
    setEditName("");
  };

  const handleToggleEnabled = (automation: Automation) => {
    updateMutation.mutate({
      id: automation.id,
      data: { enabled: !automation.enabled },
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this automation?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleTest = (id: string) => {
    testMutation.mutate(id);
  };

  if (!isHaConfigured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            AI Automations
          </CardTitle>
          <CardDescription>
            Create smart home automations using natural language
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950 p-4">
            <p className="text-yellow-800 dark:text-yellow-200">
              Please configure Home Assistant first to use automations.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Create Automation Card */}
      <Card className="border-2 border-primary/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Create Automation
          </CardTitle>
          <CardDescription>
            Describe what you want to automate in plain English
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Natural Language Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleParse()}
              placeholder='e.g., "Turn on kitchen lights at 7am on weekdays" or "Notify me when the garage is open for 30 minutes"'
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={parseMutation.isPending}
            />
            <Button
              onClick={handleParse}
              disabled={!prompt.trim() || parseMutation.isPending}
            >
              {parseMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              <span className="ml-2">Parse</span>
            </Button>
          </div>

          {/* Parse Error */}
          {parseMutation.isError && (
            <div className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950 p-3">
              <p className="text-sm text-red-600 dark:text-red-400">
                {parseMutation.error instanceof Error ? parseMutation.error.message : "Failed to parse automation"}
              </p>
            </div>
          )}

          {/* Parse Result Preview */}
          {parseResult && (
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Preview</h4>
                <span className="text-xs text-muted-foreground">
                  Confidence: {Math.round(parseResult.confidence * 100)}%
                </span>
              </div>

              {/* Editable Name */}
              <div>
                <label className="text-sm text-muted-foreground">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>

              {/* Trigger & Action Display */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2 text-sm font-medium mb-2">
                    {getTriggerIcon(parseResult.trigger.type)}
                    <span>Trigger</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatTriggerSummary(parseResult.trigger.type, parseResult.trigger.config as TimeTriggerConfig | StateTriggerConfig | DurationTriggerConfig)}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2 text-sm font-medium mb-2">
                    {getActionIcon(parseResult.action.type)}
                    <span>Action</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatActionSummary(parseResult.action.type, parseResult.action.config as ServiceCallActionConfig | NotificationActionConfig)}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Save Automation
                </Button>
              </div>
            </div>
          )}

          {/* Example Prompts */}
          <div className="rounded-lg border border-border p-3">
            <h4 className="text-sm font-medium mb-2">Example prompts:</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>"Turn on the living room lights at sunset"</li>
              <li>"Notify me when the washer finishes"</li>
              <li>"Lock the front door at 10pm every day"</li>
              <li>"Alert me if the garage door is open for 30 minutes"</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Automations List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Your Automations
          </CardTitle>
          <CardDescription>
            {automations.length} automation{automations.length !== 1 ? "s" : ""} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : automations.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              No automations yet. Create one above!
            </p>
          ) : (
            <div className="space-y-3">
              {automations.map((automation) => (
                <div
                  key={automation.id}
                  className={`rounded-lg border p-4 ${
                    automation.enabled
                      ? "border-border"
                      : "border-border/50 bg-muted/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className={`font-medium ${!automation.enabled ? "text-muted-foreground" : ""}`}>
                          {automation.name}
                        </h4>
                        {!automation.enabled && (
                          <span className="text-xs text-muted-foreground">(disabled)</span>
                        )}
                      </div>
                      {automation.description && (
                        <p className="text-sm text-muted-foreground mt-1 truncate">
                          "{automation.description}"
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="inline-flex items-center gap-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                          {getTriggerIcon(automation.triggerType as AutomationTriggerType)}
                          {formatTriggerSummary(
                            automation.triggerType as AutomationTriggerType,
                            automation.triggerConfig as TimeTriggerConfig | StateTriggerConfig | DurationTriggerConfig
                          )}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 px-2 py-1 rounded">
                          {getActionIcon(automation.actionType as AutomationActionType)}
                          {formatActionSummary(
                            automation.actionType as AutomationActionType,
                            automation.actionConfig as ServiceCallActionConfig | NotificationActionConfig
                          )}
                        </span>
                      </div>
                      {automation.lastTriggeredAt && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Last triggered: {new Date(automation.lastTriggeredAt).toLocaleString()}
                          {automation.triggerCount > 0 && ` (${automation.triggerCount} times)`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleTest(automation.id)}
                        disabled={testMutation.isPending}
                        className="p-2 rounded hover:bg-muted transition-colors"
                        title="Test Run"
                      >
                        <Play className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleToggleEnabled(automation)}
                        className="p-2 rounded hover:bg-muted transition-colors"
                        title={automation.enabled ? "Disable" : "Enable"}
                      >
                        {automation.enabled ? (
                          <ToggleRight className="h-5 w-5 text-primary" />
                        ) : (
                          <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(automation.id)}
                        disabled={deleteMutation.isPending}
                        className="p-2 rounded hover:bg-red-100 dark:hover:bg-red-900 text-red-600 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function HomeAssistantSettings() {
  const queryClient = useQueryClient();
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [showEntityPicker, setShowEntityPicker] = useState(false);
  const [showCameraPicker, setShowCameraPicker] = useState(false);
  const [editingCamera, setEditingCamera] = useState<string | null>(null);
  const [editingEntity, setEditingEntity] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [accessToken, setAccessToken] = useState("");
  // Room management state
  const [newRoomName, setNewRoomName] = useState("");
  const [editingRoom, setEditingRoom] = useState<HomeAssistantRoom | null>(null);
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null);

  const { data: config, isLoading } = useQuery({
    queryKey: ["homeassistant", "config"],
    queryFn: () => api.getHomeAssistantConfig(),
  });

  const isConnected = !!(config && config.url);

  const { data: entities = [] } = useQuery({
    queryKey: ["homeassistant", "entities"],
    queryFn: () => api.getHomeAssistantEntities(),
    enabled: isConnected,
  });

  // Fetch all HA states for entity picker
  const { data: allStates = [], isLoading: isLoadingStates } = useQuery({
    queryKey: ["homeassistant", "states"],
    queryFn: () => api.getHomeAssistantStates(),
    enabled: isConnected && showEntityPicker,
  });

  // Fetch enabled HA cameras (stored in entities table with camera.* prefix)
  const enabledCameras = entities.filter((e) => e.entityId.startsWith("camera."));

  // Fetch available HA cameras for picker
  const { data: availableCameras = [], isLoading: isLoadingCameras } = useQuery({
    queryKey: ["homeassistant", "cameras", "available"],
    queryFn: () => api.getHomeAssistantAvailableCameras(),
    enabled: isConnected && showCameraPicker,
  });

  // Auto-discover Home Assistant instances when not connected
  const { data: discovered = [], isLoading: isDiscovering } = useQuery({
    queryKey: ["homeassistant", "discover"],
    queryFn: () => api.discoverHomeAssistant(),
    enabled: !isConnected, // Only scan when not connected
    staleTime: 60000, // Cache for 1 minute
  });

  // Fetch rooms for room management
  const { data: rooms = [] } = useQuery({
    queryKey: ["homeassistant", "rooms"],
    queryFn: () => api.getHomeAssistantRooms(),
    enabled: isConnected,
  });

  // Fetch all HA states for room sensor configuration (need these for room management)
  const { data: allStatesForRooms = [] } = useQuery({
    queryKey: ["homeassistant", "states", "for-rooms"],
    queryFn: () => api.getHomeAssistantStates(),
    enabled: isConnected && expandedRoomId !== null,
  });

  const saveConfig = useMutation({
    mutationFn: (data: { url: string; accessToken: string }) =>
      api.saveHomeAssistantConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homeassistant"] });
      setShowConfigForm(false);
      setUrl("");
      setAccessToken("");
    },
  });

  const deleteConfig = useMutation({
    mutationFn: () => api.deleteHomeAssistantConfig(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homeassistant"] });
    },
  });

  const addEntity = useMutation({
    mutationFn: (data: {
      entityId: string;
      displayName?: string;
      showInDashboard?: boolean;
      settings?: { refreshInterval?: number; aspectRatio?: "16:9" | "4:3" | "1:1" };
    }) => api.addHomeAssistantEntity(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homeassistant", "entities"] });
    },
  });

  const removeEntity = useMutation({
    mutationFn: (id: string) => api.removeHomeAssistantEntity(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homeassistant", "entities"] });
    },
  });

  // Room mutations
  const createRoom = useMutation({
    mutationFn: (data: { name: string; temperatureSensorId?: string; humiditySensorId?: string; windowSensorId?: string }) =>
      api.createHomeAssistantRoom(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homeassistant", "rooms"] });
    },
  });

  const updateRoom = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<HomeAssistantRoom> }) =>
      api.updateHomeAssistantRoom(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homeassistant", "rooms"] });
    },
  });

  const deleteRoom = useMutation({
    mutationFn: (id: string) => api.deleteHomeAssistantRoom(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homeassistant", "rooms"] });
      queryClient.invalidateQueries({ queryKey: ["homeassistant", "entities"] });
    },
  });

  const assignEntityToRoom = useMutation({
    mutationFn: ({ entityId, roomId }: { entityId: string; roomId: string | null }) =>
      api.assignEntityToRoom(entityId, roomId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homeassistant", "entities"] });
    },
  });

  const handleAddEntity = async (entityId: string) => {
    await addEntity.mutateAsync({ entityId });
  };

  const handleAddCamera = async (entityId: string, displayName?: string) => {
    await addEntity.mutateAsync({
      entityId,
      displayName,
      settings: { refreshInterval: 5, aspectRatio: "16:9" as const },
    });
    setShowCameraPicker(false);
    queryClient.invalidateQueries({ queryKey: ["ha-cameras"] });
  };

  const updateCameraSettings = useMutation({
    mutationFn: ({
      id,
      displayName,
      settings,
    }: {
      id: string;
      displayName?: string | null;
      settings?: { refreshInterval?: number; aspectRatio?: "16:9" | "4:3" | "1:1" };
    }) =>
      api.updateHomeAssistantEntity(id, { displayName, settings }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homeassistant", "entities"] });
      queryClient.invalidateQueries({ queryKey: ["ha-cameras"] });
      setEditingCamera(null);
    },
  });

  const updateEntitySettings = useMutation({
    mutationFn: ({
      id,
      settings,
    }: {
      id: string;
      settings: {
        durationAlert?: {
          enabled: boolean;
          thresholdMinutes: number;
          repeatIntervalMinutes?: number;
        };
      };
    }) =>
      api.updateHomeAssistantEntity(id, { settings }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homeassistant", "entities"] });
      setEditingEntity(null);
    },
  });

  const handleRemoveCamera = (entity: { id: string; entityId: string }) => {
    if (confirm(`Remove camera "${entity.entityId}"?`)) {
      removeEntity.mutate(entity.id);
      queryClient.invalidateQueries({ queryKey: ["ha-cameras"] });
    }
  };

  const selectedEntityIds = new Set(entities.map((e) => e.entityId));

  const handleDisconnect = () => {
    if (confirm("Disconnect from Home Assistant? This will remove all configured entities.")) {
      deleteConfig.mutate();
    }
  };

  const handleRemoveEntity = (entity: { id: string; entityId: string }) => {
    if (confirm(`Remove entity "${entity.entityId}"?`)) {
      removeEntity.mutate(entity.id);
    }
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (url && accessToken) {
      saveConfig.mutate({ url, accessToken });
    }
  };

  const handleSelectDiscovered = (discoveredUrl: string) => {
    setUrl(discoveredUrl);
    setShowConfigForm(true);
  };

  // Room handlers
  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;
    await createRoom.mutateAsync({ name: newRoomName.trim() });
    setNewRoomName("");
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (confirm("Are you sure you want to delete this room? Entities will be moved to 'All Devices'.")) {
      await deleteRoom.mutateAsync(roomId);
    }
  };

  // Get available sensors from entity states for room configuration
  const temperatureSensors = allStatesForRooms.filter(
    (s) => s.entity_id.startsWith("sensor.") &&
    (s.attributes.device_class === "temperature" ||
     s.attributes.unit_of_measurement === "°C" ||
     s.attributes.unit_of_measurement === "°F")
  );

  const humiditySensors = allStatesForRooms.filter(
    (s) => s.entity_id.startsWith("sensor.") &&
    (s.attributes.device_class === "humidity" ||
     s.attributes.unit_of_measurement === "%")
  );

  const binarySensors = allStatesForRooms.filter(
    (s) => s.entity_id.startsWith("binary_sensor.") &&
    (s.attributes.device_class === "window" ||
     s.attributes.device_class === "door" ||
     s.attributes.device_class === "opening")
  );

  // Get entities for a room
  const getEntitiesForRoom = (roomId: string | null) => {
    return entities.filter((e) => e.roomId === roomId);
  };

  // Get entity name from state
  const getEntityName = (entityId: string) => {
    const state = allStatesForRooms.find(s => s.entity_id === entityId);
    return state?.attributes.friendly_name as string || entityId;
  };

  return (
    <>
      <Card className="border-2 border-primary/40">
        <CardHeader>
          <CardTitle>Home Assistant Connection</CardTitle>
          <CardDescription>
            Connect to your Home Assistant instance to control smart home devices
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : config && config.url ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border-2 border-green-600 bg-green-100 dark:bg-green-950 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-600/20 dark:bg-green-500/20">
                    <Home className="h-5 w-5 text-green-700 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium text-green-800 dark:text-green-200">Connected</p>
                    <p className="text-sm text-green-700 dark:text-green-400">{config.url}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600"
                    onClick={() => {
                      setUrl(config.url);
                      setShowConfigForm(true);
                    }}
                  >
                    Update
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                    onClick={handleDisconnect}
                    disabled={deleteConfig.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>

              {showConfigForm && (
                <form onSubmit={handleSaveConfig} className="space-y-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 p-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-900 dark:text-gray-100">Home Assistant URL</label>
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="http://homeassistant.local:8123"
                      required
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-900 dark:text-gray-100">Long-Lived Access Token</label>
                    <input
                      type="password"
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      placeholder="Enter new token to update"
                      required
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-mono text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:border-primary focus:outline-none"
                    />
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Create a new token at{" "}
                      <a
                        href={`${url || config?.url}/profile/security`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {(url || config?.url || "").replace(/^https?:\/\//, "")}/profile/security
                      </a>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600" onClick={() => setShowConfigForm(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saveConfig.isPending}>
                      {saveConfig.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Save"
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 p-6 text-center bg-gray-50 dark:bg-gray-800/50">
                <Home className="mx-auto h-8 w-8 text-gray-400 dark:text-gray-500" />
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Not connected to Home Assistant
                </p>

                {/* Auto-discovery results */}
                {isDiscovering && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Scanning network for Home Assistant...
                  </div>
                )}

                {!isDiscovering && discovered.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-green-600 dark:text-green-400 font-medium mb-2">
                      Found {discovered.length} instance{discovered.length > 1 ? "s" : ""} on your network:
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {discovered.map((d) => (
                        <button
                          key={d.url}
                          onClick={() => handleSelectDiscovered(d.url)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800 border border-green-300 dark:border-green-700 transition-colors"
                        >
                          <Home className="h-3.5 w-3.5" />
                          {d.url.replace("http://", "")}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {!isDiscovering && discovered.length === 0 && !showConfigForm && (
                  <p className="mt-3 text-xs text-gray-500 dark:text-gray-500">
                    No instances found automatically. Enter URL manually below.
                  </p>
                )}
              </div>

              {showConfigForm ? (
                <form onSubmit={handleSaveConfig} className="space-y-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 p-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-900 dark:text-gray-100">Home Assistant URL</label>
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="http://homeassistant.local:8123"
                      required
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-900 dark:text-gray-100">Long-Lived Access Token</label>
                    <input
                      type="password"
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      placeholder="eyJ0eXAiOiJKV1Q..."
                      required
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-mono text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:border-primary focus:outline-none"
                    />
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {url ? (
                        <>
                          Create one at{" "}
                          <a
                            href={`${url}/profile/security`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {url.replace(/^https?:\/\//, "")}/profile/security
                          </a>
                        </>
                      ) : (
                        "Enter URL above, then create a token at: Profile → Security → Long-Lived Access Tokens"
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600" onClick={() => setShowConfigForm(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saveConfig.isPending}>
                      {saveConfig.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Connect"
                      )}
                    </Button>
                  </div>
                </form>
              ) : (
                <Button onClick={() => setShowConfigForm(true)} className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Connect Home Assistant
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {isConnected && (
        <Card className="border-2 border-primary/40">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Configured Entities</CardTitle>
              <CardDescription>
                Entities displayed on your Home Assistant control panel
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowEntityPicker(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Entity
            </Button>
          </CardHeader>
          <CardContent>
            {entities.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 p-6 text-center bg-gray-50 dark:bg-gray-800/50">
                <Home className="mx-auto h-8 w-8 text-gray-400 dark:text-gray-500" />
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  No entities configured
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setShowEntityPicker(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Entity
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {entities.map((entity) => {
                  const domainParts = entity.entityId.split(".");
                  const domain = domainParts[0] || "";
                  const supportsDurationAlert = ["light", "switch", "cover", "lock", "fan", "binary_sensor", "input_boolean"].includes(domain);
                  const settings = entity.settings as {
                    durationAlert?: {
                      enabled: boolean;
                      thresholdMinutes: number;
                      repeatIntervalMinutes?: number;
                    };
                  };
                  const isEditing = editingEntity === entity.id;

                  return (
                    <div
                      key={entity.id}
                      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
                    >
                      {isEditing ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            const enabled = formData.get("durationAlertEnabled") === "on";
                            const thresholdMinutes = parseInt(formData.get("thresholdMinutes") as string) || 30;
                            const repeatIntervalMinutes = parseInt(formData.get("repeatIntervalMinutes") as string) || 15;
                            updateEntitySettings.mutate({
                              id: entity.id,
                              settings: {
                                ...entity.settings,
                                durationAlert: {
                                  enabled,
                                  thresholdMinutes,
                                  repeatIntervalMinutes,
                                },
                              },
                            });
                          }}
                          className="space-y-4"
                        >
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">
                              {entity.displayName || entity.entityId}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{entity.entityId}</p>
                          </div>

                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              id={`duration-alert-${entity.id}`}
                              name="durationAlertEnabled"
                              defaultChecked={settings?.durationAlert?.enabled}
                              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <label htmlFor={`duration-alert-${entity.id}`} className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Enable duration alert
                            </label>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Alert after (minutes)
                              </label>
                              <input
                                type="number"
                                name="thresholdMinutes"
                                min="1"
                                defaultValue={settings?.durationAlert?.thresholdMinutes ?? 30}
                                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Repeat every (minutes)
                              </label>
                              <input
                                type="number"
                                name="repeatIntervalMinutes"
                                min="1"
                                defaultValue={settings?.durationAlert?.repeatIntervalMinutes ?? 15}
                                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                              />
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button type="submit" size="sm" disabled={updateEntitySettings.isPending}>
                              {updateEntitySettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              Save
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => setEditingEntity(null)}>
                              Cancel
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">
                              {entity.displayName || entity.entityId}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              {entity.displayName && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">{entity.entityId}</span>
                              )}
                              {supportsDurationAlert && settings?.durationAlert?.enabled && (
                                <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200">
                                  Alert: {settings.durationAlert.thresholdMinutes}m
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {supportsDurationAlert && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingEntity(entity.id)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveEntity(entity)}
                              disabled={removeEntity.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cameras Card */}
      {isConnected && (
        <Card className="border-2 border-primary/40">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Cameras</CardTitle>
              <CardDescription>
                Home Assistant cameras to display on the Cameras page
              </CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowCameraPicker(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Camera
            </Button>
          </CardHeader>
          <CardContent>
            {enabledCameras.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 p-6 text-center bg-gray-50 dark:bg-gray-800/50">
                <Video className="mx-auto h-8 w-8 text-gray-400 dark:text-gray-500" />
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  No cameras configured
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setShowCameraPicker(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Camera
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {enabledCameras.map((camera) => {
                  const settings = camera.settings as {
                    refreshInterval?: number;
                    aspectRatio?: "16:9" | "4:3" | "1:1";
                  };
                  const isEditing = editingCamera === camera.id;

                  return (
                    <div
                      key={camera.id}
                      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
                    >
                      {isEditing ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            updateCameraSettings.mutate({
                              id: camera.id,
                              displayName: formData.get("displayName") as string || null,
                              settings: {
                                refreshInterval: parseInt(formData.get("refreshInterval") as string) || 5,
                                aspectRatio: (formData.get("aspectRatio") as "16:9" | "4:3" | "1:1") || "16:9",
                              },
                            });
                          }}
                          className="space-y-4"
                        >
                          <div>
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Display Name
                            </label>
                            <input
                              type="text"
                              name="displayName"
                              defaultValue={camera.displayName || ""}
                              placeholder="Custom name (optional)"
                              className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                            />
                            <p className="mt-1 text-xs text-gray-500">
                              Entity: {camera.entityId}
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Refresh Interval
                              </label>
                              <select
                                name="refreshInterval"
                                defaultValue={settings?.refreshInterval ?? 5}
                                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                              >
                                <option value="1">1 second</option>
                                <option value="2">2 seconds</option>
                                <option value="5">5 seconds</option>
                                <option value="10">10 seconds</option>
                                <option value="30">30 seconds</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                Aspect Ratio
                              </label>
                              <select
                                name="aspectRatio"
                                defaultValue={settings?.aspectRatio ?? "16:9"}
                                className="mt-1 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                              >
                                <option value="16:9">16:9 (Widescreen)</option>
                                <option value="4:3">4:3 (Standard)</option>
                                <option value="1:1">1:1 (Square)</option>
                              </select>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button type="submit" size="sm" disabled={updateCameraSettings.isPending}>
                              {updateCameraSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              Save
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => setEditingCamera(null)}>
                              Cancel
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">
                              {camera.displayName || camera.entityId.replace("camera.", "")}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {camera.entityId} • {settings?.refreshInterval || 5}s refresh • {settings?.aspectRatio || "16:9"}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingCamera(camera.id)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveCamera(camera)}
                              disabled={removeEntity.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Camera Picker Modal */}
      {showCameraPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white dark:bg-gray-900 p-6 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Add Camera</h3>
            {isLoadingCameras ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : availableCameras.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">No cameras found in Home Assistant</p>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {availableCameras.map((camera) => (
                  <button
                    key={camera.entityId}
                    onClick={() => {
                      if (!camera.isEnabled) {
                        handleAddCamera(camera.entityId, camera.name);
                      }
                    }}
                    disabled={camera.isEnabled}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-colors ${
                      camera.isEnabled
                        ? "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 opacity-50 cursor-not-allowed"
                        : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Video className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{camera.name}</p>
                        <p className="text-xs text-gray-500">{camera.entityId}</p>
                      </div>
                    </div>
                    {camera.isEnabled ? (
                      <span className="text-xs text-green-600 dark:text-green-400 font-medium">Added</span>
                    ) : (
                      <Plus className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={() => setShowCameraPicker(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Rooms Management Card */}
      {isConnected && (
        <Card className="border-2 border-primary/40">
          <CardHeader>
            <div>
              <CardTitle>Rooms</CardTitle>
              <CardDescription>
                Organize your devices into rooms for easier navigation
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Create Room */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Add New Room
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="Room name..."
                  className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:border-primary focus:outline-none"
                  onKeyDown={(e) => e.key === "Enter" && handleCreateRoom()}
                />
                <Button
                  onClick={handleCreateRoom}
                  disabled={!newRoomName.trim() || createRoom.isPending}
                >
                  {createRoom.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                  Add
                </Button>
              </div>
            </div>

            {/* Room List */}
            <div className="space-y-3">
              {rooms.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 p-6 text-center bg-gray-50 dark:bg-gray-800/50">
                  <Home className="mx-auto h-8 w-8 text-gray-400 dark:text-gray-500" />
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    No rooms created yet. Add a room above to organize your devices.
                  </p>
                </div>
              ) : (
                rooms.map((room) => {
                  const roomEntities = getEntitiesForRoom(room.id);
                  const isExpanded = expandedRoomId === room.id;

                  return (
                    <div
                      key={room.id}
                      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
                    >
                      {/* Room Header */}
                      <div className="flex items-center gap-3 p-4">
                        {editingRoom?.id === room.id ? (
                          <input
                            type="text"
                            value={editingRoom.name}
                            onChange={(e) => setEditingRoom({ ...editingRoom, name: e.target.value })}
                            onBlur={async () => {
                              if (editingRoom.name.trim() && editingRoom.name !== room.name) {
                                await updateRoom.mutateAsync({ id: room.id, data: { name: editingRoom.name.trim() } });
                              }
                              setEditingRoom(null);
                            }}
                            onKeyDown={async (e) => {
                              if (e.key === "Enter") {
                                if (editingRoom.name.trim() && editingRoom.name !== room.name) {
                                  await updateRoom.mutateAsync({ id: room.id, data: { name: editingRoom.name.trim() } });
                                }
                                setEditingRoom(null);
                              } else if (e.key === "Escape") {
                                setEditingRoom(null);
                              }
                            }}
                            autoFocus
                            className="flex-1 border-b border-primary bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none"
                          />
                        ) : (
                          <button
                            onClick={() => setEditingRoom(room)}
                            className="flex-1 text-left font-medium text-gray-900 dark:text-gray-100 hover:text-primary transition-colors"
                          >
                            {room.name}
                          </button>
                        )}

                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {roomEntities.length} device{roomEntities.length !== 1 ? "s" : ""}
                        </span>

                        <button
                          onClick={() => setExpandedRoomId(isExpanded ? null : room.id)}
                          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          )}
                        </button>

                        <button
                          onClick={() => handleDeleteRoom(room.id)}
                          className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </button>
                      </div>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-4 bg-gray-50 dark:bg-gray-900/50">
                          {/* Sensor Configuration */}
                          <div className="space-y-3">
                            <h4 className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium">
                              Room Sensors (shown in header)
                            </h4>

                            {/* Temperature Sensor */}
                            <div className="flex items-center gap-3">
                              <label className="text-sm text-gray-600 dark:text-gray-400 w-24">Temperature</label>
                              <select
                                value={room.temperatureSensorId || ""}
                                onChange={(e) => updateRoom.mutate({ id: room.id, data: { temperatureSensorId: e.target.value || null } })}
                                className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary"
                              >
                                <option value="">None</option>
                                {temperatureSensors.map((s) => {
                                  const name = s.attributes.friendly_name as string || s.entity_id;
                                  const unit = s.attributes.unit_of_measurement as string || "";
                                  const shortId = s.entity_id.replace("sensor.", "");
                                  return (
                                    <option key={s.entity_id} value={s.entity_id}>
                                      {name} — {s.state}{unit} [{shortId}]
                                    </option>
                                  );
                                })}
                              </select>
                            </div>

                            {/* Humidity Sensor */}
                            <div className="flex items-center gap-3">
                              <label className="text-sm text-gray-600 dark:text-gray-400 w-24">Humidity</label>
                              <select
                                value={room.humiditySensorId || ""}
                                onChange={(e) => updateRoom.mutate({ id: room.id, data: { humiditySensorId: e.target.value || null } })}
                                className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary"
                              >
                                <option value="">None</option>
                                {humiditySensors.map((s) => {
                                  const name = s.attributes.friendly_name as string || s.entity_id;
                                  const unit = s.attributes.unit_of_measurement as string || "";
                                  const shortId = s.entity_id.replace("sensor.", "");
                                  return (
                                    <option key={s.entity_id} value={s.entity_id}>
                                      {name} — {s.state}{unit} [{shortId}]
                                    </option>
                                  );
                                })}
                              </select>
                            </div>

                            {/* Window Sensor */}
                            <div className="flex items-center gap-3">
                              <label className="text-sm text-gray-600 dark:text-gray-400 w-24">Window</label>
                              <select
                                value={room.windowSensorId || ""}
                                onChange={(e) => updateRoom.mutate({ id: room.id, data: { windowSensorId: e.target.value || null } })}
                                className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary"
                              >
                                <option value="">None</option>
                                {binarySensors.map((s) => {
                                  const name = s.attributes.friendly_name as string || s.entity_id;
                                  const stateText = s.state === "on" ? "Open" : s.state === "off" ? "Closed" : s.state;
                                  const shortId = s.entity_id.replace("binary_sensor.", "");
                                  return (
                                    <option key={s.entity_id} value={s.entity_id}>
                                      {name} — {stateText} [{shortId}]
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                          </div>

                          {/* Entities in Room */}
                          {roomEntities.length > 0 && (
                            <div className="space-y-2">
                              <h4 className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium">
                                Devices in this room
                              </h4>
                              {roomEntities.map((entity) => (
                                <div
                                  key={entity.id}
                                  className="flex items-center justify-between py-2 px-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                                >
                                  <span className="text-sm text-gray-900 dark:text-gray-100">
                                    {entity.displayName || getEntityName(entity.entityId)}
                                  </span>
                                  <button
                                    onClick={() => assignEntityToRoom.mutate({ entityId: entity.id, roomId: null })}
                                    className="text-xs text-gray-500 hover:text-destructive transition-colors"
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add Entities to Room */}
                          <div className="space-y-2">
                            <h4 className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-medium">
                              Add devices to room
                            </h4>
                            <select
                              value=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  assignEntityToRoom.mutate({ entityId: e.target.value, roomId: room.id });
                                }
                              }}
                              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-primary"
                            >
                              <option value="">Select a device to add...</option>
                              {entities
                                .filter((e) => e.roomId !== room.id && !e.entityId.startsWith("camera."))
                                .map((entity) => (
                                  <option key={entity.id} value={entity.id}>
                                    {entity.displayName || getEntityName(entity.entityId)}
                                  </option>
                                ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Entity Picker Modal */}
      <EntityPicker
        isOpen={showEntityPicker}
        onClose={() => setShowEntityPicker(false)}
        allStates={allStates}
        selectedEntityIds={selectedEntityIds}
        onAddEntity={handleAddEntity}
        isLoading={isLoadingStates}
      />
    </>
  );
}

// API Keys Settings
function ApiKeysSettings() {
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch server config to get the frontend URL
  const { data: serverConfig } = useQuery({
    queryKey: ["server-config"],
    queryFn: () => api.getServerConfig(),
    staleTime: Infinity, // Config doesn't change often
  });

  // Use configured frontend URL, fallback to current origin
  const frontendUrl = serverConfig?.frontendUrl || window.location.origin;

  const { data: apiKeys = [], isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => api.getApiKeys(),
  });

  const createKeyMutation = useMutation({
    mutationFn: (name: string) => api.createApiKey(name),
    onSuccess: (data) => {
      setCreatedKey(data.key);
      setNewKeyName("");
      setShowCreateForm(false);
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });

  const deleteKeyMutation = useMutation({
    mutationFn: (id: string) => api.deleteApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
  });

  const handleCopyKey = async () => {
    if (createdKey) {
      await navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyKioskUrl = async () => {
    if (createdKey) {
      const kioskUrl = `${frontendUrl}?apiKey=${createdKey}`;
      await navigator.clipboard.writeText(kioskUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card className="border-2 border-primary/40">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>API Keys</CardTitle>
            <CardDescription>
              Manage API keys for kiosk devices, automation tools (n8n, Home Assistant, etc.)
            </CardDescription>
          </div>
          {!showCreateForm && !createdKey && (
            <Button variant="outline" size="sm" onClick={() => setShowCreateForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Key
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Newly created key display */}
        {createdKey && (
          <div className="rounded-lg border-2 border-green-600 bg-green-100 dark:bg-green-950 p-4 space-y-3">
            <div className="flex items-center gap-2 text-green-800 dark:text-green-300">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">API Key Created Successfully</span>
            </div>
            <p className="text-sm text-green-700 dark:text-green-400 font-medium">
              Copy this key now - it won't be shown again!
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-white dark:bg-gray-900 px-3 py-2 text-sm font-mono border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 overflow-x-auto">
                {createdKey}
              </code>
              <Button size="sm" variant="outline" className="border-green-600 text-green-700 hover:bg-green-200 dark:text-green-300 dark:hover:bg-green-900" onClick={handleCopyKey}>
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
            <div className="pt-2 border-t border-green-400 dark:border-green-700">
              <p className="text-sm text-green-700 dark:text-green-400 mb-2 font-medium">
                For kiosk devices, use this URL to auto-authenticate:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-white dark:bg-gray-900 px-3 py-2 text-xs font-mono border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 overflow-x-auto">
                  {frontendUrl}?apiKey={createdKey}
                </code>
                <Button size="sm" variant="outline" className="border-green-600 text-green-700 hover:bg-green-200 dark:text-green-300 dark:hover:bg-green-900" onClick={handleCopyKioskUrl}>
                  Copy URL
                </Button>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2 border-green-600 text-green-700 hover:bg-green-200 dark:text-green-300 dark:hover:bg-green-900"
              onClick={() => setCreatedKey(null)}
            >
              Done
            </Button>
          </div>
        )}

        {/* Create form */}
        {showCreateForm && !createdKey && (
          <div className="rounded-lg border p-4 space-y-3">
            <label className="text-sm font-medium">Key Name</label>
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="e.g., Living Room Kiosk"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => createKeyMutation.mutate(newKeyName)}
                disabled={!newKeyName.trim() || createKeyMutation.isPending}
              >
                {createKeyMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Create
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewKeyName("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Existing keys list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
          </div>
        ) : apiKeys.length === 0 && !createdKey ? (
          <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-6 text-center">
            <Key className="mx-auto h-8 w-8 text-gray-400 dark:text-gray-500" />
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              No API keys created yet
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
              Create an API key to authenticate kiosk devices without OAuth login
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {apiKeys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                    <span className="font-medium text-gray-900 dark:text-gray-100">{key.name}</span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    <code className="text-gray-600 dark:text-gray-300">{key.keyPrefix}...</code>
                    {key.lastUsedAt && (
                      <span className="ml-2">
                        Last used: {new Date(key.lastUsedAt).toLocaleDateString()}
                      </span>
                    )}
                    {key.expiresAt && (
                      <span className="ml-2">
                        Expires: {new Date(key.expiresAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-900/30"
                  onClick={() => {
                    if (confirm("Delete this API key? Any devices using it will lose access.")) {
                      deleteKeyMutation.mutate(key.id);
                    }
                  }}
                  disabled={deleteKeyMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Help text */}
        <div className="rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-4 text-sm space-y-2">
          <p className="font-medium text-blue-800 dark:text-blue-300">How to use API keys for kiosk devices:</p>
          <ol className="list-decimal list-inside space-y-1 text-blue-700 dark:text-blue-400">
            <li>Create an API key with a descriptive name (e.g., "Kitchen Kiosk")</li>
            <li>Copy the kiosk URL shown after creation</li>
            <li>Open that URL on your kiosk device - it will auto-authenticate</li>
            <li>Bookmark the page or set it as the homepage</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}

// Common emojis for account icons
const ACCOUNT_ICON_OPTIONS = [
  "👨", "👩", "👦", "👧", "👴", "👵", "🧑", "👶",
  "🎵", "🎸", "🎹", "🎤", "🎧", "🎺", "🎷", "🥁",
  "❤️", "⭐", "🌟", "🔥", "💜", "💙", "💚", "🧡",
];

function NewsSettings() {
  const queryClient = useQueryClient();
  const [customFeedUrl, setCustomFeedUrl] = useState("");
  const [customFeedName, setCustomFeedName] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Fetch preset feeds
  const { data: presets = [] } = useQuery({
    queryKey: ["news-presets"],
    queryFn: () => api.getNewsPresets(),
  });

  // Fetch user's feeds
  const { data: feeds = [], isLoading } = useQuery({
    queryKey: ["news-feeds"],
    queryFn: () => api.getNewsFeeds(),
  });

  // Add feed mutation
  const addFeedMutation = useMutation({
    mutationFn: (data: { name: string; feedUrl: string; category?: string }) =>
      api.addNewsFeed(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["news-feeds"] });
      setCustomFeedUrl("");
      setCustomFeedName("");
      setValidationError(null);
    },
  });

  // Update feed mutation
  const updateFeedMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ name: string; isActive: boolean }> }) =>
      api.updateNewsFeed(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["news-feeds"] });
    },
  });

  // Delete feed mutation
  const deleteFeedMutation = useMutation({
    mutationFn: (id: string) => api.deleteNewsFeed(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["news-feeds"] });
    },
  });

  // Refresh feeds mutation
  const refreshMutation = useMutation({
    mutationFn: () => api.refreshNewsFeeds(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["news-feeds"] });
      queryClient.invalidateQueries({ queryKey: ["news-headlines"] });
    },
  });

  // Check if a preset is already added
  const isPresetAdded = (url: string) => feeds.some((f) => f.feedUrl === url);

  // Handle adding a custom feed
  const handleAddCustomFeed = async () => {
    if (!customFeedUrl) return;

    setIsValidating(true);
    setValidationError(null);

    try {
      const result = await api.validateNewsFeedUrl(customFeedUrl);
      if (!result.valid) {
        setValidationError(result.error || "Invalid feed URL");
        setIsValidating(false);
        return;
      }

      await addFeedMutation.mutateAsync({
        name: customFeedName || result.title || "Custom Feed",
        feedUrl: customFeedUrl,
        category: "custom",
      });
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : "Failed to add feed");
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Preset Feeds */}
      <Card className="border-2 border-primary/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Rss className="h-5 w-5" />
            NYTimes Feeds
          </CardTitle>
          <CardDescription>
            Quick add popular news feeds
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {presets.map((preset) => {
            const isAdded = isPresetAdded(preset.url);
            return (
              <div
                key={preset.url}
                className="flex items-center justify-between p-3 rounded-lg border border-border"
              >
                <div className="flex items-center gap-3">
                  <Newspaper className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{preset.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{preset.category}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={isAdded ? "outline" : "default"}
                  disabled={isAdded || addFeedMutation.isPending}
                  onClick={() => addFeedMutation.mutate({
                    name: preset.name,
                    feedUrl: preset.url,
                    category: preset.category,
                  })}
                >
                  {isAdded ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Added
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Your Feeds */}
      <Card className="border-2 border-primary/40">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Your Feeds</CardTitle>
              <CardDescription>
                Manage your subscribed feeds
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : feeds.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Newspaper className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No feeds subscribed</p>
              <p className="text-sm mt-1">Add feeds from the presets or add a custom feed below</p>
            </div>
          ) : (
            <div className="space-y-2">
              {feeds.map((feed) => (
                <div
                  key={feed.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => updateFeedMutation.mutate({
                        id: feed.id,
                        data: { isActive: !feed.isActive },
                      })}
                      className="flex-shrink-0"
                    >
                      {feed.isActive ? (
                        <Eye className="h-5 w-5 text-primary" />
                      ) : (
                        <EyeOff className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`font-medium text-sm truncate ${!feed.isActive ? "text-muted-foreground" : ""}`}>
                        {feed.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {feed.articleCount ?? 0} articles
                        {feed.lastFetchedAt && ` · Updated ${new Date(feed.lastFetchedAt).toLocaleTimeString()}`}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteFeedMutation.mutate(feed.id)}
                    disabled={deleteFeedMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Custom Feed */}
      <Card className="lg:col-span-2 border-2 border-primary/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Add Custom Feed
          </CardTitle>
          <CardDescription>
            Add any RSS or Atom feed URL
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Feed name (optional)"
              value={customFeedName}
              onChange={(e) => setCustomFeedName(e.target.value)}
              className="flex-shrink-0 sm:w-48 px-3 py-2 rounded-md border border-input bg-background text-sm"
            />
            <input
              type="url"
              placeholder="https://example.com/rss.xml"
              value={customFeedUrl}
              onChange={(e) => {
                setCustomFeedUrl(e.target.value);
                setValidationError(null);
              }}
              className="flex-1 px-3 py-2 rounded-md border border-input bg-background text-sm"
            />
            <Button
              onClick={handleAddCustomFeed}
              disabled={!customFeedUrl || isValidating || addFeedMutation.isPending}
            >
              {isValidating ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-1" />
              )}
              Add Feed
            </Button>
          </div>
          {validationError && (
            <p className="mt-2 text-sm text-destructive">{validationError}</p>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="lg:col-span-2 border-2 border-primary/40">
        <CardContent className="pt-6">
          <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 p-4">
            <h4 className="font-medium text-blue-900 dark:text-blue-100">How News Feeds Work</h4>
            <ul className="mt-2 space-y-1 text-sm text-blue-800 dark:text-blue-200">
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
                Headlines from your feeds appear on the Dashboard
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
                Feeds are automatically refreshed every 30 minutes
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
                Click a headline to open the full article in a new tab
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
                Toggle the eye icon to show/hide a feed from your headlines
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SportsSettings() {
  const queryClient = useQueryClient();

  // Fetch user's favorite teams
  const { data: favoriteTeams = [], isLoading } = useQuery({
    queryKey: ["favorite-teams"],
    queryFn: () => api.getFavoriteTeams(),
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Add Teams Card */}
      <Card className="border-2 border-primary/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Add Teams
          </CardTitle>
          <CardDescription>
            Click a team to add it to your favorites
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TeamSelector onTeamAdded={() => queryClient.invalidateQueries({ queryKey: ["favorite-teams"] })} />
        </CardContent>
      </Card>

      {/* Your Teams Card */}
      <Card className="border-2 border-primary/40">
        <CardHeader>
          <CardTitle>Your Teams</CardTitle>
          <CardDescription>
            Hover and click X to remove a team
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : favoriteTeams.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No favorite teams yet</p>
              <p className="text-sm mt-1">Click teams on the left to add them</p>
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-2">
              <AnimatePresence mode="popLayout">
                {favoriteTeams.map((team, index) => (
                  <FavoriteTeamCard key={team.id} team={team} index={index} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="lg:col-span-2 border-2 border-primary/40">
        <CardContent className="pt-6">
          <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 p-4">
            <h4 className="font-medium text-blue-900 dark:text-blue-100">How Sports Tracking Works</h4>
            <ul className="mt-2 space-y-1 text-sm text-blue-800 dark:text-blue-200">
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
                Live scores for your teams appear in the calendar header during games
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
                Scores update every 30 seconds during live games
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
                Live scores also appear in the screensaver clock widget
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SpotifySettings() {
  const queryClient = useQueryClient();
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingIconAccountId, setEditingIconAccountId] = useState<string | null>(null);
  const [expandedDeviceAccountId, setExpandedDeviceAccountId] = useState<string | null>(null);

  const { data: status, isLoading } = useQuery({
    queryKey: ["spotify-status"],
    queryFn: () => api.getSpotifyStatus(),
  });

  const accounts = status?.accounts || [];

  // Fetch devices for expanded account
  const { data: devices, isLoading: devicesLoading } = useQuery({
    queryKey: ["spotify-devices", expandedDeviceAccountId],
    queryFn: () => expandedDeviceAccountId ? api.getSpotifyDevices(expandedDeviceAccountId) : Promise.resolve([]),
    enabled: !!expandedDeviceAccountId,
  });

  const disconnectMutation = useMutation({
    mutationFn: (accountId?: string) => api.disconnectSpotify(accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spotify-status"] });
    },
  });

  const updateAccountMutation = useMutation({
    mutationFn: ({ accountId, data }: { accountId: string; data: { accountName?: string; isPrimary?: boolean; icon?: string | null; defaultDeviceId?: string | null; favoriteDeviceIds?: string[] | null } }) =>
      api.updateSpotifyAccount(accountId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["spotify-status"] });
      setEditingAccountId(null);
      setEditingIconAccountId(null);
    },
  });

  const handleDisconnect = (accountId: string, accountName: string) => {
    if (confirm(`Disconnect "${accountName}" from Spotify?`)) {
      disconnectMutation.mutate(accountId);
    }
  };

  const handleStartEdit = (accountId: string, currentName: string) => {
    setEditingAccountId(accountId);
    setEditingName(currentName);
  };

  const handleSaveName = (accountId: string) => {
    updateAccountMutation.mutate({
      accountId,
      data: { accountName: editingName },
    });
  };

  const handleSetPrimary = (accountId: string) => {
    updateAccountMutation.mutate({
      accountId,
      data: { isPrimary: true },
    });
  };

  const handleSetIcon = (accountId: string, icon: string | null) => {
    updateAccountMutation.mutate({
      accountId,
      data: { icon },
    });
  };

  const handleSetDefaultDevice = (accountId: string, deviceId: string | null) => {
    updateAccountMutation.mutate({
      accountId,
      data: { defaultDeviceId: deviceId },
    });
  };

  const handleToggleFavoriteDevice = (accountId: string, deviceId: string, currentFavorites: string[] | null) => {
    const favorites = currentFavorites || [];
    const newFavorites = favorites.includes(deviceId)
      ? favorites.filter((id) => id !== deviceId)
      : [...favorites, deviceId];
    updateAccountMutation.mutate({
      accountId,
      data: { favoriteDeviceIds: newFavorites.length > 0 ? newFavorites : null },
    });
  };

  return (
    <Card className="border-2 border-primary/40">
      <CardHeader>
        <CardTitle>Spotify Accounts</CardTitle>
        <CardDescription>
          Connect Spotify accounts to control music playback. You can connect multiple accounts (e.g., for family members).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Connected Accounts List */}
            {accounts.length > 0 && (
              <div className="space-y-3">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className={`rounded-lg border p-4 ${
                      account.isPrimary
                        ? "border-green-500 bg-green-100 dark:border-green-600 dark:bg-green-900"
                        : "border-border"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar/Icon */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setEditingIconAccountId(
                            editingIconAccountId === account.id ? null : account.id
                          )}
                          className="group relative h-10 w-10 rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                          title="Change icon"
                        >
                          {account.icon ? (
                            <div className="flex h-full w-full items-center justify-center bg-muted text-xl">
                              {account.icon}
                            </div>
                          ) : account.spotifyUser?.images?.[0]?.url ? (
                            <img
                              src={account.spotifyUser.images[0].url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-green-500">
                              <Music className="h-5 w-5 text-white" />
                            </div>
                          )}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Pencil className="h-4 w-4 text-white" />
                          </div>
                        </button>
                        {/* Icon Picker Popup */}
                        {editingIconAccountId === account.id && (
                          <div className="absolute left-0 top-12 z-50 w-64 rounded-lg border border-border bg-background p-2 shadow-lg">
                            <div className="grid grid-cols-8 gap-1">
                              {ACCOUNT_ICON_OPTIONS.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => handleSetIcon(account.id, emoji)}
                                  className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted text-lg"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                            {account.icon && (
                              <button
                                type="button"
                                onClick={() => handleSetIcon(account.id, null)}
                                className="mt-2 w-full rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                              >
                                Remove custom icon
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Account Info */}
                      <div className="flex-1 min-w-0">
                        {editingAccountId === account.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleSaveName(account.id);
                                } else if (e.key === "Escape") {
                                  setEditingAccountId(null);
                                }
                              }}
                              className={`flex-1 rounded border px-2 py-1 text-sm ${
                                account.isPrimary
                                  ? "border-green-400 bg-white text-green-900 placeholder:text-green-600 dark:border-green-600 dark:bg-green-950 dark:text-green-50 dark:placeholder:text-green-400"
                                  : "border-border bg-background"
                              }`}
                              placeholder="Account name"
                              autoFocus
                            />
                            <Button
                              size="sm"
                              onClick={() => handleSaveName(account.id)}
                              disabled={updateAccountMutation.isPending}
                              className={account.isPrimary ? "bg-green-700 hover:bg-green-800 text-white" : ""}
                            >
                              {updateAccountMutation.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Save"
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingAccountId(null)}
                              className={account.isPrimary ? "border-green-600 text-green-800 hover:bg-green-200 dark:border-green-500 dark:text-green-100 dark:hover:bg-green-800" : ""}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <p
                                className={`font-medium truncate ${
                                  account.isPrimary ? "text-green-800 dark:text-green-50" : ""
                                }`}
                              >
                                {account.accountName || account.spotifyUser?.display_name || "Spotify Account"}
                              </p>
                              {account.isPrimary && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-green-600 px-2 py-0.5 text-xs font-medium text-white shadow-sm">
                                  <Star className="h-3 w-3" /> Primary
                                </span>
                              )}
                            </div>
                            {account.spotifyUser?.display_name &&
                              account.accountName &&
                              account.accountName !== account.spotifyUser.display_name && (
                                <p className={`text-sm truncate ${account.isPrimary ? "text-green-700 dark:text-green-300" : "text-muted-foreground"}`}>
                                  {account.spotifyUser.display_name}
                                </p>
                              )}
                          </>
                        )}
                      </div>

                      {/* Actions */}
                      {editingAccountId !== account.id && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant={account.isPrimary ? "outline" : "ghost"}
                            size="sm"
                            onClick={() =>
                              handleStartEdit(
                                account.id,
                                account.accountName || account.spotifyUser?.display_name || ""
                              )
                            }
                            title="Rename account"
                            className={account.isPrimary ? "border-green-600 text-green-800 hover:bg-green-200 dark:border-green-500 dark:text-green-100 dark:hover:bg-green-800" : ""}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant={account.isPrimary ? "outline" : "ghost"}
                            size="sm"
                            onClick={() =>
                              setExpandedDeviceAccountId(
                                expandedDeviceAccountId === account.id ? null : account.id
                              )
                            }
                            title="Device settings"
                            className={account.isPrimary ? "border-green-600 text-green-800 hover:bg-green-200 dark:border-green-500 dark:text-green-100 dark:hover:bg-green-800" : ""}
                          >
                            {expandedDeviceAccountId === account.id ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <Speaker className="h-4 w-4" />
                            )}
                          </Button>
                          {!account.isPrimary && accounts.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSetPrimary(account.id)}
                              disabled={updateAccountMutation.isPending}
                              title="Set as primary"
                            >
                              <Star className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant={account.isPrimary ? "outline" : "ghost"}
                            size="sm"
                            onClick={() =>
                              handleDisconnect(
                                account.id,
                                account.accountName || account.spotifyUser?.display_name || "this account"
                              )
                            }
                            disabled={disconnectMutation.isPending}
                            title="Disconnect account"
                            className={account.isPrimary ? "border-red-400 text-red-700 hover:bg-red-100 dark:border-red-500 dark:text-red-300 dark:hover:bg-red-900" : ""}
                          >
                            {disconnectMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Device Settings Panel */}
                    {expandedDeviceAccountId === account.id && (
                      <div className={`mt-3 border-t pt-3 ${account.isPrimary ? "border-green-300 dark:border-green-700" : "border-border"}`}>
                        <h5 className={`text-sm font-medium mb-2 flex items-center gap-2 ${account.isPrimary ? "text-green-800 dark:text-green-100" : ""}`}>
                          <Speaker className="h-4 w-4" />
                          Device Preferences
                        </h5>
                        {devicesLoading ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          </div>
                        ) : devices && devices.length > 0 ? (
                          <div className="space-y-2">
                            {/* Sort devices: favorites first, then others */}
                            {[...devices]
                              .sort((a, b) => {
                                const aIsFav = account.favoriteDeviceIds?.includes(a.id) || false;
                                const bIsFav = account.favoriteDeviceIds?.includes(b.id) || false;
                                if (aIsFav && !bIsFav) return -1;
                                if (!aIsFav && bIsFav) return 1;
                                return a.name.localeCompare(b.name);
                              })
                              .map((device) => {
                                const isDefault = account.defaultDeviceId === device.id;
                                const isFavorite = account.favoriteDeviceIds?.includes(device.id) || false;
                                // Determine background and text colors based on state and whether parent is primary
                                const bgClass = isDefault
                                  ? "border-blue-400 bg-blue-50 dark:border-blue-600 dark:bg-blue-900"
                                  : isFavorite
                                  ? "border-yellow-400 bg-yellow-50 dark:border-yellow-600 dark:bg-yellow-900"
                                  : account.isPrimary
                                  ? "border-green-400 bg-white dark:border-green-600 dark:bg-green-950"
                                  : "border-border bg-background";
                                const textClass = account.isPrimary && !isDefault && !isFavorite
                                  ? "text-green-900 dark:text-green-50"
                                  : isDefault
                                  ? "text-blue-900 dark:text-blue-50"
                                  : isFavorite
                                  ? "text-yellow-900 dark:text-yellow-50"
                                  : "";
                                const iconClass = account.isPrimary && !isDefault && !isFavorite
                                  ? "text-green-700 dark:text-green-300"
                                  : isDefault
                                  ? "text-blue-600 dark:text-blue-300"
                                  : isFavorite
                                  ? "text-yellow-600 dark:text-yellow-300"
                                  : "text-muted-foreground";
                                return (
                                  <div
                                    key={device.id}
                                    className={`flex items-center justify-between p-2 rounded-lg border ${bgClass}`}
                                  >
                                    <div className="flex items-center gap-2">
                                      {device.type === "Smartphone" ? (
                                        <Smartphone className={`h-4 w-4 ${iconClass}`} />
                                      ) : device.type === "Computer" ? (
                                        <Monitor className={`h-4 w-4 ${iconClass}`} />
                                      ) : device.type === "TV" ? (
                                        <Tv className={`h-4 w-4 ${iconClass}`} />
                                      ) : (
                                        <Speaker className={`h-4 w-4 ${iconClass}`} />
                                      )}
                                      <span className={`text-sm ${textClass}`}>{device.name}</span>
                                      {isDefault && (
                                        <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded shadow-sm">
                                          Default
                                        </span>
                                      )}
                                      {isFavorite && !isDefault && (
                                        <span className="text-xs bg-yellow-600 text-white px-1.5 py-0.5 rounded shadow-sm">
                                          Favorite
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          handleToggleFavoriteDevice(
                                            account.id,
                                            device.id,
                                            account.favoriteDeviceIds
                                          )
                                        }
                                        title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                                        className={
                                          isFavorite
                                            ? "border-yellow-500 text-yellow-600 hover:bg-yellow-100 dark:hover:bg-yellow-900"
                                            : "border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                                        }
                                      >
                                        <Star className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          handleSetDefaultDevice(
                                            account.id,
                                            isDefault ? null : device.id
                                          )
                                        }
                                        title={isDefault ? "Remove as default" : "Set as default"}
                                        disabled={updateAccountMutation.isPending}
                                        className={
                                          isDefault
                                            ? "border-blue-500 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900"
                                            : "border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                                        }
                                      >
                                        <CheckCircle className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                            <p className={`text-xs mt-2 ${account.isPrimary ? "text-green-700 dark:text-green-300" : "text-muted-foreground"}`}>
                              Favorite devices appear at the top of device lists. The default device is automatically selected when starting playback.
                            </p>
                          </div>
                        ) : (
                          <p className={`text-sm py-2 ${account.isPrimary ? "text-green-700 dark:text-green-300" : "text-muted-foreground"}`}>
                            No devices found. Make sure Spotify is open on a device.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add Account Button */}
            <a
              href={api.getSpotifyAuthUrl()}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-500 px-4 py-2 font-medium text-white hover:bg-green-600 transition-colors"
            >
              <Plus className="h-5 w-5" />
              {accounts.length > 0 ? "Add Another Spotify Account" : "Connect Spotify"}
            </a>

            {accounts.length === 0 && (
              <div className="rounded-lg border border-border p-4">
                <h4 className="font-medium">Requirements</h4>
                <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                    Spotify Premium account required for playback control
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                    Active Spotify device needed (phone, computer, or speaker)
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                    Configure SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, and SPOTIFY_REDIRECT_URI in environment
                  </li>
                </ul>
              </div>
            )}

            {accounts.length > 0 && (
              <p className="text-sm text-muted-foreground">
                You can control Spotify playback from the Spotify page in the sidebar. Use the account dropdown to switch between accounts.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const { weekStartsOn, setWeekStartsOn, familyName, setFamilyName, homeAddress, setHomeAddress, dayStartHour, setDayStartHour, dayEndHour, setDayEndHour, tickerSpeed, setTickerSpeed } = useCalendarStore();
  const {
    enabled: screensaverEnabled,
    setEnabled: setScreensaverEnabled,
    idleTimeout,
    setIdleTimeout,
    slideInterval,
    setSlideInterval,
    layout: screensaverLayout,
    setLayout: setScreensaverLayout,
    transition,
    setTransition,
    colorScheme,
    setColorScheme,
    nightDimEnabled,
    setNightDimEnabled,
    nightDimStartHour,
    setNightDimStartHour,
    nightDimEndHour,
    setNightDimEndHour,
    nightDimOpacity,
    setNightDimOpacity,
    nightDimFadeDuration,
    setNightDimFadeDuration,
    clockPosition,
    setClockPosition,
    clockSize,
    setClockSize,
  } = useScreensaverStore();
  const {
    layout: tasksLayout,
    setLayout: setTasksLayout,
    showCompleted: tasksShowCompleted,
    setShowCompleted: setTasksShowCompleted,
    expandAllLists,
    setExpandAllLists,
  } = useTasksStore();

  // Read initial tab from URL, default to "account"
  const tabFromUrl = searchParams.get("tab") as SettingsTab | null;
  const initialTab = tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : "account";
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  // Entertainment sub-tab state
  const subTabFromUrl = searchParams.get("subtab") as EntertainmentSubTab | null;
  const initialSubTab = subTabFromUrl && validEntertainmentSubTabs.includes(subTabFromUrl) ? subTabFromUrl : "sports";
  const [activeEntertainmentSubTab, setActiveEntertainmentSubTab] = useState<EntertainmentSubTab>(initialSubTab);

  // Local photos album selection state
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [selectedAlbumName, setSelectedAlbumName] = useState<string>("");

  // Fetch albums for album name lookup
  const { data: albums = [] } = useQuery({
    queryKey: ["photo-albums"],
    queryFn: () => api.getAlbums(),
    staleTime: 0, // Always refetch when query is accessed
  });

  // Update URL when tab changes
  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    if (tab === "entertainment") {
      setSearchParams({ tab, subtab: activeEntertainmentSubTab });
    } else {
      setSearchParams({ tab });
    }
  };

  const handleEntertainmentSubTabChange = (subtab: EntertainmentSubTab) => {
    setActiveEntertainmentSubTab(subtab);
    setSearchParams({ tab: "entertainment", subtab });
  };

  // Fetch calendars for settings
  const { data: calendars = [] } = useQuery({
    queryKey: ["calendars"],
    queryFn: () => api.getCalendars(),
  });

  // Fetch events to determine which calendars have recent activity
  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: () => api.getEvents(),
  });

  // Sort calendars: primary → favorites → read-write → recent events → alphabetical
  // Also separate visible from hidden calendars
  const { visibleCalendars, hiddenCalendars } = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get calendar IDs that have recent events
    const calendarsWithRecentEvents = new Set(
      events
        .filter((event) => new Date(event.startTime) >= thirtyDaysAgo)
        .map((event) => event.calendarId)
    );

    const sortFn = (a: typeof calendars[0], b: typeof calendars[0]) => {
      // Primary calendar always first
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;

      // Favorites next
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;

      // Read-write calendars before read-only
      if (!a.isReadOnly && b.isReadOnly) return -1;
      if (a.isReadOnly && !b.isReadOnly) return 1;

      // Then calendars with recent events
      const aHasRecent = calendarsWithRecentEvents.has(a.id);
      const bHasRecent = calendarsWithRecentEvents.has(b.id);
      if (aHasRecent && !bHasRecent) return -1;
      if (!aHasRecent && bHasRecent) return 1;

      // Then sort alphabetically
      return a.name.localeCompare(b.name);
    };

    const visible = calendars.filter(c => c.isVisible).sort(sortFn);
    const hidden = calendars.filter(c => !c.isVisible).sort(sortFn);

    return { visibleCalendars: visible, hiddenCalendars: hidden };
  }, [calendars, events]);

  // For backwards compatibility
  const sortedCalendars = visibleCalendars;

  // State for hidden calendars section
  const [hiddenCalendarsExpanded, setHiddenCalendarsExpanded] = useState(false);

  const syncAll = useMutation({
    mutationFn: () => api.syncAllCalendars(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendars"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });

  // Track recently favorited calendars for highlight animation
  const [recentlyFavorited, setRecentlyFavorited] = useState<Set<string>>(new Set());
  const calendarListRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const savedScrollRef = useRef<number>(0);

  const updateCalendar = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { isVisible?: boolean; syncEnabled?: boolean; isPrimary?: boolean; isFavorite?: boolean; showOnDashboard?: boolean; visibility?: { week?: boolean; month?: boolean; day?: boolean; popup?: boolean; screensaver?: boolean } };
    }) => api.updateCalendar(id, data),
    onMutate: async ({ id, data }) => {
      // If favoriting/unfavoriting, track it and save scroll position
      if (data.isFavorite !== undefined) {
        // Save current scroll position
        if (scrollContainerRef.current) {
          savedScrollRef.current = scrollContainerRef.current.scrollTop;
        }
        setRecentlyFavorited((prev) => new Set(prev).add(id));
        // Clear highlight after animation
        setTimeout(() => {
          setRecentlyFavorited((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        }, 800);
      }
    },
    onSuccess: (_, { data }) => {
      queryClient.invalidateQueries({ queryKey: ["calendars"] });
      // Restore scroll position after the DOM updates from query invalidation
      if (data.isFavorite !== undefined) {
        // Use multiple frames to ensure DOM has fully updated after React re-render
        setTimeout(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = savedScrollRef.current;
          }
        }, 50);
      }
    },
  });

  // Get editable calendars for default selection
  const editableCalendars = calendars.filter((c) => !c.isReadOnly && c.syncEnabled);
  const currentDefaultCalendar = calendars.find((c) => c.isPrimary);

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const logout = useAuthStore((state) => state.logout);

  return (
    <div className="flex h-full flex-col">
      {/* Login Status Banner */}
      {(() => {
        const hasValidSession = isAuthenticated && user?.email;
        const hasStaleSession = isAuthenticated && !user?.email;

        if (hasValidSession) {
          return (
            <div className="px-4 py-2 flex items-center justify-between bg-green-500/10 border-b border-green-500/20">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-700 dark:text-green-400">
                  Logged in as <strong>{user.email}</strong>
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  api.logout().catch(() => {});
                  logout();
                  window.location.href = "/login";
                }}
                className="text-sm"
              >
                Sign Out
              </Button>
            </div>
          );
        }

        if (hasStaleSession) {
          return (
            <div className="px-4 py-2 flex items-center justify-between bg-yellow-500/10 border-b border-yellow-500/20">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-yellow-600" />
                <span className="text-sm text-yellow-700 dark:text-yellow-400">
                  Session expired - please sign in again
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  logout();
                  window.location.href = "/login";
                }}
                className="text-sm"
              >
                <LogIn className="h-4 w-4 mr-1" />
                Sign In
              </Button>
            </div>
          );
        }

        return (
          <div className="px-4 py-2 flex items-center justify-between bg-red-500/10 border-b border-red-500/20">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm text-red-700 dark:text-red-400">
                Not logged in - some features may not work
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.location.href = "/login"}
              className="text-sm"
            >
              <LogIn className="h-4 w-4 mr-1" />
              Sign In
            </Button>
          </div>
        );
      })()}

      {/* Tab Navigation */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          {/* Mobile dropdown */}
          <div className="md:hidden py-3">
            <select
              value={activeTab}
              onChange={(e) => handleTabChange(e.target.value as SettingsTab)}
              className="w-full min-h-[44px] px-4 py-2 text-sm font-medium bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {tabs.map((tab) => (
                <option key={tab.id} value={tab.id}>
                  {tab.label}
                </option>
              ))}
            </select>
          </div>
          {/* Desktop tabs */}
          <nav className="hidden md:flex justify-center gap-1 -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto">
        <div className="p-4 sm:p-6">
          {/* Account Tab */}
          {activeTab === "account" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
              <Card className="border-2 border-primary/40">
                <CardHeader>
                  <CardTitle>Account</CardTitle>
                  <CardDescription>Your account information</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    {user?.avatarUrl && (
                      <img
                        src={user.avatarUrl}
                        alt={user.name ?? ""}
                        className="h-16 w-16 rounded-full"
                      />
                    )}
                    <div>
                      <p className="font-medium">{user?.name}</p>
                      <p className="text-sm text-muted-foreground">{user?.email}</p>
                      <p className="text-sm text-muted-foreground">
                        Timezone: {user?.timezone}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-primary/40">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Connected Accounts</CardTitle>
                      <CardDescription>
                        Your linked calendar providers
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => syncAll.mutate()}
                      disabled={syncAll.isPending}
                    >
                      <RefreshCw
                        className={`mr-2 h-4 w-4 ${syncAll.isPending ? "animate-spin" : ""}`}
                      />
                      Sync All
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border border-border p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
                          <svg className="h-5 w-5" viewBox="0 0 24 24">
                            <path
                              fill="#EA4335"
                              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                              fill="#34A853"
                              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                              fill="#FBBC05"
                              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                            />
                            <path
                              fill="#4285F4"
                              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium">Google Calendar</p>
                          <p className="text-sm text-muted-foreground">
                            {calendars.filter((c) => c.provider === "google").length}{" "}
                            calendars synced
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-green-500">Connected</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            window.location.href = `/api/v1/auth/oauth/google?returnUrl=${encodeURIComponent(window.location.origin + "/settings?tab=account")}`;
                          }}
                        >
                          <RefreshCw className="mr-1 h-3 w-3" />
                          Reconnect
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Reconnect to grant new permissions (like Google Photos Library access)
                    </p>

                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        window.location.href = "/api/v1/auth/oauth/microsoft";
                      }}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Connect Microsoft Outlook
                    </Button>
                  </div>
                </CardContent>
              </Card>
              </div>

              <div className="space-y-6">
              <KioskSettings />
              </div>
            </div>
          )}

          {/* Calendars Tab */}
          {activeTab === "calendars" && (
            <Card className="border-2 border-primary/40">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Calendars</CardTitle>
                    <CardDescription>
                      Configure which calendars to sync and display
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        calendars.forEach((cal) => {
                          if (!cal.syncEnabled) {
                            updateCalendar.mutate({
                              id: cal.id,
                              data: { syncEnabled: true, isVisible: true },
                            });
                          }
                        });
                      }}
                    >
                      Enable All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        calendars.forEach((cal) => {
                          if (cal.syncEnabled) {
                            updateCalendar.mutate({
                              id: cal.id,
                              data: { syncEnabled: false, isVisible: false },
                            });
                          }
                        });
                      }}
                    >
                      Disable All
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <motion.div ref={calendarListRef} className="space-y-3" layoutScroll>
                  {/* Column toggle header */}
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <span className="text-sm font-medium text-muted-foreground">Toggle all calendars:</span>
                    <div className="flex items-center gap-1">
                      {(["week", "month", "day", "popup", "screensaver"] as const).map((view) => {
                        const allOn = sortedCalendars.every((c) => (c.visibility ?? { week: false, month: false, day: false, popup: true, screensaver: false })[view]);
                        const allOff = sortedCalendars.every((c) => !(c.visibility ?? { week: false, month: false, day: false, popup: true, screensaver: false })[view]);
                        return (
                          <button
                            key={view}
                            onClick={async () => {
                              const newValue = !allOn;
                              // Update cache optimistically with only the specific view changing
                              queryClient.setQueryData(["calendars"], (old: typeof calendars) =>
                                old?.map((cal) => {
                                  const currentVis = cal.visibility ?? { week: false, month: false, day: false, popup: true, screensaver: false };
                                  return {
                                    ...cal,
                                    visibility: { ...currentVis, [view]: newValue },
                                  };
                                })
                              );
                              // Send updates - each with only the view field changing
                              try {
                                await Promise.all(
                                  sortedCalendars.map((calendar) =>
                                    api.updateCalendar(calendar.id, {
                                      visibility: {
                                        ...(calendar.visibility ?? { week: false, month: false, day: false, popup: true, screensaver: false }),
                                        [view]: newValue
                                      }
                                    })
                                  )
                                );
                              } finally {
                                // Refetch to ensure sync with server
                                queryClient.invalidateQueries({ queryKey: ["calendars"] });
                              }
                            }}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                              allOn
                                ? "bg-primary text-primary-foreground shadow-sm"
                                : allOff
                                ? "bg-muted/50 text-muted-foreground hover:bg-muted"
                                : "bg-primary/30 text-primary hover:bg-primary/40"
                            }`}
                          >
                            {view.charAt(0).toUpperCase() + view.slice(1)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {/* Calendar rows */}
                  <AnimatePresence mode="popLayout">
                  {sortedCalendars.map((calendar) => {
                    const visibility = calendar.visibility ?? { week: false, month: false, day: false, popup: true, screensaver: false };
                    return (
                      <motion.div
                        key={calendar.id}
                        layout
                        layoutId={`calendar-${calendar.id}`}
                        initial={false}
                        animate={{
                          opacity: 1,
                          scale: recentlyFavorited.has(calendar.id) ? [1, 1.02, 1] : 1,
                          boxShadow: recentlyFavorited.has(calendar.id)
                            ? ["0 0 0 0 rgba(234, 179, 8, 0)", "0 0 0 4px rgba(234, 179, 8, 0.3)", "0 0 0 0 rgba(234, 179, 8, 0)"]
                            : "0 0 0 0 rgba(234, 179, 8, 0)",
                        }}
                        transition={{
                          layout: { type: "spring", stiffness: 500, damping: 40 },
                          scale: { duration: 0.4 },
                          boxShadow: { duration: 0.6 },
                        }}
                        className={`flex items-center justify-between rounded-xl border p-4 transition-colors ${
                          calendar.isPrimary
                            ? "border-primary/50 bg-primary/5 hover:bg-primary/10"
                            : calendar.isFavorite
                            ? "border-yellow-500/30 bg-yellow-500/5 hover:bg-yellow-500/10"
                            : "border-border bg-card/50 hover:bg-card/80"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Hide calendar button */}
                          <button
                            type="button"
                            onClick={() =>
                              updateCalendar.mutate({
                                id: calendar.id,
                                data: { isVisible: false },
                              })
                            }
                            className="flex-shrink-0 p-1 rounded-md text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                            title="Hide calendar"
                          >
                            <EyeOff className="h-4 w-4" />
                          </button>
                          {/* Favorite star toggle */}
                          <button
                            type="button"
                            onClick={() =>
                              updateCalendar.mutate({
                                id: calendar.id,
                                data: { isFavorite: !calendar.isFavorite },
                              })
                            }
                            className={`flex-shrink-0 p-1 rounded-md transition-colors ${
                              calendar.isFavorite
                                ? "text-yellow-500 hover:text-yellow-600"
                                : "text-muted-foreground/40 hover:text-yellow-500"
                            }`}
                            title={calendar.isFavorite ? "Remove from favorites" : "Add to favorites"}
                          >
                            <Star className={`h-4 w-4 ${calendar.isFavorite ? "fill-current" : ""}`} />
                          </button>
                          <div
                            className="h-5 w-5 rounded-lg shadow-sm flex-shrink-0"
                            style={{ backgroundColor: calendar.color }}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate">{calendar.name}</p>
                              {calendar.isPrimary && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary/20 text-primary text-xs font-medium">
                                  <Crown className="h-3 w-3" />
                                  Primary
                                </span>
                              )}
                              {/* Set as Primary button - only show for non-readonly, non-primary calendars */}
                              {!calendar.isReadOnly && !calendar.isPrimary && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateCalendar.mutate({
                                      id: calendar.id,
                                      data: { isPrimary: true },
                                    })
                                  }
                                  className="p-1 rounded-md text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-colors"
                                  title="Set as primary calendar"
                                >
                                  <Crown className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {calendar.provider} • {calendar.isReadOnly ? "Read-only" : "Read-write"}
                            </p>
                          </div>
                        </div>
                        <ToggleGroup
                          items={[
                            {
                              key: "week",
                              label: "Week",
                              checked: visibility.week,
                              onChange: (checked) =>
                                updateCalendar.mutate({
                                  id: calendar.id,
                                  data: { visibility: { ...visibility, week: checked } },
                                }),
                            },
                            {
                              key: "month",
                              label: "Month",
                              checked: visibility.month,
                              onChange: (checked) =>
                                updateCalendar.mutate({
                                  id: calendar.id,
                                  data: { visibility: { ...visibility, month: checked } },
                                }),
                            },
                            {
                              key: "day",
                              label: "Day",
                              checked: visibility.day,
                              onChange: (checked) =>
                                updateCalendar.mutate({
                                  id: calendar.id,
                                  data: { visibility: { ...visibility, day: checked } },
                                }),
                            },
                            {
                              key: "popup",
                              label: "Popup",
                              checked: visibility.popup,
                              onChange: (checked) =>
                                updateCalendar.mutate({
                                  id: calendar.id,
                                  data: { visibility: { ...visibility, popup: checked } },
                                }),
                            },
                            {
                              key: "screensaver",
                              label: "Screensaver",
                              checked: visibility.screensaver,
                              onChange: (checked) =>
                                updateCalendar.mutate({
                                  id: calendar.id,
                                  data: { visibility: { ...visibility, screensaver: checked } },
                                }),
                            },
                          ]}
                        />
                      </motion.div>
                    );
                  })}
                  </AnimatePresence>
                </motion.div>

                {/* Hidden calendars section */}
                {hiddenCalendars.length > 0 && (
                  <div className="mt-6 border-t border-border pt-4">
                    <button
                      type="button"
                      onClick={() => setHiddenCalendarsExpanded(!hiddenCalendarsExpanded)}
                      className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
                    >
                      {hiddenCalendarsExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                      <EyeOff className="h-4 w-4" />
                      <span>Hidden calendars ({hiddenCalendars.length})</span>
                    </button>

                    <AnimatePresence>
                      {hiddenCalendarsExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-3 space-y-2">
                            {hiddenCalendars.map((calendar) => (
                              <div
                                key={calendar.id}
                                className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 p-3 opacity-60 hover:opacity-80 transition-opacity"
                              >
                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateCalendar.mutate({
                                        id: calendar.id,
                                        data: { isVisible: true },
                                      })
                                    }
                                    className="flex-shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                                    title="Show calendar"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </button>
                                  <div
                                    className="h-4 w-4 rounded-md"
                                    style={{ backgroundColor: calendar.color }}
                                  />
                                  <span className="text-sm">{calendar.name}</span>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {calendar.provider}
                                </span>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Tasks Tab */}
          {activeTab === "tasks" && (
            <Card className="border-2 border-primary/40">
              <CardHeader>
                <CardTitle>Tasks Display</CardTitle>
                <CardDescription>
                  Configure how tasks are displayed
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="font-medium">Layout</p>
                    <p className="text-sm text-muted-foreground">
                      Choose how tasks are displayed
                    </p>
                  </div>
                  <select
                    className="rounded-md border border-border bg-background px-3 py-2 min-h-[44px] w-full sm:w-auto"
                    value={tasksLayout}
                    onChange={(e) => setTasksLayout(e.target.value as TasksLayout)}
                  >
                    <option value="lists">Collapsible Lists</option>
                    <option value="grid">Grid</option>
                    <option value="columns">Columns (Side-by-Side)</option>
                    <option value="kanban">Kanban (By Status)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">Show completed tasks</p>
                    <p className="text-sm text-muted-foreground">
                      Display completed tasks by default
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={tasksShowCompleted}
                    onChange={(e) => setTasksShowCompleted(e.target.checked)}
                    className="rounded min-h-[44px] min-w-[44px]"
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">Expand all lists</p>
                    <p className="text-sm text-muted-foreground">
                      Automatically expand all task lists (Lists layout only)
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={expandAllLists}
                    onChange={(e) => setExpandAllLists(e.target.checked)}
                    className="rounded min-h-[44px] min-w-[44px]"
                    disabled={tasksLayout !== "lists"}
                  />
                </div>

                {/* Layout preview */}
                <div className="rounded-lg border border-border p-4 bg-muted/30">
                  <p className="text-sm font-medium mb-2">Layout preview</p>
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => setTasksLayout("lists")}
                      className={`aspect-video rounded border-2 flex flex-col items-start justify-center p-1.5 gap-0.5 ${
                        tasksLayout === "lists" ? "border-primary bg-primary/10" : "border-border"
                      }`}
                      title="Collapsible Lists"
                    >
                      <div className="w-full h-1 bg-muted-foreground/30 rounded" />
                      <div className="w-3/4 h-0.5 bg-muted-foreground/20 rounded ml-1" />
                      <div className="w-full h-1 bg-muted-foreground/30 rounded" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setTasksLayout("grid")}
                      className={`aspect-video rounded border-2 grid grid-cols-3 gap-0.5 p-1 ${
                        tasksLayout === "grid" ? "border-primary bg-primary/10" : "border-border"
                      }`}
                      title="Grid"
                    >
                      <div className="bg-muted-foreground/30 rounded" />
                      <div className="bg-muted-foreground/30 rounded" />
                      <div className="bg-muted-foreground/30 rounded" />
                      <div className="bg-muted-foreground/30 rounded" />
                      <div className="bg-muted-foreground/30 rounded" />
                      <div className="bg-muted-foreground/30 rounded" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setTasksLayout("columns")}
                      className={`aspect-video rounded border-2 flex items-stretch gap-0.5 p-1 ${
                        tasksLayout === "columns" ? "border-primary bg-primary/10" : "border-border"
                      }`}
                      title="Columns"
                    >
                      <div className="flex-1 bg-muted-foreground/30 rounded" />
                      <div className="flex-1 bg-muted-foreground/30 rounded" />
                      <div className="flex-1 bg-muted-foreground/30 rounded" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setTasksLayout("kanban")}
                      className={`aspect-video rounded border-2 flex items-stretch gap-0.5 p-1 ${
                        tasksLayout === "kanban" ? "border-primary bg-primary/10" : "border-border"
                      }`}
                      title="Kanban"
                    >
                      <div className="flex-1 bg-muted-foreground/30 rounded flex flex-col gap-0.5 p-0.5">
                        <div className="flex-1 bg-muted-foreground/20 rounded" />
                        <div className="flex-1 bg-muted-foreground/20 rounded" />
                      </div>
                      <div className="flex-1 bg-green-500/30 rounded flex flex-col gap-0.5 p-0.5">
                        <div className="flex-1 bg-green-500/20 rounded" />
                      </div>
                    </button>
                  </div>
                  <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                    <span>Lists</span>
                    <span>Grid</span>
                    <span>Columns</span>
                    <span>Kanban</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Entertainment Tab */}
          {activeTab === "entertainment" && (
            <div className="space-y-6">
              {/* Sub-tab navigation - horizontally scrollable on mobile */}
              <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 border-b border-border pb-4">
                <div className="flex gap-2 whitespace-nowrap">
                  {entertainmentSubTabs.map((subtab) => (
                    <button
                      key={subtab.id}
                      onClick={() => handleEntertainmentSubTabChange(subtab.id)}
                      className={`flex items-center gap-2 px-4 py-2 min-h-[44px] text-sm font-medium rounded-lg transition-colors ${
                        activeEntertainmentSubTab === subtab.id
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      {subtab.icon}
                      {subtab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sub-tab content */}
              {activeEntertainmentSubTab === "sports" && <SportsSettings />}
              {activeEntertainmentSubTab === "spotify" && <SpotifySettings />}
              {activeEntertainmentSubTab === "iptv" && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <IptvSettings />
                  <IptvChannelManager />
                </div>
              )}
              {activeEntertainmentSubTab === "news" && <NewsSettings />}
            </div>
          )}

          {/* Appearance Tab (Display + Screensaver) */}
          {activeTab === "appearance" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Column 1: Display + Color Scheme */}
            <div className="space-y-6">
            <Card className="border-2 border-primary/40">
              <CardHeader>
                <CardTitle>Display</CardTitle>
                <CardDescription>
                  Configure the dashboard display for kiosk mode
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="font-medium">Calendar name</p>
                    <p className="text-sm text-muted-foreground">
                      Display name shown at the top of the calendar
                    </p>
                  </div>
                  <input
                    type="text"
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                    className="rounded-md border border-border bg-background px-3 py-2 min-h-[44px] w-full sm:w-48"
                    placeholder="Family Calendar"
                  />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="font-medium">Home address</p>
                    <p className="text-sm text-muted-foreground">
                      Used to calculate travel times to event locations
                    </p>
                  </div>
                  <input
                    type="text"
                    value={homeAddress}
                    onChange={(e) => setHomeAddress(e.target.value)}
                    className="rounded-md border border-border bg-background px-3 py-2 min-h-[44px] w-full sm:w-64"
                    placeholder="123 Main St, City, State"
                  />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="font-medium">Default calendar</p>
                    <p className="text-sm text-muted-foreground">
                      Calendar used when creating new events
                    </p>
                  </div>
                  <select
                    className="rounded-md border border-border bg-background px-3 py-2 min-h-[44px] w-full sm:w-auto"
                    value={currentDefaultCalendar?.id ?? ""}
                    onChange={(e) => {
                      const newDefaultId = e.target.value;
                      if (newDefaultId) {
                        updateCalendar.mutate({
                          id: newDefaultId,
                          data: { isPrimary: true },
                        });
                      }
                    }}
                  >
                    <option value="" disabled>Select a calendar</option>
                    {editableCalendars.map((calendar) => (
                      <option key={calendar.id} value={calendar.id}>
                        {calendar.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">Show clock</p>
                    <p className="text-sm text-muted-foreground">
                      Display time on dashboard
                    </p>
                  </div>
                  <input type="checkbox" defaultChecked className="rounded min-h-[44px] min-w-[44px]" />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="font-medium">Week starts on</p>
                    <p className="text-sm text-muted-foreground">
                      First day of the week in calendar views
                    </p>
                  </div>
                  <select
                    className="rounded-md border border-border bg-background px-3 py-2 min-h-[44px] w-full sm:w-auto"
                    value={weekStartsOn}
                    onChange={(e) => setWeekStartsOn(Number(e.target.value) as 0 | 1 | 2 | 3 | 4 | 5 | 6)}
                  >
                    <option value={1}>Monday</option>
                    <option value={0}>Sunday</option>
                    <option value={6}>Saturday</option>
                  </select>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="font-medium">Day view hours</p>
                    <p className="text-sm text-muted-foreground">
                      Visible time range in day and week views
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      className="rounded-md border border-border bg-background px-3 py-2 min-h-[44px]"
                      value={dayStartHour}
                      onChange={(e) => setDayStartHour(Number(e.target.value))}
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>
                          {i === 0 ? "12 AM" : i < 12 ? `${i} AM` : i === 12 ? "12 PM" : `${i - 12} PM`}
                        </option>
                      ))}
                    </select>
                    <span className="text-muted-foreground">to</span>
                    <select
                      className="rounded-md border border-border bg-background px-3 py-2 min-h-[44px]"
                      value={dayEndHour}
                      onChange={(e) => setDayEndHour(Number(e.target.value))}
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>
                          {i === 0 ? "12 AM" : i < 12 ? `${i} AM` : i === 12 ? "12 PM" : `${i - 12} PM`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="font-medium">Ticker speed</p>
                    <p className="text-sm text-muted-foreground">
                      Speed of the scrolling news ticker in the header
                    </p>
                  </div>
                  <select
                    className="rounded-md border border-border bg-background px-3 py-2 min-h-[44px] w-full sm:w-auto"
                    value={tickerSpeed}
                    onChange={(e) => setTickerSpeed(e.target.value as "slow" | "normal" | "fast")}
                  >
                    <option value="slow">Slow (45s)</option>
                    <option value="normal">Normal (30s)</option>
                    <option value="fast">Fast (15s)</option>
                  </select>
                </div>
              </CardContent>
            </Card>
            </div>

              {/* Column 2: Photo Albums + Manage Photos */}
              <div className="space-y-6">
              {/* Photo Albums */}
              <Card className="border-2 border-primary/40">
                <CardHeader>
                  <CardTitle>
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-5 w-5" />
                      Photo Albums
                    </div>
                  </CardTitle>
                  <CardDescription>
                    Manage photos for the screensaver slideshow. Photos can be uploaded from your device or imported from Google Photos.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedAlbumId ? (
                    <AlbumPhotoGrid
                      albumId={selectedAlbumId}
                      albumName={selectedAlbumName}
                      onBack={() => setSelectedAlbumId(null)}
                    />
                  ) : (
                    <LocalPhotoAlbums
                      onSelectAlbum={(albumId) => {
                        const album = albums.find((a) => a.id === albumId);
                        setSelectedAlbumId(albumId);
                        setSelectedAlbumName(album?.name ?? "Album");
                      }}
                    />
                  )}
                </CardContent>
              </Card>

              {/* Manage Photos */}
              <Card className="border-2 border-primary/40">
                <CardHeader>
                  <CardTitle>Manage Photos</CardTitle>
                  <CardDescription>
                    View and delete uploaded photos across all albums
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ManageAllPhotos />
                </CardContent>
              </Card>
              </div>

              {/* Column 3: Color Scheme + Screensaver */}
              <div className="space-y-6">
              {/* Color Scheme */}
              <Card className="border-2 border-primary/40">
                <CardHeader>
                  <CardTitle>Color Scheme</CardTitle>
                  <CardDescription>
                    Choose a color theme for the entire application
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {COLOR_SCHEMES.map((scheme) => (
                      <button
                        key={scheme.value}
                        onClick={() => setColorScheme(scheme.value)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                          colorScheme === scheme.value
                            ? "border-primary bg-primary/10"
                            : "border-border hover:border-muted-foreground/50"
                        }`}
                      >
                        <div
                          className="w-12 h-12 rounded-full shadow-lg"
                          style={{ backgroundColor: scheme.accent }}
                        />
                        <span className="text-sm font-medium">{scheme.label}</span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Screensaver Settings */}
              <Card className="border-2 border-primary/40">
                <CardHeader>
                  <CardTitle>Screensaver Settings</CardTitle>
                  <CardDescription>
                    Configure when and how the screensaver appears
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">Enable screensaver</p>
                      <p className="text-sm text-muted-foreground">
                        Start photo slideshow after idle timeout
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={screensaverEnabled}
                      onChange={(e) => setScreensaverEnabled(e.target.checked)}
                      className="rounded min-h-[44px] min-w-[44px]"
                    />
                  </div>
                  {screensaverEnabled && (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <p className="font-medium">Idle timeout</p>
                          <p className="text-sm text-muted-foreground">
                            Time before screensaver starts
                          </p>
                        </div>
                        <select
                          className="rounded-md border border-border bg-background px-3 py-2 min-h-[44px] w-full sm:w-auto"
                          value={idleTimeout}
                          onChange={(e) => setIdleTimeout(Number(e.target.value))}
                        >
                          <option value={60}>1 minute</option>
                          <option value={120}>2 minutes</option>
                          <option value={300}>5 minutes</option>
                          <option value={600}>10 minutes</option>
                          <option value={900}>15 minutes</option>
                          <option value={1800}>30 minutes</option>
                        </select>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <p className="font-medium">Slide interval</p>
                          <p className="text-sm text-muted-foreground">
                            Time between photo transitions
                          </p>
                        </div>
                        <select
                          className="rounded-md border border-border bg-background px-3 py-2 min-h-[44px] w-full sm:w-auto"
                          value={slideInterval}
                          onChange={(e) => setSlideInterval(Number(e.target.value))}
                        >
                          <option value={5}>5 seconds</option>
                          <option value={10}>10 seconds</option>
                          <option value={15}>15 seconds</option>
                          <option value={30}>30 seconds</option>
                          <option value={60}>1 minute</option>
                          <option value={300}>5 minutes</option>
                        </select>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <p className="font-medium">Layout</p>
                          <p className="text-sm text-muted-foreground">
                            How photos are displayed
                          </p>
                        </div>
                        <select
                          className="rounded-md border border-border bg-background px-3 py-2 min-h-[44px] w-full sm:w-auto"
                          value={screensaverLayout}
                          onChange={(e) => setScreensaverLayout(e.target.value as ScreensaverLayout)}
                        >
                          <option value="fullscreen">Full screen</option>
                          <option value="side-by-side">Side by side (2)</option>
                          <option value="quad">Quad (4)</option>
                          <option value="scatter">Scatter collage</option>
                        </select>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <p className="font-medium">Transition</p>
                          <p className="text-sm text-muted-foreground">
                            Animation between slides
                          </p>
                        </div>
                        <select
                          className="rounded-md border border-border bg-background px-3 py-2 min-h-[44px] w-full sm:w-auto"
                          value={transition}
                          onChange={(e) => setTransition(e.target.value as ScreensaverTransition)}
                          disabled={screensaverLayout === "scatter"}
                        >
                          <option value="fade">Fade</option>
                          <option value="slide-left">Slide Left</option>
                          <option value="slide-right">Slide Right</option>
                          <option value="slide-up">Slide Up</option>
                          <option value="slide-down">Slide Down</option>
                          <option value="zoom">Zoom</option>
                        </select>
                      </div>
                      <div className="rounded-lg border border-border p-4 bg-muted/30">
                        <p className="text-sm font-medium mb-2">Layout preview</p>
                        <div className="grid grid-cols-4 gap-2">
                          <button
                            type="button"
                            onClick={() => setScreensaverLayout("fullscreen")}
                            className={`aspect-video rounded border-2 flex items-center justify-center ${
                              screensaverLayout === "fullscreen" ? "border-primary bg-primary/10" : "border-border"
                            }`}
                          >
                            <div className="w-8 h-6 bg-muted-foreground/30 rounded" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setScreensaverLayout("side-by-side")}
                            className={`aspect-video rounded border-2 flex items-center justify-center gap-0.5 ${
                              screensaverLayout === "side-by-side" ? "border-primary bg-primary/10" : "border-border"
                            }`}
                          >
                            <div className="w-3 h-5 bg-muted-foreground/30 rounded" />
                            <div className="w-3 h-5 bg-muted-foreground/30 rounded" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setScreensaverLayout("quad")}
                            className={`aspect-video rounded border-2 grid grid-cols-2 grid-rows-2 gap-0.5 p-1 ${
                              screensaverLayout === "quad" ? "border-primary bg-primary/10" : "border-border"
                            }`}
                          >
                            <div className="bg-muted-foreground/30 rounded" />
                            <div className="bg-muted-foreground/30 rounded" />
                            <div className="bg-muted-foreground/30 rounded" />
                            <div className="bg-muted-foreground/30 rounded" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setScreensaverLayout("scatter")}
                            className={`aspect-video rounded border-2 relative overflow-hidden ${
                              screensaverLayout === "scatter" ? "border-primary bg-primary/10" : "border-border"
                            }`}
                          >
                            <div className="absolute w-3 h-2 bg-muted-foreground/30 rounded top-1 left-1 rotate-[-5deg]" />
                            <div className="absolute w-4 h-3 bg-muted-foreground/30 rounded top-2 right-1 rotate-[8deg]" />
                            <div className="absolute w-3 h-2 bg-muted-foreground/30 rounded bottom-1 left-2 rotate-[3deg]" />
                          </button>
                        </div>
                      </div>

                      {/* Night Dim Settings */}
                      <div className="border-t border-border pt-4 mt-4">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="font-medium">Night dimming</p>
                            <p className="text-sm text-muted-foreground">
                              Dim the screen during nighttime hours
                            </p>
                          </div>
                          <input
                            type="checkbox"
                            className="min-h-[44px] min-w-[44px]"
                            checked={nightDimEnabled}
                            onChange={(e) => setNightDimEnabled(e.target.checked)}
                          />
                        </div>

                        {nightDimEnabled && (
                          <div className="mt-4 space-y-4 pl-4 border-l-2 border-primary/20">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="text-sm font-medium block mb-1">
                                  Start time
                                </label>
                                <select
                                  value={nightDimStartHour}
                                  onChange={(e) => setNightDimStartHour(Number(e.target.value))}
                                  className="w-full rounded-md border border-border bg-background px-3 py-2 min-h-[44px] text-sm"
                                >
                                  {Array.from({ length: 24 }, (_, i) => (
                                    <option key={i} value={i}>
                                      {i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="text-sm font-medium block mb-1">
                                  End time
                                </label>
                                <select
                                  value={nightDimEndHour}
                                  onChange={(e) => setNightDimEndHour(Number(e.target.value))}
                                  className="w-full rounded-md border border-border bg-background px-3 py-2 min-h-[44px] text-sm"
                                >
                                  {Array.from({ length: 24 }, (_, i) => (
                                    <option key={i} value={i}>
                                      {i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div>
                              <label className="text-sm font-medium block mb-1">
                                Fade duration: {nightDimFadeDuration} minutes
                              </label>
                              <input
                                type="range"
                                min="0"
                                max="60"
                                step="5"
                                value={nightDimFadeDuration}
                                onChange={(e) => setNightDimFadeDuration(Number(e.target.value))}
                                className="w-full"
                              />
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Instant</span>
                                <span>1 hour</span>
                              </div>
                            </div>

                            <div>
                              <label className="text-sm font-medium block mb-1">
                                Dim level: {nightDimOpacity}%
                              </label>
                              <input
                                type="range"
                                min="10"
                                max="90"
                                step="5"
                                value={nightDimOpacity}
                                onChange={(e) => setNightDimOpacity(Number(e.target.value))}
                                className="w-full"
                              />
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Slight</span>
                                <span>Very dark</span>
                              </div>
                            </div>

                            <p className="text-xs text-muted-foreground">
                              {nightDimFadeDuration > 0 ? (
                                <>Screen will gradually dim starting at {nightDimStartHour === 0 ? "12:00 AM" : nightDimStartHour < 12 ? `${nightDimStartHour}:00 AM` : nightDimStartHour === 12 ? "12:00 PM" : `${nightDimStartHour - 12}:00 PM`}, reaching full dim by {(() => {
                                  const fullDimHour = nightDimStartHour + Math.floor(nightDimFadeDuration / 60);
                                  const fullDimMinute = nightDimFadeDuration % 60;
                                  const adjustedHour = fullDimHour % 24;
                                  const hourStr = adjustedHour === 0 ? "12" : adjustedHour < 12 ? String(adjustedHour) : adjustedHour === 12 ? "12" : String(adjustedHour - 12);
                                  const ampm = adjustedHour < 12 ? "AM" : "PM";
                                  return `${hourStr}:${fullDimMinute.toString().padStart(2, '0')} ${ampm}`;
                                })()}, until {nightDimEndHour === 0 ? "12:00 AM" : nightDimEndHour < 12 ? `${nightDimEndHour}:00 AM` : nightDimEndHour === 12 ? "12:00 PM" : `${nightDimEndHour - 12}:00 PM`}</>
                              ) : (
                                <>Screen will dim instantly at {nightDimStartHour === 0 ? "12:00 AM" : nightDimStartHour < 12 ? `${nightDimStartHour}:00 AM` : nightDimStartHour === 12 ? "12:00 PM" : `${nightDimStartHour - 12}:00 PM`} until {nightDimEndHour === 0 ? "12:00 AM" : nightDimEndHour < 12 ? `${nightDimEndHour}:00 AM` : nightDimEndHour === 12 ? "12:00 PM" : `${nightDimEndHour - 12}:00 PM`}</>
                              )}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Clock settings */}
                      <div className="space-y-4 pt-4 border-t border-border">
                        <h4 className="font-medium">Clock Display</h4>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <label className="text-sm font-medium block mb-2">Position</label>
                            <select
                              value={clockPosition}
                              onChange={(e) => setClockPosition(e.target.value as ClockPosition)}
                              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                              <option value="top-left">Top Left</option>
                              <option value="top-center">Top Center</option>
                              <option value="top-right">Top Right</option>
                              <option value="bottom-left">Bottom Left</option>
                              <option value="bottom-center">Bottom Center</option>
                              <option value="bottom-right">Bottom Right</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-sm font-medium block mb-2">Size</label>
                            <select
                              value={clockSize}
                              onChange={(e) => setClockSize(e.target.value as ClockSize)}
                              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                              <option value="small">Small</option>
                              <option value="medium">Medium</option>
                              <option value="large">Large</option>
                              <option value="extra-large">Extra Large</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
              </div>
            </div>
          )}


          {/* Cameras Tab */}
          {activeTab === "cameras" && (
            <CamerasSettings />
          )}

          {/* Home Assistant Tab */}
          {activeTab === "homeassistant" && (
            <HomeAssistantSettings />
          )}

          {/* AI Tab */}
          {activeTab === "ai" && (
            <div className="space-y-6">
              <AISettings />
            </div>
          )}

          {/* Automations Tab */}
          {activeTab === "automations" && (
            <AutomationsSettings />
          )}

          {/* System Settings Tab */}
          {activeTab === "system" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SystemSettings />
              <ApiKeysSettings />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
