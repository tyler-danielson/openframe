import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, Trash2, Check, X, Plus, Pencil, ChevronDown, ChevronUp, Monitor, MonitorOff, RotateCcw, Timer } from "lucide-react";
import type { Calendar, CalendarProvider, CalendarEvent, FavoriteSportsTeam } from "@openframe/shared";
import type { Kiosk } from "../../services/api";
import { Button } from "../ui/Button";

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

type CalendarUpdate = Partial<Calendar>;

interface CalendarConnectionsViewProps {
  accountKey: string;
  calendars: Calendar[];
  favoriteTeams: FavoriteSportsTeam[];
  events?: CalendarEvent[];
  kiosks?: Kiosk[];
  onRevokeKioskAccess?: (calendarId: string, kioskId: string) => void;
  onUpdateCalendar: (id: string, updates: CalendarUpdate) => void;
  onDeleteCalendar?: (id: string) => void;
  onConnect: (provider: CalendarProvider) => void;
  onManageTeams: () => void;
}

function getKiosksUsingCalendar(calendarId: string, kiosks: Kiosk[]): Kiosk[] {
  return kiosks.filter(kiosk => {
    if (!kiosk.isActive) return false;
    // Legacy: selectedCalendarIds
    if (kiosk.selectedCalendarIds === null) return true;
    if (kiosk.selectedCalendarIds?.includes(calendarId)) return true;
    // Modern: dashboard viewCalendars
    const calDash = kiosk.dashboards?.find(d => d.type === "calendar");
    if (!calDash) return false;
    const vc = calDash.config?.viewCalendars as Record<string, string[] | null> | undefined;
    if (!vc) return false;
    return Object.values(vc).some(ids => ids === null || ids.includes(calendarId));
  });
}

export function CalendarConnectionsView({
  accountKey,
  calendars,
  favoriteTeams,
  events,
  kiosks,
  onRevokeKioskAccess,
  onUpdateCalendar,
  onDeleteCalendar,
  onConnect,
  onManageTeams,
}: CalendarConnectionsViewProps) {
  const isSports = accountKey === "sports";

  // Filter calendars for this account
  const accountCalendars = useMemo(() => {
    if (isSports) return [];
    if (accountKey.startsWith("oauth:")) {
      const tokenId = accountKey.replace("oauth:", "");
      return calendars.filter((c) => c.oauthTokenId === tokenId);
    }
    if (accountKey.startsWith("provider:")) {
      const provider = accountKey.replace("provider:", "");
      return calendars.filter((c) => c.provider === provider && !c.oauthTokenId);
    }
    return [];
  }, [accountKey, calendars, isSports]);

  const sortedCalendars = useMemo(
    () =>
      [...accountCalendars].sort((a, b) => {
        if (a.isVisible && !b.isVisible) return -1;
        if (!a.isVisible && b.isVisible) return 1;
        return a.name.localeCompare(b.name);
      }),
    [accountCalendars]
  );

  const provider: CalendarProvider = isSports
    ? "sports"
    : (accountCalendars[0]?.provider ?? "local");

  // Sports teams view
  if (isSports) {
    return (
      <div className="space-y-1">
        {favoriteTeams.map((team) => (
          <div
            key={team.id}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-md border transition-colors ${
              team.isVisible
                ? "border-border"
                : "border-border/50 opacity-50"
            }`}
          >
            {team.teamLogo ? (
              <img
                src={team.teamLogo}
                alt={team.teamName}
                className="w-5 h-5 object-contain shrink-0"
              />
            ) : (
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: team.teamColor ?? "#6366f1" }}
              />
            )}
            <span className="text-sm truncate flex-1">{team.teamName}</span>
            <span className="text-xs text-muted-foreground shrink-0">{team.league.toUpperCase()}</span>
          </div>
        ))}
        <div className="pt-2">
          <Button variant="outline" size="sm" onClick={onManageTeams}>
            Manage Teams
          </Button>
        </div>
      </div>
    );
  }

  // Calendar list for a single account
  return (
    <div className="space-y-0.5">
      {sortedCalendars.map((cal) => (
        <CalendarRow
          key={cal.id}
          calendar={cal}
          events={events}
          kiosks={kiosks}
          onRevokeKioskAccess={onRevokeKioskAccess}
          onUpdate={(updates) => onUpdateCalendar(cal.id, updates)}
          onDelete={
            onDeleteCalendar ? () => onDeleteCalendar(cal.id) : undefined
          }
        />
      ))}

      {sortedCalendars.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No calendars found for this account
        </p>
      )}

      {/* Provider-specific actions */}
      <div className="flex flex-wrap gap-2 pt-3">
        {provider === "local" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onConnect("local")}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Create Calendar
          </Button>
        )}
        {provider === "ics" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onConnect("ics")}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Subscribe to Calendar
          </Button>
        )}
        {provider === "homeassistant" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onConnect("homeassistant")}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Calendar
          </Button>
        )}
      </div>
    </div>
  );
}

// --- Single calendar row (compact) ---

function formatEventTime(event: CalendarEvent): string {
  const start = new Date(event.startTime);
  const end = new Date(event.endTime);
  if (event.isAllDay) {
    return start.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " (all day)";
  }
  const dateStr = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const startStr = start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const endStr = end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${dateStr}, ${startStr} - ${endStr}`;
}

function CalendarRow({
  calendar,
  events,
  kiosks,
  onRevokeKioskAccess,
  onUpdate,
  onDelete,
}: {
  calendar: Calendar;
  events?: CalendarEvent[];
  kiosks?: Kiosk[];
  onRevokeKioskAccess?: (calendarId: string, kioskId: string) => void;
  onUpdate: (updates: CalendarUpdate) => void;
  onDelete?: () => void;
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(calendar.name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEvents, setShowEvents] = useState(false);
  const [showKiosks, setShowKiosks] = useState(false);
  const [showSyncInterval, setShowSyncInterval] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const todayMarkerRef = useRef<HTMLDivElement>(null);
  const isLocal = calendar.provider === "local";
  const canDelete = calendar.provider === "local" || calendar.provider === "ics";

  const calendarEvents = useMemo(() => {
    if (!events) return [];
    return events
      .filter((e) => e.calendarId === calendar.id)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [events, calendar.id]);

  const kiosksUsingCalendar = useMemo(() => {
    if (!kiosks) return [];
    return getKiosksUsingCalendar(calendar.id, kiosks);
  }, [kiosks, calendar.id]);

  // Index of the first event starting today or later
  const todayStartIndex = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return calendarEvents.findIndex((e) => new Date(e.startTime) >= todayStart);
  }, [calendarEvents]);

  // Scroll to today when events panel opens
  useEffect(() => {
    if (showEvents && todayMarkerRef.current && previewRef.current) {
      todayMarkerRef.current.scrollIntoView({ block: "start" });
    }
  }, [showEvents]);

  return (
    <div>
      {/* Compact row */}
      <div
        className={`flex items-center gap-2 px-2 py-1 rounded-md transition-colors ${
          calendar.isVisible
            ? "hover:bg-muted/30"
            : "opacity-50"
        }`}
      >
        {/* Color dot */}
        <div
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: calendar.color }}
        />

        {/* Name */}
        <div className="flex-1 min-w-0">
          {isRenaming ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && renameValue.trim()) {
                    if (isLocal) {
                      onUpdate({ name: renameValue.trim() });
                    } else {
                      onUpdate({ displayName: renameValue.trim() });
                    }
                    setIsRenaming(false);
                  } else if (e.key === "Escape") {
                    setRenameValue(calendar.name);
                    setIsRenaming(false);
                  }
                }}
                className="flex-1 min-w-0 px-1.5 py-0 text-sm rounded border border-primary bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                autoFocus
              />
              <button
                onClick={() => {
                  if (renameValue.trim()) {
                    if (isLocal) {
                      onUpdate({ name: renameValue.trim() });
                    } else {
                      onUpdate({ displayName: renameValue.trim() });
                    }
                    setIsRenaming(false);
                  }
                }}
                className="p-0.5 text-green-500 hover:text-green-600"
              >
                <Check className="h-3 w-3" />
              </button>
              {!isLocal && calendar.displayName && (
                <button
                  onClick={() => { onUpdate({ displayName: null }); setIsRenaming(false); }}
                  className="p-0.5 text-muted-foreground hover:text-destructive"
                  title="Reset to original name"
                >
                  <RotateCcw className="h-2.5 w-2.5" />
                </button>
              )}
              <button
                onClick={() => { setRenameValue(calendar.name); setIsRenaming(false); }}
                className="p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className={`text-sm truncate ${!calendar.isVisible ? "text-muted-foreground" : ""}`}>
                {calendar.name}
              </span>
              {calendar.originalName && (
                <span className="text-xs text-muted-foreground truncate">
                  ({calendar.originalName})
                </span>
              )}
              <button
                onClick={() => { setRenameValue(calendar.name); setIsRenaming(true); }}
                className="p-0.5 text-muted-foreground/0 hover:text-primary group-hover:text-muted-foreground/30 transition-colors shrink-0"
                title="Rename"
              >
                <Pencil className="h-2.5 w-2.5" />
              </button>
            </div>
          )}
        </div>

        {/* Kiosk count badge */}
        {kiosksUsingCalendar.length > 0 && (
          <button
            onClick={() => setShowKiosks(!showKiosks)}
            className={`flex items-center gap-0.5 text-xs shrink-0 rounded px-1 py-0.5 transition-colors ${
              showKiosks
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
            title={`Used by ${kiosksUsingCalendar.length} kiosk${kiosksUsingCalendar.length !== 1 ? "s" : ""}`}
          >
            <Monitor className="h-3 w-3" />
            <span>{kiosksUsingCalendar.length}</span>
          </button>
        )}

        {/* Event count + preview toggle */}
        <button
          onClick={() => setShowEvents(!showEvents)}
          className={`flex items-center gap-0.5 text-xs shrink-0 rounded px-1 py-0.5 transition-colors ${
            showEvents
              ? "text-primary bg-primary/10"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          }`}
          title={showEvents ? "Hide events" : "Preview events"}
        >
          <span>{calendarEvents.length}</span>
          {showEvents ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        {/* Sync interval toggle */}
        {calendar.provider !== "local" && (
          <button
            onClick={() => setShowSyncInterval(!showSyncInterval)}
            className={`p-0.5 rounded transition-colors shrink-0 ${
              showSyncInterval
                ? "text-primary bg-primary/10"
                : calendar.syncInterval
                ? "text-primary/60 hover:text-primary hover:bg-primary/10"
                : "text-muted-foreground/0 hover:text-foreground hover:bg-muted/50 group-hover:text-muted-foreground/30"
            }`}
            title={`Sync interval: ${calendar.syncInterval ? `${calendar.syncInterval}m` : "default"}`}
          >
            <Timer className="h-3 w-3" />
          </button>
        )}

        {/* Delete */}
        {canDelete && onDelete && (
          showDeleteConfirm ? (
            <div className="flex items-center gap-0.5 shrink-0">
              <button onClick={() => { onDelete(); setShowDeleteConfirm(false); }} className="p-0.5 text-red-500 hover:text-red-600" title="Confirm delete">
                <Check className="h-3 w-3" />
              </button>
              <button onClick={() => setShowDeleteConfirm(false)} className="p-0.5 text-muted-foreground hover:text-foreground" title="Cancel">
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-0.5 text-muted-foreground/0 hover:text-red-500 transition-colors shrink-0"
              title="Delete calendar"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )
        )}

        {/* Kiosk enabled toggle */}
        <button
          onClick={() => onUpdate({ kioskEnabled: !calendar.kioskEnabled })}
          className={`p-0.5 rounded transition-colors shrink-0 ${
            calendar.kioskEnabled
              ? "text-primary hover:bg-primary/10"
              : "text-muted-foreground/40 hover:text-foreground hover:bg-muted/50"
          }`}
          title={calendar.kioskEnabled ? "Disable for kiosks" : "Enable for kiosks"}
        >
          {calendar.kioskEnabled ? <Monitor className="h-3.5 w-3.5" /> : <MonitorOff className="h-3.5 w-3.5" />}
        </button>

        {/* Visibility toggle */}
        <button
          onClick={() => onUpdate({ isVisible: !calendar.isVisible })}
          className={`p-0.5 rounded transition-colors shrink-0 ${
            calendar.isVisible
              ? "text-primary hover:bg-primary/10"
              : "text-muted-foreground/40 hover:text-foreground hover:bg-muted/50"
          }`}
          title={calendar.isVisible ? "Hide calendar" : "Show calendar"}
        >
          {calendar.isVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Kiosk access panel */}
      {showKiosks && kiosksUsingCalendar.length > 0 && (
        <div className="ml-5 mr-2 mb-1 border-l-2 border-primary/30 pl-3 py-1">
          <p className="text-xs font-medium text-primary mb-1">Kiosk Access</p>
          <div className="space-y-0.5">
            {kiosksUsingCalendar.map(kiosk => (
              <div key={kiosk.id} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground truncate">{kiosk.name}</span>
                {onRevokeKioskAccess && (
                  <button
                    onClick={() => onRevokeKioskAccess(calendar.id, kiosk.id)}
                    className="p-0.5 text-muted-foreground/40 hover:text-red-500 transition-colors shrink-0"
                    title={`Remove from ${kiosk.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sync interval panel */}
      {showSyncInterval && (
        <div className="ml-5 mr-2 mb-1 border-l-2 border-primary/30 pl-3 py-1.5">
          <p className="text-xs font-medium text-primary mb-1.5">Sync Interval</p>
          <div className="flex flex-wrap gap-1">
            {[
              { value: null, label: "Default" },
              { value: 1, label: "1m" },
              { value: 2, label: "2m" },
              { value: 5, label: "5m" },
              { value: 15, label: "15m" },
              { value: 30, label: "30m" },
              { value: 60, label: "1h" },
              { value: 360, label: "6h" },
              { value: 1440, label: "24h" },
            ].map((opt) => (
              <button
                key={opt.label}
                onClick={() => onUpdate({ syncInterval: opt.value } as CalendarUpdate)}
                className={`px-2 py-0.5 text-xs rounded transition-colors ${
                  calendar.syncInterval === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Default: {calendar.provider === "ics" || calendar.provider === "homeassistant" ? "15 min" : "2 min"}
            {calendar.lastSyncAt && (
              <> · Last synced {new Date(calendar.lastSyncAt).toLocaleString()} ({formatTimeAgo(new Date(calendar.lastSyncAt))})</>
            )}
          </p>
        </div>
      )}

      {/* Event preview panel */}
      {showEvents && (
        <div className="ml-5 mr-2 mb-1 border-l-2 border-border pl-3 py-1">
          {calendarEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No events in range</p>
          ) : (
            <div ref={previewRef} className="space-y-0.5 max-h-48 overflow-y-auto">
              {calendarEvents.map((evt, i) => (
                <div
                  key={evt.id}
                  ref={i === todayStartIndex ? todayMarkerRef : undefined}
                  className="flex items-baseline gap-2 text-xs"
                >
                  <span className="text-muted-foreground shrink-0 w-36">{formatEventTime(evt)}</span>
                  <span className={`truncate ${evt.status === "cancelled" ? "line-through text-muted-foreground" : ""}`}>
                    {evt.title || "(No title)"}
                  </span>
                  {evt.location && (
                    <span className="text-muted-foreground/60 truncate shrink-0 max-w-32">@ {evt.location}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
