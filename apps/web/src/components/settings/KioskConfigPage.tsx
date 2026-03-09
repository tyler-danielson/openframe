import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import {
  Trash2, Copy, RefreshCw, ExternalLink, Monitor, Calendar, ListTodo,
  Music, Tv, Newspaper, Home, Image as ImageIcon, Trophy, PanelLeft,
  Puzzle, Settings, QrCode, Power, Maximize, Clock, ChevronDown, ChevronUp,
  GripVertical, LayoutDashboard, Plus, X, Settings2, Link2, UserPlus, Loader2,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import { resolveLucideIcon } from "../../lib/icon-utils";
import { DashboardIcon } from "../ui/DashboardIcon";
import { IconPicker } from "../ui/IconPicker";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { api, type Kiosk, type KioskSettings, type KioskEnabledFeatures, type KioskDashboard, type CompanionInvite, type ColorScheme, COLOR_SCHEMES } from "../../services/api";
import { useModuleStore } from "../../stores/modules";
import { SIDEBAR_FEATURES, type SidebarFeature } from "../../stores/sidebar";
import { cn } from "../../lib/utils";
import { appUrl } from "../../lib/cloud";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";
import { DISPLAY_TYPE_OPTIONS, DISPLAY_MODE_OPTIONS, DASHBOARD_TYPE_OPTIONS, getDashboardTypeOption } from "../../data/kiosk-options";
import type { CustomScreen } from "@openframe/shared";

interface KioskConfigPageProps {
  kioskId: string;
}

function resolveIcon(name: string): React.ComponentType<{ className?: string }> {
  return resolveLucideIcon(name);
}

function SortableDashboardItem({ dashboard, onTogglePin, onEdit, onDelete }: {
  dashboard: KioskDashboard;
  onTogglePin: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: dashboard.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className={cn(
      "flex items-center gap-3 py-2.5 px-1",
      isDragging && "z-50 bg-card shadow-lg rounded-lg",
    )}>
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground touch-none">
        <GripVertical className="h-4 w-4" />
      </button>
      <DashboardIcon icon={dashboard.icon} className="h-4 w-4 text-primary" />
      <span className="flex-1 font-medium text-sm">{dashboard.name}</span>
      <span className="text-xs text-muted-foreground">{dashboard.type}</span>
      <label className="flex items-center gap-1.5 text-sm text-muted-foreground" title={dashboard.pinned ? "Pinned to taskbar" : "In More menu"}>
        <input type="checkbox" checked={dashboard.pinned} onChange={onTogglePin} className="rounded" />
        Pin
      </label>
      <button onClick={onEdit} className="p-1 text-muted-foreground hover:text-foreground" title="Settings">
        <Settings2 className="h-4 w-4" />
      </button>
      <button onClick={onDelete} className="p-1 text-muted-foreground hover:text-destructive" title="Remove">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// These must be defined OUTSIDE the component to maintain stable React identity across renders.
// Defining them inside would cause React to unmount/remount all instances on every render,
// which breaks native <select> dropdown interaction.

function SectionHeader({ id, icon, title, description, isCollapsed, onToggle }: {
  id: string; icon: React.ReactNode; title: string; description: string;
  isCollapsed: boolean; onToggle: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onToggle(id)}
      className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
    >
      <div className="flex items-center gap-3">
        <span className="text-primary [&>svg]:h-5 [&>svg]:w-5">{icon}</span>
        <div className="text-left">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {isCollapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
    </button>
  );
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <div>
        <p className="font-medium">{label}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors min-w-[44px]",
        checked ? "bg-primary" : "bg-muted"
      )}
    >
      <span className={cn(
        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
        checked ? "translate-x-6" : "translate-x-1"
      )} />
    </button>
  );
}

// --- Compact setting controls for dashboard config ---

function CRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 min-h-[28px]">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function CSel<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function CMiniCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "h-4 w-4 rounded border flex items-center justify-center transition-colors",
        checked
          ? "bg-primary border-primary text-primary-foreground"
          : "border-border bg-background hover:border-primary/50"
      )}
    >
      {checked && (
        <svg className="h-2.5 w-2.5" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

function CToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
        checked ? "bg-primary" : "bg-muted"
      )}
    >
      <span className={cn(
        "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
        checked ? "translate-x-[18px]" : "translate-x-0.5"
      )} />
    </button>
  );
}

export function KioskConfigPage({ kioskId }: KioskConfigPageProps) {
  const queryClient = useQueryClient();
  const isModuleEnabled = useModuleStore((s) => s.isEnabled);
  const [copiedToken, setCopiedToken] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const { data: kiosks } = useQuery({
    queryKey: ["kiosks"],
    queryFn: () => api.getKiosks(),
  });

  const kiosk = kiosks?.find((k) => k.id === kioskId);

  // Custom screens for sidebar ordering
  const { data: customScreens = [] } = useQuery({
    queryKey: ["custom-screens"],
    queryFn: () => api.getCustomScreens(),
  });

  const kioskDndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const updateKiosk = useMutation({
    mutationFn: (data: Parameters<typeof api.updateKiosk>[1]) =>
      api.updateKiosk(kioskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kiosks"] });
    },
  });

  const deleteKiosk = useMutation({
    mutationFn: () => api.deleteKiosk(kioskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kiosks"] });
    },
  });

  const regenerateToken = useMutation({
    mutationFn: () => api.regenerateKioskToken(kioskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kiosks"] });
    },
  });

  const refreshKiosk = useMutation({
    mutationFn: () => api.refreshKioskById(kioskId),
  });

  // Deep-merge helper for settings JSONB
  const updateSettings = useCallback(
    (section: keyof KioskSettings, values: Record<string, unknown>) => {
      if (!kiosk) return;
      const currentSettings = kiosk.settings ?? {};
      const currentSection = (currentSettings as Record<string, unknown>)[section] as Record<string, unknown> | undefined;
      updateKiosk.mutate({
        settings: {
          ...currentSettings,
          [section]: { ...currentSection, ...values },
        },
      });
    },
    [kiosk, updateKiosk]
  );

  const toggleSection = useCallback((id: string) => {
    setCollapsedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  if (!kiosk) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading kiosk configuration...
      </div>
    );
  }

  const kioskUrl = appUrl(`/kiosk/${kiosk.token}`);
  const settings = kiosk.settings ?? {};

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Header Section */}
      <Card className="border-2 border-primary/40 overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {editingName ? (
                  <input
                    type="text"
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    onBlur={() => {
                      if (nameValue.trim() && nameValue !== kiosk.name) {
                        updateKiosk.mutate({ name: nameValue.trim() });
                      }
                      setEditingName(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") setEditingName(false);
                    }}
                    autoFocus
                    className="text-xl font-bold bg-transparent border-b-2 border-primary outline-none px-1"
                  />
                ) : (
                  <h2
                    className="text-xl font-bold cursor-pointer hover:text-primary transition-colors"
                    onClick={() => { setNameValue(kiosk.name); setEditingName(true); }}
                  >
                    {kiosk.name}
                  </h2>
                )}
                <ToggleSwitch
                  checked={kiosk.isActive}
                  onChange={(v) => updateKiosk.mutate({ isActive: v })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refreshKiosk.mutate()}
                  disabled={refreshKiosk.isPending}
                >
                  <RefreshCw className={cn("h-4 w-4", refreshKiosk.isPending && "animate-spin")} />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowQr(!showQr)}
                >
                  <QrCode className="h-4 w-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (confirm(`Delete kiosk "${kiosk.name}"?`)) {
                      deleteKiosk.mutate();
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* URL + copy */}
            <div className="flex items-center gap-2 text-sm">
              <code className="flex-1 bg-muted px-3 py-2 rounded-md truncate text-xs">{kioskUrl}</code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(kioskUrl);
                  setCopiedToken(true);
                  setTimeout(() => setCopiedToken(false), 2000);
                }}
              >
                {copiedToken ? "Copied!" : <Copy className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(kioskUrl, "_blank")}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>

            {showQr && (
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <QRCodeSVG value={kioskUrl} size={200} />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Display Section */}
      <Card className="border-2 border-primary/40 overflow-hidden">
        <SectionHeader id="display" icon={<Monitor />} title="Display" description="Mode, type, home page, fullscreen" isCollapsed={!!collapsedSections.display} onToggle={toggleSection} />
        {!collapsedSections.display && (
          <CardContent className="border-t border-border/50">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 py-3">
              <SettingRow label="Display mode">
                <select
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-sm w-full"
                  value={kiosk.displayMode}
                  onChange={(e) => updateKiosk.mutate({ displayMode: e.target.value as any })}
                >
                  {DISPLAY_MODE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </SettingRow>

              <SettingRow label="Display type">
                <select
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-sm w-full"
                  value={kiosk.displayType}
                  onChange={(e) => updateKiosk.mutate({ displayType: e.target.value as any })}
                >
                  {DISPLAY_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </SettingRow>

              <SettingRow label="Color scheme">
                <select
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-sm w-full"
                  value={kiosk.colorScheme}
                  onChange={(e) => updateKiosk.mutate({ colorScheme: e.target.value as ColorScheme })}
                >
                  {COLOR_SCHEMES.map((scheme) => (
                    <option key={scheme.value} value={scheme.value}>
                      {scheme.label}
                    </option>
                  ))}
                </select>
              </SettingRow>

              <SettingRow label="Fullscreen delay">
                <select
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-sm w-full"
                  value={kiosk.fullscreenDelayMinutes ?? 0}
                  onChange={(e) => updateKiosk.mutate({ fullscreenDelayMinutes: Number(e.target.value) || null })}
                >
                  <option value={0}>Disabled</option>
                  <option value={1}>1 minute</option>
                  <option value={5}>5 minutes</option>
                  <option value={10}>10 minutes</option>
                  <option value={30}>30 minutes</option>
                </select>
              </SettingRow>

              <SettingRow label="Start fullscreen">
                <ToggleSwitch
                  checked={kiosk.startFullscreen}
                  onChange={(v) => updateKiosk.mutate({ startFullscreen: v })}
                />
              </SettingRow>
            </div>
            <div className="border-t border-border/50 pt-3 mt-1">
              <p className="text-xs font-medium text-muted-foreground mb-2">Toolbar Controls</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <SettingRow label="Fullscreen toggle">
                  <ToggleSwitch
                    checked={kiosk.settings?.controls?.fullscreen !== false}
                    onChange={(v) => updateSettings("controls", { fullscreen: v })}
                  />
                </SettingRow>
                <SettingRow label="Screensaver button">
                  <ToggleSwitch
                    checked={kiosk.settings?.controls?.screensaver !== false}
                    onChange={(v) => updateSettings("controls", { screensaver: v })}
                  />
                </SettingRow>
                <SettingRow label="Settings access">
                  <ToggleSwitch
                    checked={kiosk.settings?.controls?.settings !== false}
                    onChange={(v) => updateSettings("controls", { settings: v })}
                  />
                </SettingRow>
                <SettingRow label="Reload button">
                  <ToggleSwitch
                    checked={kiosk.settings?.controls?.reload !== false}
                    onChange={(v) => updateSettings("controls", { reload: v })}
                  />
                </SettingRow>
                <SettingRow label="Join link (QR)">
                  <ToggleSwitch
                    checked={kiosk.settings?.controls?.join === true}
                    onChange={(v) => updateSettings("controls", { join: v })}
                  />
                </SettingRow>
              </div>
            </div>
            <div className="border-t border-border/50 pt-3 mt-1">
              <SettingRow label="Photo Upload PIN" description="4-digit PIN to protect mobile upload on kiosk (empty = no PIN)">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  pattern="[0-9]*"
                  defaultValue={kiosk.settings?.uploadPin || ""}
                  onBlur={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                    e.target.value = val;
                    if (val !== (kiosk.settings?.uploadPin || "")) {
                      updateKiosk.mutate({
                        settings: { ...kiosk.settings, uploadPin: val || undefined },
                      });
                    }
                  }}
                  placeholder="e.g. 1234"
                  className="w-32 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-center tracking-widest focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
              </SettingRow>
              <SettingRow label="External URL" description="Base URL for QR codes (phones must reach this)">
                <input
                  type="url"
                  defaultValue={kiosk.settings?.externalUrl || ""}
                  onBlur={(e) => {
                    const val = e.target.value.replace(/\/+$/, "");
                    if (val !== (kiosk.settings?.externalUrl || "")) {
                      updateKiosk.mutate({
                        settings: { ...kiosk.settings, externalUrl: val || undefined },
                      });
                    }
                  }}
                  placeholder={window.location.origin}
                  className="w-64 rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
              </SettingRow>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Companion Invite Links Section */}
      <Card className="border-2 border-primary/40 overflow-hidden">
        <SectionHeader id="invite-links" icon={<UserPlus />} title="Invite Links" description="Share a link to grant companion access" isCollapsed={!!collapsedSections["invite-links"]} onToggle={toggleSection} />
        {!collapsedSections["invite-links"] && (
          <CardContent className="border-t border-border/50 py-4">
            <CompanionInviteLinks externalUrl={kiosk.settings?.externalUrl} />
          </CardContent>
        )}
      </Card>

      {/* Dashboards Section */}
      <DashboardsSection kiosk={kiosk} updateKiosk={updateKiosk} isModuleEnabled={isModuleEnabled} />

    </div>
  );
}

// Dashboard settings modal content by type
function DashboardSettingsContent({ dashboard, onConfigChange, kiosk, onKioskChange }: {
  dashboard: KioskDashboard;
  onConfigChange: (key: string, value: unknown) => void;
  kiosk: Kiosk;
  onKioskChange: (data: Record<string, unknown>) => void;
}) {
  const config = dashboard.config;

  switch (dashboard.type) {
    case "calendar":
      return <CalendarDashboardSettings config={config} onConfigChange={onConfigChange} />;

    case "tasks":
      return (
        <div className="space-y-2.5">
          <CRow label="Layout">
            <CSel
              value={(config.layout as string) ?? "lists"}
              onChange={(v) => onConfigChange("layout", v)}
              options={[
                { value: "lists", label: "Lists" },
                { value: "grid", label: "Grid" },
                { value: "columns", label: "Columns" },
                { value: "kanban", label: "Kanban" },
              ]}
            />
          </CRow>
          <CRow label="Show completed">
            <CToggle checked={!!config.showCompleted} onChange={(v) => onConfigChange("showCompleted", v)} />
          </CRow>
          <CRow label="Expand all lists">
            <CToggle checked={!!config.expandAllLists} onChange={(v) => onConfigChange("expandAllLists", v)} />
          </CRow>
        </div>
      );

    case "spotify":
      return (
        <div className="space-y-4">
          <SpotifyAccountPicker
            selectedTokenId={config.oauthTokenId as string | undefined}
            onSelect={(tokenId) => onConfigChange("oauthTokenId", tokenId)}
          />
        </div>
      );

    case "screensaver":
      return (
        <ScreensaverSettings kiosk={kiosk} onKioskChange={onKioskChange} />
      );

    case "iptv":
      return <IptvDashboardSettings config={config} onConfigChange={onConfigChange} />;

    case "photos":
      return <PhotosDashboardSettings config={config} onConfigChange={onConfigChange} />;

    case "homeassistant":
      return <HomeAssistantDashboardSettings config={config} onConfigChange={onConfigChange} />;

    case "custom":
      return (
        <CustomScreenPicker
          selectedScreenId={config.screenId as string | undefined}
          onSelect={(screenId) => onConfigChange("screenId", screenId)}
        />
      );

    default:
      return <p className="text-sm text-muted-foreground">No additional settings for this dashboard type.</p>;
  }
}

// IPTV dashboard settings — channel/favorites picker
function IptvDashboardSettings({ config, onConfigChange }: { config: Record<string, unknown>; onConfigChange: (key: string, value: unknown) => void }) {
  const { data: favorites = [] } = useQuery({
    queryKey: ["iptv-favorites"],
    queryFn: () => api.getIptvFavorites(),
  });

  const showFavoritesOnly = (config.showFavoritesOnly as boolean) ?? true;

  return (
    <div className="space-y-4">
      <SettingRow label="Show favorites only" description="Only display favorited channels">
        <ToggleSwitch checked={showFavoritesOnly} onChange={(v) => onConfigChange("showFavoritesOnly", v)} />
      </SettingRow>
      <div className="text-sm text-muted-foreground">
        {favorites.length > 0
          ? <p>{favorites.length} favorite channel{favorites.length !== 1 ? "s" : ""} configured</p>
          : <p>No favorite channels yet</p>
        }
        <a href="/settings/connections?service=iptv" className="text-primary hover:underline text-xs">
          Manage channels in Connections
        </a>
      </div>
    </div>
  );
}

// Photos dashboard settings — album picker
function PhotosDashboardSettings({ config, onConfigChange }: { config: Record<string, unknown>; onConfigChange: (key: string, value: unknown) => void }) {
  const { data: albums = [] } = useQuery({
    queryKey: ["photo-albums"],
    queryFn: () => api.getAlbums(),
  });

  const selectedAlbumIds = (config.albumIds as string[]) ?? [];

  const toggleAlbum = (albumId: string, checked: boolean) => {
    if (checked) {
      onConfigChange("albumIds", [...selectedAlbumIds, albumId]);
    } else {
      onConfigChange("albumIds", selectedAlbumIds.filter(id => id !== albumId));
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="font-medium">Photo albums</p>
        <p className="text-sm text-muted-foreground">
          Select which albums to display. Leave empty to show all.
        </p>
      </div>
      {albums.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No albums yet.{" "}
          <a href="/settings/connections?service=photos" className="text-primary hover:underline">Add photos in Connections</a>
        </p>
      ) : (
        <div className="border border-border/50 rounded-lg divide-y divide-border/50 max-h-[40vh] overflow-y-auto">
          {albums.map((album: { id: string; name: string; photoCount?: number }) => {
            const isSelected = selectedAlbumIds.length === 0 || selectedAlbumIds.includes(album.id);
            return (
              <div key={album.id} className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium truncate">{album.name}</span>
                  {album.photoCount != null && (
                    <span className="text-xs text-muted-foreground">{album.photoCount} photos</span>
                  )}
                </div>
                <ToggleSwitch checked={isSelected} onChange={(v) => toggleAlbum(album.id, v)} />
              </div>
            );
          })}
        </div>
      )}
      {albums.length > 0 && (
        <p className="text-xs text-muted-foreground">
          <a href="/settings/connections?service=photos" className="text-primary hover:underline">Manage albums in Connections</a>
        </p>
      )}
    </div>
  );
}

// Home Assistant dashboard settings — room picker
function HomeAssistantDashboardSettings({ config, onConfigChange }: { config: Record<string, unknown>; onConfigChange: (key: string, value: unknown) => void }) {
  const { data: rooms = [] } = useQuery({
    queryKey: ["ha-rooms"],
    queryFn: () => api.getHomeAssistantRooms(),
  });

  const selectedRoomIds = (config.roomIds as string[]) ?? [];

  const toggleRoom = (roomId: string, checked: boolean) => {
    if (checked) {
      onConfigChange("roomIds", [...selectedRoomIds, roomId]);
    } else {
      onConfigChange("roomIds", selectedRoomIds.filter(id => id !== roomId));
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="font-medium">Rooms</p>
        <p className="text-sm text-muted-foreground">
          Select which rooms to show. Leave empty to show all.
        </p>
      </div>
      {rooms.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No rooms configured.{" "}
          <a href="/settings/connections?service=homeassistant" className="text-primary hover:underline">Set up rooms in Connections</a>
        </p>
      ) : (
        <div className="border border-border/50 rounded-lg divide-y divide-border/50 max-h-[40vh] overflow-y-auto">
          {rooms.map((room: { id: string; name: string; icon?: string }) => {
            const isSelected = selectedRoomIds.length === 0 || selectedRoomIds.includes(room.id);
            return (
              <div key={room.id} className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  {room.icon && <span className="text-sm">{room.icon}</span>}
                  <span className="text-sm font-medium truncate">{room.name}</span>
                </div>
                <ToggleSwitch checked={isSelected} onChange={(v) => toggleRoom(room.id, v)} />
              </div>
            );
          })}
        </div>
      )}
      {rooms.length > 0 && (
        <p className="text-xs text-muted-foreground">
          <a href="/settings/connections?service=homeassistant" className="text-primary hover:underline">Manage rooms in Connections</a>
        </p>
      )}
    </div>
  );
}

// Dashboards section
function DashboardsSection({ kiosk, updateKiosk, isModuleEnabled }: {
  kiosk: Kiosk;
  updateKiosk: ReturnType<typeof useMutation<Kiosk, Error, Parameters<typeof api.updateKiosk>[1]>>;
  isModuleEnabled: (id: string) => boolean;
}) {
  const [editingDashboard, setEditingDashboard] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const dashboards: KioskDashboard[] = kiosk.dashboards ?? [];

  const saveDashboards = useCallback((newDashboards: KioskDashboard[]) => {
    updateKiosk.mutate({ dashboards: newDashboards });
  }, [updateKiosk]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = dashboards.findIndex(d => d.id === String(active.id));
    const newIdx = dashboards.findIndex(d => d.id === String(over.id));
    if (oldIdx === -1 || newIdx === -1) return;
    saveDashboards(arrayMove(dashboards, oldIdx, newIdx));
  }, [dashboards, saveDashboards]);

  const addDashboard = useCallback((type: import("../../services/api").DashboardType) => {
    const opt = getDashboardTypeOption(type);
    if (!opt) return;
    const newDb: KioskDashboard = {
      id: crypto.randomUUID(),
      type,
      name: opt.label,
      icon: opt.defaultIcon,
      pinned: true,
      config: {},
    };
    saveDashboards([...dashboards, newDb]);
    setShowAddMenu(false);
    // Auto-open edit modal for custom dashboards so user can pick a screen
    if (type === "custom") {
      setEditingDashboard(newDb.id);
    }
  }, [dashboards, saveDashboards]);

  const removeDashboard = useCallback((id: string) => {
    saveDashboards(dashboards.filter(d => d.id !== id));
  }, [dashboards, saveDashboards]);

  const togglePin = useCallback((id: string) => {
    saveDashboards(dashboards.map(d => d.id === id ? { ...d, pinned: !d.pinned } : d));
  }, [dashboards, saveDashboards]);

  const updateDashboard = useCallback((id: string, updates: Partial<KioskDashboard>) => {
    saveDashboards(dashboards.map(d => d.id === id ? { ...d, ...updates } : d));
  }, [dashboards, saveDashboards]);

  const updateDashboardConfig = useCallback((id: string, key: string, value: unknown) => {
    saveDashboards(dashboards.map(d =>
      d.id === id ? { ...d, config: { ...d.config, [key]: value } } : d
    ));
  }, [dashboards, saveDashboards]);

  const editingDb = dashboards.find(d => d.id === editingDashboard);

  // Available types to add (filter by module and allowMultiple)
  const availableTypes = useMemo(() => {
    return DASHBOARD_TYPE_OPTIONS.filter(opt => {
      if (opt.moduleId && !isModuleEnabled(opt.moduleId)) return false;
      if (!opt.allowMultiple && dashboards.some(d => d.type === opt.type)) return false;
      return true;
    });
  }, [dashboards, isModuleEnabled]);

  return (
    <>
      <Card className="border-2 border-primary/40 overflow-hidden">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <span className="text-primary [&>svg]:h-5 [&>svg]:w-5"><LayoutDashboard /></span>
            <div>
              <h3 className="font-semibold text-foreground">Dashboards</h3>
              <p className="text-sm text-muted-foreground">Navigation items, order, and per-dashboard settings</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowAddMenu(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
        <CardContent className="border-t border-border/50 pt-0">
          {dashboards.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No dashboards configured. Add one to get started.</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={dashboards.map(d => d.id)} strategy={verticalListSortingStrategy}>
                <div className="divide-y divide-border/50">
                  {dashboards.map(db => (
                    <SortableDashboardItem
                      key={db.id}
                      dashboard={db}
                      onTogglePin={() => togglePin(db.id)}
                      onEdit={() => setEditingDashboard(db.id)}
                      onDelete={() => removeDashboard(db.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* Add dashboard modal */}
      {showAddMenu && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-[10vh] overflow-y-auto" onClick={() => setShowAddMenu(false)}>
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md mx-4 mb-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-semibold text-foreground">Add Dashboard</h3>
              <button onClick={() => setShowAddMenu(false)} className="p-1 text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-2">
              {availableTypes.length === 0 ? (
                <p className="px-3 py-6 text-sm text-muted-foreground text-center">All dashboard types already added</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {availableTypes.map(opt => {
                    const Icon = resolveIcon(opt.defaultIcon);
                    return (
                      <button
                        key={opt.type}
                        onClick={() => addDashboard(opt.type)}
                        className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-left hover:bg-accent transition-colors"
                      >
                        <div className="flex items-center justify-center h-8 w-8 rounded-md bg-primary/10">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-medium">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dashboard settings modal */}
      {editingDb && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-[10vh] overflow-y-auto" onClick={() => setEditingDashboard(null)}>
          <div className={cn("bg-card border border-border rounded-xl shadow-xl w-full mx-4 mb-8", editingDb.type === "calendar" ? "max-w-2xl" : "max-w-lg")} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-semibold text-foreground">Edit: {editingDb.name}</h3>
              <button onClick={() => setEditingDashboard(null)} className="p-1 text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Common fields */}
              <div className="space-y-2.5">
                <CRow label="Name">
                  <input
                    type="text"
                    value={editingDb.name}
                    onChange={(e) => updateDashboard(editingDb.id, { name: e.target.value })}
                    className="rounded border border-border bg-background px-2 py-1 text-xs w-40 focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                </CRow>
                <CRow label="Icon">
                  <IconPicker
                    value={editingDb.icon}
                    onChange={(icon) => updateDashboard(editingDb.id, { icon })}
                  />
                </CRow>
                <CRow label="Pinned">
                  <CToggle checked={editingDb.pinned} onChange={(v) => updateDashboard(editingDb.id, { pinned: v })} />
                </CRow>
              </div>

              {/* Type-specific settings */}
              <div className="border-t border-border/50 pt-4">
                <DashboardSettingsContent
                  dashboard={editingDb}
                  onConfigChange={(key, value) => updateDashboardConfig(editingDb.id, key, value)}
                  kiosk={kiosk}
                  onKioskChange={(data) => updateKiosk.mutate(data as any)}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Calendar dashboard settings — compact two-column layout matching ScreensTab style
const KIOSK_VIEW_COLS = [
  { key: "week", label: "Wk" },
  { key: "month", label: "Mo" },
  { key: "day", label: "Day" },
  { key: "popup", label: "Pop" },
] as const;

function CalendarDashboardSettings({ config, onConfigChange }: {
  config: Record<string, unknown>;
  onConfigChange: (key: string, value: unknown) => void;
}) {
  const { data: calendarsData } = useQuery({
    queryKey: ["calendars"],
    queryFn: () => api.getCalendars(),
  });
  const { data: favoriteTeams = [] } = useQuery({
    queryKey: ["favorite-teams"],
    queryFn: () => api.getFavoriteTeams(),
  });

  const calendars = calendarsData ?? [];
  const viewCalendars = (config.viewCalendars ?? {}) as Record<string, string[] | null>;

  const allItems = useMemo(() => {
    const items: { id: string; name: string; color: string }[] = [];
    calendars.filter(cal => cal.isVisible && cal.kioskEnabled !== false).forEach(cal => {
      items.push({ id: cal.id, name: cal.name, color: cal.color ?? "#666" });
    });
    favoriteTeams.forEach(team => {
      items.push({
        id: `sports-${team.id}`,
        name: team.teamName,
        color: team.teamColor ?? "#6366f1",
      });
    });
    return items;
  }, [calendars, favoriteTeams]);

  const isChecked = (view: string, itemId: string): boolean => {
    const selected = viewCalendars[view];
    return selected === null || selected === undefined || selected.includes(itemId);
  };

  const toggleItem = (view: string, itemId: string) => {
    const selected = viewCalendars[view];
    if (selected === null || selected === undefined) {
      onConfigChange("viewCalendars", {
        ...viewCalendars,
        [view]: allItems.map(i => i.id).filter(id => id !== itemId),
      });
    } else if (selected.includes(itemId)) {
      onConfigChange("viewCalendars", {
        ...viewCalendars,
        [view]: selected.filter(id => id !== itemId),
      });
    } else {
      const newIds = [...selected, itemId];
      onConfigChange("viewCalendars", {
        ...viewCalendars,
        [view]: newIds.length === allItems.length ? null : newIds,
      });
    }
  };

  const hourLabel = (h: number) =>
    h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`;
  const hourOptions = Array.from({ length: 24 }, (_, i) => ({ value: String(i), label: hourLabel(i) }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Left: General settings */}
      <div className="space-y-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">Display</p>

        <CRow label="Calendar name">
          <input
            type="text"
            value={(config.familyName as string) ?? ""}
            onChange={(e) => onConfigChange("familyName", e.target.value)}
            className="rounded border border-border bg-background px-2 py-1 text-xs w-36 focus:outline-none focus:ring-1 focus:ring-primary/30"
            placeholder="Family Calendar"
          />
        </CRow>

        <CRow label="Home address">
          <input
            type="text"
            value={(config.homeAddress as string) ?? ""}
            onChange={(e) => onConfigChange("homeAddress", e.target.value)}
            className="rounded border border-border bg-background px-2 py-1 text-xs w-44 focus:outline-none focus:ring-1 focus:ring-primary/30"
            placeholder="123 Main St"
          />
        </CRow>

        <CRow label="Default view">
          <CSel
            value={(config.view as string) ?? "month"}
            onChange={(v) => onConfigChange("view", v)}
            options={[
              { value: "month", label: "Month" },
              { value: "week", label: "Week" },
              { value: "day", label: "Day" },
              { value: "agenda", label: "Agenda" },
              { value: "schedule", label: "Schedule" },
            ]}
          />
        </CRow>

        <CRow label="Week starts">
          <CSel
            value={String((config.weekStartsOn as number) ?? 1)}
            onChange={(v) => onConfigChange("weekStartsOn", Number(v))}
            options={[
              { value: "0", label: "Sunday" },
              { value: "1", label: "Monday" },
              { value: "6", label: "Saturday" },
            ]}
          />
        </CRow>

        <CRow label="Time format">
          <CSel
            value={(config.timeFormat as string) ?? "12h"}
            onChange={(v) => onConfigChange("timeFormat", v)}
            options={[
              { value: "12h", label: "12h" },
              { value: "12h-seconds", label: "12h :ss" },
              { value: "24h", label: "24h" },
              { value: "24h-seconds", label: "24h :ss" },
            ]}
          />
        </CRow>

        <CRow label="Hours shown">
          <div className="flex items-center gap-1.5">
            <CSel
              value={String((config.dayStartHour as number) ?? 7)}
              onChange={(v) => onConfigChange("dayStartHour", Number(v))}
              options={hourOptions}
            />
            <span className="text-xs text-muted-foreground">to</span>
            <CSel
              value={String((config.dayEndHour as number) ?? 22)}
              onChange={(v) => onConfigChange("dayEndHour", Number(v))}
              options={hourOptions}
            />
          </div>
        </CRow>

        <CRow label="Event duration">
          <CSel
            value={String((config.defaultEventDuration as number) ?? 60)}
            onChange={(v) => onConfigChange("defaultEventDuration", Number(v))}
            options={[
              { value: "15", label: "15 min" },
              { value: "30", label: "30 min" },
              { value: "60", label: "1 hr" },
              { value: "90", label: "1.5 hr" },
              { value: "120", label: "2 hr" },
            ]}
          />
        </CRow>

        <CRow label="Ticker speed">
          <CSel
            value={(config.tickerSpeed as string) ?? "normal"}
            onChange={(v) => onConfigChange("tickerSpeed", v)}
            options={[
              { value: "slow", label: "Slow" },
              { value: "normal", label: "Normal" },
              { value: "fast", label: "Fast" },
            ]}
          />
        </CRow>

        <CRow label="Week mode">
          <CSel
            value={(config.weekMode as string) ?? "current"}
            onChange={(v) => onConfigChange("weekMode", v)}
            options={[
              { value: "current", label: "Current" },
              { value: "rolling", label: "Rolling" },
            ]}
          />
        </CRow>

        <CRow label="Month mode">
          <CSel
            value={(config.monthMode as string) ?? "current"}
            onChange={(v) => onConfigChange("monthMode", v)}
            options={[
              { value: "current", label: "Current" },
              { value: "rolling", label: "Rolling" },
            ]}
          />
        </CRow>

        <CRow label="Week widget">
          <CSel
            value={(config.weekCellWidget as string) ?? "next-week"}
            onChange={(v) => onConfigChange("weekCellWidget", v)}
            options={[
              { value: "next-week", label: "Next week" },
              { value: "camera", label: "Camera" },
              { value: "map", label: "Map" },
              { value: "spotify", label: "Spotify" },
              { value: "home-control", label: "Home ctrl" },
            ]}
          />
        </CRow>

        <CRow label="Auto refresh">
          <CSel
            value={String((config.autoRefreshInterval as number) ?? 0)}
            onChange={(v) => onConfigChange("autoRefreshInterval", Number(v))}
            options={[
              { value: "0", label: "Off" },
              { value: "1", label: "1 min" },
              { value: "5", label: "5 min" },
              { value: "15", label: "15 min" },
              { value: "30", label: "30 min" },
              { value: "60", label: "1 hr" },
            ]}
          />
        </CRow>

        <CRow label="Drive time">
          <CToggle checked={!!config.showDriveTimeOnNext} onChange={(v) => onConfigChange("showDriveTimeOnNext", v)} />
        </CRow>

        <CRow label="Week numbers">
          <CToggle checked={!!config.showWeekNumbers} onChange={(v) => onConfigChange("showWeekNumbers", v)} />
        </CRow>
      </div>

      {/* Right: Calendar visibility matrix */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">
          Calendar Visibility by View
        </p>

        {allItems.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4">No calendars found.</p>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            {/* Header row */}
            <div className="grid items-center bg-muted/40 border-b border-border" style={{ gridTemplateColumns: "1fr repeat(4, 36px)" }}>
              <div className="px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground">Calendar</div>
              {KIOSK_VIEW_COLS.map((v) => (
                <div key={v.key} className="text-center text-[10px] font-medium text-muted-foreground py-1.5">{v.label}</div>
              ))}
            </div>

            {/* Calendar rows */}
            <div className="max-h-64 overflow-y-auto">
              {allItems.map((item, i) => (
                <div
                  key={item.id}
                  className={cn(
                    "grid items-center",
                    i < allItems.length - 1 && "border-b border-border/50"
                  )}
                  style={{ gridTemplateColumns: "1fr repeat(4, 36px)" }}
                >
                  <div className="px-2.5 py-1.5 flex items-center gap-1.5 min-w-0">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-xs truncate">{item.name}</span>
                  </div>
                  {KIOSK_VIEW_COLS.map((v) => (
                    <div key={v.key} className="flex justify-center py-1.5">
                      <CMiniCheckbox
                        checked={isChecked(v.key, item.id)}
                        onChange={() => toggleItem(v.key, item.id)}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Screensaver settings sub-component (moved from standalone Card into dashboard edit modal)
function ScreensaverSettings({ kiosk, onKioskChange }: { kiosk: Kiosk; onKioskChange: (data: Record<string, unknown>) => void }) {
  const { data: customScreens = [] } = useQuery({
    queryKey: ["custom-screens"],
    queryFn: () => api.getCustomScreens(),
  });

  return (
    <div className="space-y-4">
      <SettingRow label="Enabled" description="Show custom screen on idle">
        <ToggleSwitch
          checked={kiosk.screensaverEnabled}
          onChange={(v) => onKioskChange({ screensaverEnabled: v })}
        />
      </SettingRow>

      <SettingRow label="Source" description="Use a saved custom screen or this kiosk's own layout">
        <select
          className="rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[44px] w-full sm:w-auto"
          value={kiosk.screensaverScreenId ?? ""}
          onChange={(e) => onKioskChange({ screensaverScreenId: e.target.value || null })}
        >
          <option value="">Kiosk's own layout</option>
          {customScreens.map((screen) => (
            <option key={screen.id} value={screen.id}>{screen.name}</option>
          ))}
        </select>
      </SettingRow>

      <SettingRow label="Idle timeout" description="Seconds before custom screen activates">
        <select
          className="rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[44px] w-full sm:w-auto"
          value={kiosk.screensaverTimeout}
          onChange={(e) => onKioskChange({ screensaverTimeout: Number(e.target.value) })}
        >
          <option value={30}>30 seconds</option>
          <option value={60}>1 minute</option>
          <option value={120}>2 minutes</option>
          <option value={300}>5 minutes</option>
          <option value={600}>10 minutes</option>
          <option value={1800}>30 minutes</option>
          <option value={3600}>1 hour</option>
        </select>
      </SettingRow>

      <SettingRow label="Behavior" description="What happens when custom screen activates">
        <select
          className="rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[44px] w-full sm:w-auto"
          value={kiosk.screensaverBehavior}
          onChange={(e) => onKioskChange({ screensaverBehavior: e.target.value })}
        >
          <option value="screensaver">Full custom screen</option>
          <option value="hide-toolbar">Hide toolbar only</option>
        </select>
      </SettingRow>

      <SettingRow label="Slide interval" description="Seconds between photo slides">
        <select
          className="rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[44px] w-full sm:w-auto"
          value={kiosk.screensaverInterval}
          onChange={(e) => onKioskChange({ screensaverInterval: Number(e.target.value) })}
        >
          <option value={5}>5 seconds</option>
          <option value={10}>10 seconds</option>
          <option value={15}>15 seconds</option>
          <option value={30}>30 seconds</option>
          <option value={60}>1 minute</option>
        </select>
      </SettingRow>

      <SettingRow label="Layout" description="Custom screen display layout">
        <select
          className="rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[44px] w-full sm:w-auto"
          value={kiosk.screensaverLayout}
          onChange={(e) => onKioskChange({ screensaverLayout: e.target.value })}
        >
          <option value="fullscreen">Fullscreen</option>
          <option value="informational">Informational</option>
          <option value="quad">Quad</option>
          <option value="scatter">Scatter</option>
          <option value="builder">Builder</option>
          <option value="skylight">Skylight</option>
        </select>
      </SettingRow>

      <SettingRow label="Transition" description="Photo transition effect">
        <select
          className="rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[44px] w-full sm:w-auto"
          value={kiosk.screensaverTransition}
          onChange={(e) => onKioskChange({ screensaverTransition: e.target.value })}
        >
          <option value="fade">Fade</option>
          <option value="slide-left">Slide Left</option>
          <option value="slide-right">Slide Right</option>
          <option value="slide-up">Slide Up</option>
          <option value="slide-down">Slide Down</option>
          <option value="zoom">Zoom</option>
        </select>
      </SettingRow>

      <p className="text-xs text-muted-foreground">
        <a href="/settings/custom-screens" className="text-primary hover:underline">Manage custom screens</a>
      </p>
    </div>
  );
}

// Custom screen picker sub-component
function CustomScreenPicker({ selectedScreenId, onSelect }: { selectedScreenId?: string; onSelect: (id: string | undefined) => void }) {
  const { data: screens } = useQuery({
    queryKey: ["custom-screens"],
    queryFn: () => api.getCustomScreens(),
  });

  return (
    <div className="space-y-2">
      <p className="font-medium">Custom screen</p>
      <p className="text-sm text-muted-foreground">Choose which custom screen to display</p>
      <select
        className="rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[44px] w-full sm:w-auto"
        value={selectedScreenId ?? ""}
        onChange={(e) => onSelect(e.target.value || undefined)}
      >
        <option value="">Select a screen...</option>
        {screens?.map((screen) => (
          <option key={screen.id} value={screen.id}>
            {screen.name}
          </option>
        ))}
      </select>
      {(!screens || screens.length === 0) && (
        <p className="text-sm text-muted-foreground">
          No custom screens yet.{" "}
          <a href="/settings/custom-screens" className="text-primary hover:underline">Create one</a>
        </p>
      )}
      {screens && screens.length > 0 && (
        <p className="text-xs text-muted-foreground">
          <a href="/settings/custom-screens" className="text-primary hover:underline">Manage custom screens</a>
        </p>
      )}
    </div>
  );
}

// Spotify account picker sub-component
function SpotifyAccountPicker({ selectedTokenId, onSelect }: { selectedTokenId?: string; onSelect: (id: string | undefined) => void }) {
  const { data: accounts } = useQuery({
    queryKey: ["spotify-accounts"],
    queryFn: () => api.getSpotifyAccounts(),
  });

  if (!accounts || accounts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No Spotify accounts connected. Add one in Connections settings.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="font-medium">Spotify account</p>
      <p className="text-sm text-muted-foreground">Which Spotify account this kiosk uses</p>
      <select
        className="rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[44px] w-full sm:w-auto"
        value={selectedTokenId ?? ""}
        onChange={(e) => onSelect(e.target.value || undefined)}
      >
        <option value="">Default (primary account)</option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.accountName ?? account.spotifyUser?.display_name ?? account.id}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Companion invite links management within kiosk display settings */
function CompanionInviteLinks({ externalUrl }: { externalUrl?: string }) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState<string | null>(null);

  const { data: invites } = useQuery({
    queryKey: ["companion-invites"],
    queryFn: () => api.getCompanionInvites(),
  });

  const createInvite = useMutation({
    mutationFn: () => api.createCompanionInvite(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["companion-invites"] }),
  });

  const deleteInvite = useMutation({
    mutationFn: (id: string) => api.deleteCompanionInvite(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["companion-invites"] }),
  });

  const baseUrl = externalUrl || window.location.origin;

  function buildLink(token: string) {
    return `${baseUrl}/companion-invite/${token}`;
  }

  function copyLink(token: string) {
    navigator.clipboard.writeText(buildLink(token));
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  }

  // Only show active (unexpired, unaccepted) invites
  const activeInvites = (invites ?? []).filter(
    (inv) => !inv.acceptedAt && new Date(inv.expiresAt) > new Date()
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">
          Generate a link to text or email someone. They'll create an account and get companion access instantly.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 shrink-0 ml-4"
          onClick={() => createInvite.mutate()}
          disabled={createInvite.isPending}
        >
          {createInvite.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Link2 className="h-3.5 w-3.5" />
          )}
          Create Invite Link
        </Button>
      </div>

      {activeInvites.length > 0 && (
        <div className="space-y-2">
          {activeInvites.map((inv) => {
            const daysLeft = Math.ceil(
              (new Date(inv.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            );
            return (
              <div
                key={inv.id}
                className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2"
              >
                <Link2 className="h-4 w-4 shrink-0 text-primary" />
                <span className="flex-1 truncate text-xs font-mono text-muted-foreground">
                  {buildLink(inv.token)}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {daysLeft}d left
                </span>
                <button
                  onClick={() => copyLink(inv.token)}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                  title="Copy link"
                >
                  {copied === inv.token ? (
                    <span className="text-xs text-primary font-medium px-1">Copied</span>
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
                <button
                  onClick={() => deleteInvite.mutate(inv.id)}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  title="Revoke invite"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
