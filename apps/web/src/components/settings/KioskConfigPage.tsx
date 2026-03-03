import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import {
  Trash2, Copy, RefreshCw, ExternalLink, Monitor, Calendar, ListTodo,
  Music, Tv, Newspaper, Home, Image as ImageIcon, Trophy, PanelLeft,
  Puzzle, Settings, QrCode, Power, Maximize, Clock, ChevronDown, ChevronUp,
} from "lucide-react";
import { api, type Kiosk, type KioskSettings, type KioskEnabledFeatures, type ColorScheme, COLOR_SCHEMES } from "../../services/api";
import { useModuleStore } from "../../stores/modules";
import { SIDEBAR_FEATURES, type SidebarFeature } from "../../stores/sidebar";
import { cn } from "../../lib/utils";
import { appUrl } from "../../lib/cloud";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";
import { DISPLAY_TYPE_OPTIONS, DISPLAY_MODE_OPTIONS, HOME_PAGE_OPTIONS, FEATURE_OPTIONS } from "../../data/kiosk-options";

interface KioskConfigPageProps {
  kioskId: string;
  /** Render slot for table-backed settings sections (sports, news, photos, HA, IPTV, spotify) */
  renderTableSections?: (kiosk: Kiosk) => React.ReactNode;
}

// Sidebar feature labels for display
const SIDEBAR_FEATURE_LABELS: Record<string, string> = {
  calendar: "Calendar",
  tasks: "Tasks",
  routines: "Routines",
  dashboard: "Dashboard",
  photos: "Photos",
  spotify: "Spotify",
  iptv: "Live TV",
  cameras: "Cameras",
  multiview: "Multi-View",
  homeassistant: "Home Assistant",
  matter: "Matter",
  map: "Map",
  kitchen: "Kitchen",
  chat: "Chat",
  screensaver: "Custom",
};

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

export function KioskConfigPage({ kioskId, renderTableSections }: KioskConfigPageProps) {
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
          <CardContent className="space-y-4 border-t border-border/50">
            <SettingRow label="Display mode" description="How the kiosk app behaves">
              <select
                className="rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[44px] w-full sm:w-auto"
                value={kiosk.displayMode}
                onChange={(e) => updateKiosk.mutate({ displayMode: e.target.value as any })}
              >
                {DISPLAY_MODE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </SettingRow>

            <SettingRow label="Display type" description="How users interact with this display">
              <select
                className="rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[44px] w-full sm:w-auto"
                value={kiosk.displayType}
                onChange={(e) => updateKiosk.mutate({ displayType: e.target.value as any })}
              >
                {DISPLAY_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </SettingRow>

            <SettingRow label="Home page" description="Default page when kiosk loads">
              <select
                className="rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[44px] w-full sm:w-auto"
                value={kiosk.homePage ?? "calendar"}
                onChange={(e) => updateKiosk.mutate({ homePage: e.target.value })}
              >
                {HOME_PAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </SettingRow>

            <SettingRow label="Color scheme" description="Theme for this kiosk">
              <select
                className="rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[44px] w-full sm:w-auto"
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

            <SettingRow label="Start fullscreen" description="Automatically enter fullscreen on load">
              <ToggleSwitch
                checked={kiosk.startFullscreen}
                onChange={(v) => updateKiosk.mutate({ startFullscreen: v })}
              />
            </SettingRow>

            <SettingRow label="Fullscreen delay" description="Auto-fullscreen after N minutes (0 = disabled)">
              <select
                className="rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[44px] w-full sm:w-auto"
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
          </CardContent>
        )}
      </Card>

      {/* Calendar Section */}
      <Card className="border-2 border-primary/40 overflow-hidden">
        <SectionHeader id="calendar" icon={<Calendar />} title="Calendar" description="Display preferences for this kiosk" isCollapsed={!!collapsedSections.calendar} onToggle={toggleSection} />
        {!collapsedSections.calendar && (
          <CardContent className="space-y-4 border-t border-border/50">
            <SettingRow label="Calendar name" description="Display name shown at the top">
              <input
                type="text"
                value={settings.calendar?.familyName ?? ""}
                onChange={(e) => updateSettings("calendar", { familyName: e.target.value })}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[44px] w-full sm:w-48"
                placeholder="Family Calendar"
              />
            </SettingRow>

            <SettingRow label="Home address" description="Used for travel time calculations">
              <input
                type="text"
                value={settings.calendar?.homeAddress ?? ""}
                onChange={(e) => updateSettings("calendar", { homeAddress: e.target.value })}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[44px] w-full sm:w-64"
                placeholder="123 Main St, City, State"
              />
            </SettingRow>

            <SettingRow label="Default view" description="Calendar view when kiosk loads">
              <select
                className="rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[44px] w-full sm:w-auto"
                value={settings.calendar?.view ?? "month"}
                onChange={(e) => updateSettings("calendar", { view: e.target.value })}
              >
                <option value="month">Month</option>
                <option value="week">Week</option>
                <option value="day">Day</option>
                <option value="agenda">Agenda</option>
                <option value="schedule">Schedule</option>
              </select>
            </SettingRow>

            <SettingRow label="Week starts on" description="First day of the week">
              <select
                className="rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[44px] w-full sm:w-auto"
                value={settings.calendar?.weekStartsOn ?? 1}
                onChange={(e) => updateSettings("calendar", { weekStartsOn: Number(e.target.value) })}
              >
                <option value={1}>Monday</option>
                <option value={0}>Sunday</option>
                <option value={6}>Saturday</option>
              </select>
            </SettingRow>

            <SettingRow label="Day view hours" description="Visible time range">
              <div className="flex items-center gap-2">
                <select
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[44px]"
                  value={settings.calendar?.dayStartHour ?? 7}
                  onChange={(e) => updateSettings("calendar", { dayStartHour: Number(e.target.value) })}
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {i === 0 ? "12 AM" : i < 12 ? `${i} AM` : i === 12 ? "12 PM" : `${i - 12} PM`}
                    </option>
                  ))}
                </select>
                <span className="text-muted-foreground">to</span>
                <select
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[44px]"
                  value={settings.calendar?.dayEndHour ?? 22}
                  onChange={(e) => updateSettings("calendar", { dayEndHour: Number(e.target.value) })}
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {i === 0 ? "12 AM" : i < 12 ? `${i} AM` : i === 12 ? "12 PM" : `${i - 12} PM`}
                    </option>
                  ))}
                </select>
              </div>
            </SettingRow>

            <SettingRow label="Time format" description="Clock display format">
              <select
                className="rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[44px] w-full sm:w-auto"
                value={settings.calendar?.timeFormat ?? "12h"}
                onChange={(e) => updateSettings("calendar", { timeFormat: e.target.value })}
              >
                <option value="12h">12-hour</option>
                <option value="12h-seconds">12-hour with seconds</option>
                <option value="24h">24-hour</option>
                <option value="24h-seconds">24-hour with seconds</option>
              </select>
            </SettingRow>

            <SettingRow label="Default event duration" description="Duration for new events">
              <select
                className="rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[44px] w-full sm:w-auto"
                value={settings.calendar?.defaultEventDuration ?? 60}
                onChange={(e) => updateSettings("calendar", { defaultEventDuration: Number(e.target.value) })}
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
              </select>
            </SettingRow>

            <SettingRow label="Ticker speed" description="Event ticker scroll speed">
              <select
                className="rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[44px] w-full sm:w-auto"
                value={settings.calendar?.tickerSpeed ?? "normal"}
                onChange={(e) => updateSettings("calendar", { tickerSpeed: e.target.value })}
              >
                <option value="slow">Slow</option>
                <option value="normal">Normal</option>
                <option value="fast">Fast</option>
              </select>
            </SettingRow>

            <SettingRow label="Week mode" description="Week view behavior">
              <select
                className="rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[44px] w-full sm:w-auto"
                value={settings.calendar?.weekMode ?? "current"}
                onChange={(e) => updateSettings("calendar", { weekMode: e.target.value })}
              >
                <option value="current">Current week</option>
                <option value="rolling">Rolling 7 days</option>
              </select>
            </SettingRow>

            <SettingRow label="Month mode" description="Month view behavior">
              <select
                className="rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[44px] w-full sm:w-auto"
                value={settings.calendar?.monthMode ?? "current"}
                onChange={(e) => updateSettings("calendar", { monthMode: e.target.value })}
              >
                <option value="current">Current month</option>
                <option value="rolling">Rolling 4 weeks</option>
              </select>
            </SettingRow>

            <SettingRow label="Week view widget" description="Widget in the 8th cell of week view">
              <select
                className="rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[44px] w-full sm:w-auto"
                value={settings.calendar?.weekCellWidget ?? "next-week"}
                onChange={(e) => updateSettings("calendar", { weekCellWidget: e.target.value })}
              >
                <option value="next-week">Next Week</option>
                <option value="camera">Camera</option>
                <option value="map">Map</option>
                <option value="spotify">Spotify</option>
                <option value="home-control">Home Control</option>
              </select>
            </SettingRow>

            <SettingRow label="Auto refresh interval" description="Minutes between data refreshes (0 = off)">
              <select
                className="rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[44px] w-full sm:w-auto"
                value={settings.calendar?.autoRefreshInterval ?? 0}
                onChange={(e) => updateSettings("calendar", { autoRefreshInterval: Number(e.target.value) })}
              >
                <option value={0}>Off</option>
                <option value={1}>1 minute</option>
                <option value={5}>5 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
              </select>
            </SettingRow>

            <SettingRow label="Show drive time" description="Display driving time on next event">
              <ToggleSwitch
                checked={settings.calendar?.showDriveTimeOnNext ?? false}
                onChange={(v) => updateSettings("calendar", { showDriveTimeOnNext: v })}
              />
            </SettingRow>

            <SettingRow label="Show week numbers" description="Display week numbers in calendar">
              <ToggleSwitch
                checked={settings.calendar?.showWeekNumbers ?? false}
                onChange={(v) => updateSettings("calendar", { showWeekNumbers: v })}
              />
            </SettingRow>

            {/* Calendar selection checkboxes */}
            <CalendarSelectionSection
              kiosk={kiosk}
              onUpdate={(ids) => updateKiosk.mutate({ selectedCalendarIds: ids })}
            />
          </CardContent>
        )}
      </Card>

      {/* Tasks Section */}
      <Card className="border-2 border-primary/40 overflow-hidden">
        <SectionHeader id="tasks" icon={<ListTodo />} title="Tasks" description="Layout and display preferences" isCollapsed={!!collapsedSections.tasks} onToggle={toggleSection} />
        {!collapsedSections.tasks && (
          <CardContent className="space-y-4 border-t border-border/50">
            <SettingRow label="Layout" description="How tasks are displayed">
              <select
                className="rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[44px] w-full sm:w-auto"
                value={settings.tasks?.layout ?? "lists"}
                onChange={(e) => updateSettings("tasks", { layout: e.target.value })}
              >
                <option value="lists">Collapsible Lists</option>
                <option value="grid">Grid</option>
                <option value="columns">Columns (Side-by-Side)</option>
                <option value="kanban">Kanban (By Status)</option>
              </select>
            </SettingRow>

            <SettingRow label="Show completed tasks" description="Display completed tasks by default">
              <ToggleSwitch
                checked={settings.tasks?.showCompleted ?? false}
                onChange={(v) => updateSettings("tasks", { showCompleted: v })}
              />
            </SettingRow>

            <SettingRow label="Expand all lists" description="Auto-expand all task lists (Lists layout)">
              <ToggleSwitch
                checked={settings.tasks?.expandAllLists ?? false}
                onChange={(v) => updateSettings("tasks", { expandAllLists: v })}
              />
            </SettingRow>
          </CardContent>
        )}
      </Card>

      {/* Spotify Section (module-gated) */}
      {isModuleEnabled("spotify") && (
        <Card className="border-2 border-primary/40 overflow-hidden">
          <SectionHeader id="spotify" icon={<Music />} title="Spotify" description="Account assignment for this kiosk" isCollapsed={!!collapsedSections.spotify} onToggle={toggleSection} />
          {!collapsedSections.spotify && (
            <CardContent className="space-y-4 border-t border-border/50">
              <SpotifyAccountPicker
                selectedTokenId={settings.spotify?.oauthTokenId}
                onSelect={(tokenId) => updateSettings("spotify", { oauthTokenId: tokenId })}
              />
            </CardContent>
          )}
        </Card>
      )}

      {/* Screensaver Section */}
      <Card className="border-2 border-primary/40 overflow-hidden">
        <SectionHeader id="screensaver" icon={<Monitor />} title="Screensaver" description="Timeout, behavior, and layout" isCollapsed={!!collapsedSections.screensaver} onToggle={toggleSection} />
        {!collapsedSections.screensaver && (
          <CardContent className="space-y-4 border-t border-border/50">
            <SettingRow label="Enabled" description="Enable screensaver on idle">
              <ToggleSwitch
                checked={kiosk.screensaverEnabled}
                onChange={(v) => updateKiosk.mutate({ screensaverEnabled: v })}
              />
            </SettingRow>

            <SettingRow label="Idle timeout" description="Seconds before screensaver activates">
              <select
                className="rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[44px] w-full sm:w-auto"
                value={kiosk.screensaverTimeout}
                onChange={(e) => updateKiosk.mutate({ screensaverTimeout: Number(e.target.value) })}
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

            <SettingRow label="Behavior" description="What happens when screensaver activates">
              <select
                className="rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[44px] w-full sm:w-auto"
                value={kiosk.screensaverBehavior}
                onChange={(e) => updateKiosk.mutate({ screensaverBehavior: e.target.value as any })}
              >
                <option value="screensaver">Full screensaver</option>
                <option value="hide-toolbar">Hide toolbar only</option>
              </select>
            </SettingRow>

            <SettingRow label="Slide interval" description="Seconds between photo slides">
              <select
                className="rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[44px] w-full sm:w-auto"
                value={kiosk.screensaverInterval}
                onChange={(e) => updateKiosk.mutate({ screensaverInterval: Number(e.target.value) })}
              >
                <option value={5}>5 seconds</option>
                <option value={10}>10 seconds</option>
                <option value={15}>15 seconds</option>
                <option value={30}>30 seconds</option>
                <option value={60}>1 minute</option>
              </select>
            </SettingRow>

            <SettingRow label="Layout" description="Screensaver display layout">
              <select
                className="rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[44px] w-full sm:w-auto"
                value={kiosk.screensaverLayout}
                onChange={(e) => updateKiosk.mutate({ screensaverLayout: e.target.value as any })}
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
                onChange={(e) => updateKiosk.mutate({ screensaverTransition: e.target.value as any })}
              >
                <option value="fade">Fade</option>
                <option value="slide-left">Slide Left</option>
                <option value="slide-right">Slide Right</option>
                <option value="slide-up">Slide Up</option>
                <option value="slide-down">Slide Down</option>
                <option value="zoom">Zoom</option>
              </select>
            </SettingRow>
          </CardContent>
        )}
      </Card>

      {/* Sidebar Section */}
      <Card className="border-2 border-primary/40 overflow-hidden">
        <SectionHeader id="sidebar" icon={<PanelLeft />} title="Sidebar" description="Choose which features appear in the sidebar" isCollapsed={!!collapsedSections.sidebar} onToggle={toggleSection} />
        {!collapsedSections.sidebar && (
          <CardContent className="border-t border-border/50">
            <div className="divide-y divide-border/50">
              {SIDEBAR_FEATURES.map((feature) => {
                const sidebarSettings = settings.sidebar ?? {};
                const featureState = sidebarSettings[feature] ?? { enabled: true, pinned: false };
                return (
                  <div key={feature} className="flex items-center justify-between py-3">
                    <span className="font-medium">{SIDEBAR_FEATURE_LABELS[feature] ?? feature}</span>
                    <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={featureState.enabled !== false}
                        onChange={(e) => {
                          const current = settings.sidebar ?? {};
                          updateKiosk.mutate({
                            settings: {
                              ...settings,
                              sidebar: {
                                ...current,
                                [feature]: { ...current[feature], enabled: e.target.checked },
                              },
                            },
                          });
                        }}
                        className="rounded"
                      />
                      Visible
                    </label>
                  </div>
                );
              })}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Features Section */}
      <Card className="border-2 border-primary/40 overflow-hidden">
        <SectionHeader id="features" icon={<Puzzle />} title="Features" description="Enable or disable features for this kiosk" isCollapsed={!!collapsedSections.features} onToggle={toggleSection} />
        {!collapsedSections.features && (
          <CardContent className="border-t border-border/50">
            <div className="divide-y divide-border/50">
              {FEATURE_OPTIONS.filter((opt) => !opt.moduleId || isModuleEnabled(opt.moduleId)).map((opt) => {
                const features = kiosk.enabledFeatures ?? {};
                const enabled = features[opt.key] !== false;
                return (
                  <div key={opt.key} className="flex items-center justify-between py-3">
                    <span className="font-medium">{opt.label}</span>
                    <ToggleSwitch
                      checked={enabled}
                      onChange={(v) => {
                        updateKiosk.mutate({
                          enabledFeatures: { ...features, [opt.key]: v },
                        });
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Table-backed sections rendered via slot */}
      {renderTableSections?.(kiosk)}
    </div>
  );
}

// Calendar selection sub-component
function CalendarSelectionSection({ kiosk, onUpdate }: { kiosk: Kiosk; onUpdate: (ids: string[] | null) => void }) {
  const { data: calendarsData } = useQuery({
    queryKey: ["calendars"],
    queryFn: () => api.getCalendars(),
  });

  const calendars = calendarsData ?? [];
  const selectedIds = kiosk.selectedCalendarIds ?? [];
  const allSelected = selectedIds.length === 0; // empty = all

  return (
    <div className="space-y-2">
      <div>
        <p className="font-medium">Visible calendars</p>
        <p className="text-sm text-muted-foreground">
          Which calendars to show on this kiosk (none selected = all visible)
        </p>
      </div>
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {calendars.map((cal) => (
          <label key={cal.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={allSelected || selectedIds.includes(cal.id)}
              onChange={(e) => {
                if (allSelected) {
                  // Switching from "all" to specific selection
                  const allIds = calendars.map((c) => c.id);
                  if (!e.target.checked) {
                    onUpdate(allIds.filter((id) => id !== cal.id));
                  }
                } else {
                  if (e.target.checked) {
                    const newIds = [...selectedIds, cal.id];
                    // If all are now selected, clear to "all"
                    if (newIds.length === calendars.length) {
                      onUpdate(null);
                    } else {
                      onUpdate(newIds);
                    }
                  } else {
                    onUpdate(selectedIds.filter((id) => id !== cal.id));
                  }
                }
              }}
              className="rounded"
            />
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: (cal as any).color ?? "#666" }}
            />
            {cal.name}
          </label>
        ))}
      </div>
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
