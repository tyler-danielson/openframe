import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { RefreshCw, Key, Plus, ExternalLink, User, Calendar, Monitor, Image as ImageIcon, Tv, FolderOpen, CheckCircle, XCircle, LogIn, Video, Home, Trash2, Loader2, Star, Search } from "lucide-react";
import type { Camera } from "@openframe/shared";
import { api } from "../services/api";
import { useAuthStore } from "../stores/auth";
import { useCalendarStore } from "../stores/calendar";
import { useScreensaverStore, type ScreensaverLayout, type ScreensaverTransition } from "../stores/screensaver";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { LocalPhotoAlbums } from "../components/photos/LocalPhotoAlbums";
import { AlbumPhotoGrid } from "../components/photos/AlbumPhotoGrid";
import { ManageAllPhotos } from "../components/photos/ManageAllPhotos";

type SettingsTab = "account" | "calendars" | "display" | "screensaver" | "kiosk" | "iptv" | "cameras" | "homeassistant" | "api";
const validTabs: SettingsTab[] = ["account", "calendars", "display", "screensaver", "kiosk", "iptv", "cameras", "homeassistant", "api"];

const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: "account", label: "Account", icon: <User className="h-4 w-4" /> },
  { id: "calendars", label: "Calendars", icon: <Calendar className="h-4 w-4" /> },
  { id: "display", label: "Display", icon: <Monitor className="h-4 w-4" /> },
  { id: "screensaver", label: "Screensaver", icon: <ImageIcon className="h-4 w-4" /> },
  { id: "kiosk", label: "Kiosk", icon: <Tv className="h-4 w-4" /> },
  { id: "iptv", label: "IPTV", icon: <Tv className="h-4 w-4" /> },
  { id: "cameras", label: "Cameras", icon: <Video className="h-4 w-4" /> },
  { id: "homeassistant", label: "Home Assistant", icon: <Home className="h-4 w-4" /> },
  { id: "api", label: "API Keys", icon: <Key className="h-4 w-4" /> },
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
    <Card>
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
    <Card>
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
    <Card>
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
    <Card>
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
  );
}

function HomeAssistantSettings() {
  const queryClient = useQueryClient();
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [url, setUrl] = useState("");
  const [accessToken, setAccessToken] = useState("");

  const { data: config, isLoading } = useQuery({
    queryKey: ["homeassistant", "config"],
    queryFn: () => api.getHomeAssistantConfig(),
  });

  const { data: entities = [] } = useQuery({
    queryKey: ["homeassistant", "entities"],
    queryFn: () => api.getHomeAssistantEntities(),
    enabled: !!config,
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

  const removeEntity = useMutation({
    mutationFn: (id: string) => api.removeHomeAssistantEntity(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homeassistant", "entities"] });
    },
  });

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

  return (
    <>
      <Card>
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
          ) : config ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-green-300 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                    <Home className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-green-900 dark:text-green-100">Connected</p>
                    <p className="text-sm text-green-700 dark:text-green-300">{config.url}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
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
                    onClick={handleDisconnect}
                    disabled={deleteConfig.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>

              {showConfigForm && (
                <form onSubmit={handleSaveConfig} className="space-y-4 rounded-lg border border-border p-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Home Assistant URL</label>
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="http://homeassistant.local:8123"
                      required
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Long-Lived Access Token</label>
                    <input
                      type="password"
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      placeholder="Enter new token to update"
                      required
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setShowConfigForm(false)}>
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
              <div className="rounded-lg border border-dashed border-border p-6 text-center">
                <Home className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Not connected to Home Assistant
                </p>
              </div>

              {showConfigForm ? (
                <form onSubmit={handleSaveConfig} className="space-y-4 rounded-lg border border-border p-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Home Assistant URL</label>
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="http://homeassistant.local:8123"
                      required
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Long-Lived Access Token</label>
                    <input
                      type="password"
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      placeholder="eyJ0eXAiOiJKV1Q..."
                      required
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      Create in HA: Profile → Long-Lived Access Tokens
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setShowConfigForm(false)}>
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

      {config && (
        <Card>
          <CardHeader>
            <CardTitle>Configured Entities</CardTitle>
            <CardDescription>
              Entities displayed on your Home Assistant control panel. Add entities from the Home Assistant page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {entities.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center">
                <Home className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No entities configured
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add entities from the Home Assistant page
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {entities.map((entity) => (
                  <div
                    key={entity.id}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                  >
                    <div>
                      <p className="font-medium">
                        {entity.displayName || entity.entityId}
                      </p>
                      {entity.displayName && (
                        <p className="text-xs text-muted-foreground">{entity.entityId}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveEntity(entity)}
                      disabled={removeEntity.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const { weekStartsOn, setWeekStartsOn, familyName, setFamilyName, homeAddress, setHomeAddress, dayStartHour, setDayStartHour, dayEndHour, setDayEndHour } = useCalendarStore();
  const {
    enabled: screensaverEnabled,
    setEnabled: setScreensaverEnabled,
    idleTimeout,
    setIdleTimeout,
    slideInterval,
    setSlideInterval,
    layout,
    setLayout,
    transition,
    setTransition,
  } = useScreensaverStore();

  // Read initial tab from URL, default to "account"
  const tabFromUrl = searchParams.get("tab") as SettingsTab | null;
  const initialTab = tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : "account";
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

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
    setSearchParams({ tab });
  };

  // Fetch calendars for settings
  const { data: calendars = [] } = useQuery({
    queryKey: ["calendars"],
    queryFn: () => api.getCalendars(),
  });

  const syncAll = useMutation({
    mutationFn: () => api.syncAllCalendars(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendars"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });

  const updateCalendar = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { isVisible?: boolean; syncEnabled?: boolean; isPrimary?: boolean };
    }) => api.updateCalendar(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendars"] });
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
        <div className="mx-auto max-w-4xl px-6">
          <nav className="flex justify-center gap-1 -mb-px">
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
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-4xl p-6 space-y-6">
          {/* Account Tab */}
          {activeTab === "account" && (
            <>
              <Card>
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

              <Card>
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
            </>
          )}

          {/* Calendars Tab */}
          {activeTab === "calendars" && (
            <Card>
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
                <div className="space-y-2">
                  {calendars.map((calendar) => (
                    <div
                      key={calendar.id}
                      className="flex items-center justify-between rounded-lg border border-border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="h-4 w-4 rounded"
                          style={{ backgroundColor: calendar.color }}
                        />
                        <div>
                          <p className="font-medium">{calendar.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {calendar.provider} • {calendar.isReadOnly ? "Read-only" : "Read-write"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={calendar.syncEnabled}
                            onChange={(e) =>
                              updateCalendar.mutate({
                                id: calendar.id,
                                data: {
                                  syncEnabled: e.target.checked,
                                  isVisible: e.target.checked ? calendar.isVisible : false,
                                },
                              })
                            }
                            className="rounded"
                          />
                          Sync
                        </label>
                        {calendar.syncEnabled && (
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={calendar.isVisible}
                              onChange={(e) =>
                                updateCalendar.mutate({
                                  id: calendar.id,
                                  data: { isVisible: e.target.checked },
                                })
                              }
                              className="rounded"
                            />
                            Visible
                          </label>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Display Tab */}
          {activeTab === "display" && (
            <Card>
              <CardHeader>
                <CardTitle>Display</CardTitle>
                <CardDescription>
                  Configure the dashboard display for kiosk mode
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
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
                    className="rounded-md border border-border bg-background px-3 py-1 w-48"
                    placeholder="Family Calendar"
                  />
                </div>
                <div className="flex items-center justify-between">
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
                    className="rounded-md border border-border bg-background px-3 py-1 w-64"
                    placeholder="123 Main St, City, State"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Default calendar</p>
                    <p className="text-sm text-muted-foreground">
                      Calendar used when creating new events
                    </p>
                  </div>
                  <select
                    className="rounded-md border border-border bg-background px-3 py-1"
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
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Show clock</p>
                    <p className="text-sm text-muted-foreground">
                      Display time on dashboard
                    </p>
                  </div>
                  <input type="checkbox" defaultChecked className="rounded" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Week starts on</p>
                    <p className="text-sm text-muted-foreground">
                      First day of the week in calendar views
                    </p>
                  </div>
                  <select
                    className="rounded-md border border-border bg-background px-3 py-1"
                    value={weekStartsOn}
                    onChange={(e) => setWeekStartsOn(Number(e.target.value) as 0 | 1 | 2 | 3 | 4 | 5 | 6)}
                  >
                    <option value={1}>Monday</option>
                    <option value={0}>Sunday</option>
                    <option value={6}>Saturday</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Day view hours</p>
                    <p className="text-sm text-muted-foreground">
                      Visible time range in day and week views
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      className="rounded-md border border-border bg-background px-3 py-1"
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
                      className="rounded-md border border-border bg-background px-3 py-1"
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
              </CardContent>
            </Card>
          )}

          {/* Screensaver Tab */}
          {activeTab === "screensaver" && (
            <>
              {/* Photo Albums */}
              <Card>
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
              <Card>
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

              {/* Screensaver Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>Screensaver Settings</CardTitle>
                  <CardDescription>
                    Configure when and how the screensaver appears
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
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
                      className="rounded"
                    />
                  </div>
                  {screensaverEnabled && (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Idle timeout</p>
                          <p className="text-sm text-muted-foreground">
                            Time before screensaver starts
                          </p>
                        </div>
                        <select
                          className="rounded-md border border-border bg-background px-3 py-1"
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
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Slide interval</p>
                          <p className="text-sm text-muted-foreground">
                            Time between photo transitions
                          </p>
                        </div>
                        <select
                          className="rounded-md border border-border bg-background px-3 py-1"
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
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Layout</p>
                          <p className="text-sm text-muted-foreground">
                            How photos are displayed
                          </p>
                        </div>
                        <select
                          className="rounded-md border border-border bg-background px-3 py-1"
                          value={layout}
                          onChange={(e) => setLayout(e.target.value as ScreensaverLayout)}
                        >
                          <option value="fullscreen">Full screen</option>
                          <option value="side-by-side">Side by side (2)</option>
                          <option value="quad">Quad (4)</option>
                          <option value="scatter">Scatter collage</option>
                        </select>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Transition</p>
                          <p className="text-sm text-muted-foreground">
                            Animation between slides
                          </p>
                        </div>
                        <select
                          className="rounded-md border border-border bg-background px-3 py-1"
                          value={transition}
                          onChange={(e) => setTransition(e.target.value as ScreensaverTransition)}
                          disabled={layout === "scatter"}
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
                            onClick={() => setLayout("fullscreen")}
                            className={`aspect-video rounded border-2 flex items-center justify-center ${
                              layout === "fullscreen" ? "border-primary bg-primary/10" : "border-border"
                            }`}
                          >
                            <div className="w-8 h-6 bg-muted-foreground/30 rounded" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setLayout("side-by-side")}
                            className={`aspect-video rounded border-2 flex items-center justify-center gap-0.5 ${
                              layout === "side-by-side" ? "border-primary bg-primary/10" : "border-border"
                            }`}
                          >
                            <div className="w-3 h-5 bg-muted-foreground/30 rounded" />
                            <div className="w-3 h-5 bg-muted-foreground/30 rounded" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setLayout("quad")}
                            className={`aspect-video rounded border-2 grid grid-cols-2 grid-rows-2 gap-0.5 p-1 ${
                              layout === "quad" ? "border-primary bg-primary/10" : "border-border"
                            }`}
                          >
                            <div className="bg-muted-foreground/30 rounded" />
                            <div className="bg-muted-foreground/30 rounded" />
                            <div className="bg-muted-foreground/30 rounded" />
                            <div className="bg-muted-foreground/30 rounded" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setLayout("scatter")}
                            className={`aspect-video rounded border-2 relative overflow-hidden ${
                              layout === "scatter" ? "border-primary bg-primary/10" : "border-border"
                            }`}
                          >
                            <div className="absolute w-3 h-2 bg-muted-foreground/30 rounded top-1 left-1 rotate-[-5deg]" />
                            <div className="absolute w-4 h-3 bg-muted-foreground/30 rounded top-2 right-1 rotate-[8deg]" />
                            <div className="absolute w-3 h-2 bg-muted-foreground/30 rounded bottom-1 left-2 rotate-[3deg]" />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* Kiosk Tab */}
          {activeTab === "kiosk" && (
            <KioskSettings />
          )}

          {/* IPTV Tab */}
          {activeTab === "iptv" && (
            <>
              <IptvSettings />
              <IptvChannelManager />
            </>
          )}

          {/* Cameras Tab */}
          {activeTab === "cameras" && (
            <CamerasSettings />
          )}

          {/* Home Assistant Tab */}
          {activeTab === "homeassistant" && (
            <HomeAssistantSettings />
          )}

          {/* API Keys Tab */}
          {activeTab === "api" && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>API Keys</CardTitle>
                    <CardDescription>
                      Manage API keys for automation (n8n, Home Assistant, etc.)
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Key
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-dashed border-border p-6 text-center">
                  <Key className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    No API keys created yet
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
