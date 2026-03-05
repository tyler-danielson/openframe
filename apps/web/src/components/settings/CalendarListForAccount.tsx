import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Crown, Eye, EyeOff, ExternalLink, RefreshCw, ChevronDown, ChevronRight, User, Pencil, Trash2, Plus, Check, X } from "lucide-react";
import type { Calendar, CalendarProvider, CalendarVisibility, CalendarEvent, FavoriteSportsTeam } from "@openframe/shared";
import { ToggleGroup } from "../ui/Toggle";
import { Button } from "../ui/Button";

// Allow partial visibility updates
type CalendarUpdate = Omit<Partial<Calendar>, 'visibility'> & { visibility?: Partial<CalendarVisibility> };
type TeamUpdate = Omit<Partial<FavoriteSportsTeam>, 'visibility'> & { visibility?: Partial<CalendarVisibility> };

interface CalendarListForAccountProps {
  provider: CalendarProvider;
  calendars: Calendar[];
  favoriteTeams: FavoriteSportsTeam[];
  events?: CalendarEvent[];
  onUpdateCalendar: (id: string, updates: CalendarUpdate) => void;
  onUpdateTeam: (id: string, updates: TeamUpdate) => void;
  onConnect: () => void;
  onManageTeams: () => void;
  onDeleteCalendar?: (id: string) => void;
}

// Default visibility for calendars without visibility set
const DEFAULT_VISIBILITY: CalendarVisibility = {
  week: false,
  month: false,
  day: false,
  popup: true,
  screensaver: false,
};

// Provider display configuration
const PROVIDER_CONFIG: Record<
  CalendarProvider,
  {
    name: string;
    connectLabel: string;
    description: string;
  }
> = {
  google: {
    name: "Google Calendar",
    connectLabel: "Connect Google Calendar",
    description: "Sign in with Google to sync your calendars, events, and tasks.",
  },
  microsoft: {
    name: "Microsoft Outlook",
    connectLabel: "Connect Microsoft Outlook",
    description: "Connect your Microsoft 365 or Outlook.com account.",
  },
  caldav: {
    name: "CalDAV",
    connectLabel: "Add CalDAV Account",
    description: "Connect calendars from iCloud, Fastmail, or any CalDAV provider.",
  },
  ics: {
    name: "ICS Subscription",
    connectLabel: "Subscribe to Calendar",
    description: "Subscribe to a .ics calendar feed URL to display events from external sources.",
  },
  sports: {
    name: "Sports",
    connectLabel: "Add Teams",
    description: "Follow your favorite sports teams to see their game schedules on your calendar.",
  },
  homeassistant: {
    name: "Home Assistant",
    connectLabel: "Add Calendar",
    description: "Subscribe to calendars from your Home Assistant instance.",
  },
  local: {
    name: "My Calendars",
    connectLabel: "Create Calendar",
    description: "Create calendars that live only in OpenFrame.",
  },
};

// Sort calendars: primary -> favorites -> read-write -> alphabetical
function sortCalendars(cals: Calendar[]): Calendar[] {
  return [...cals].sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    if (a.isFavorite && !b.isFavorite) return -1;
    if (!a.isFavorite && b.isFavorite) return 1;
    if (!a.isReadOnly && b.isReadOnly) return -1;
    if (a.isReadOnly && !b.isReadOnly) return 1;
    return a.name.localeCompare(b.name);
  });
}

interface AccountGroup {
  key: string;
  label: string;
  calendars: Calendar[];
}

function CalendarRow({
  calendar,
  events,
  onUpdateCalendar,
  onDeleteCalendar,
}: {
  calendar: Calendar;
  events?: CalendarEvent[];
  onUpdateCalendar: (id: string, updates: CalendarUpdate) => void;
  onDeleteCalendar?: (id: string) => void;
}) {
  const [showPreview, setShowPreview] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(calendar.name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const isLocal = calendar.provider === "local";
  const visibility = calendar.visibility ?? DEFAULT_VISIBILITY;

  // Get upcoming events for this calendar
  const calendarEvents = useMemo(() => {
    if (!events) return [];
    const now = new Date();
    return events
      .filter((e) => e.calendarId === calendar.id && new Date(e.startTime) >= now)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .slice(0, 5);
  }, [events, calendar.id]);

  // Also get recent past events if no upcoming
  const recentEvents = useMemo(() => {
    if (!events || calendarEvents.length > 0) return [];
    return events
      .filter((e) => e.calendarId === calendar.id)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, 5);
  }, [events, calendar.id, calendarEvents]);

  const previewEvents = calendarEvents.length > 0 ? calendarEvents : recentEvents;
  const hasEvents = events && events.some((e) => e.calendarId === calendar.id);

  return (
    <div>
      <motion.div
        layout
        layoutId={`cal-${calendar.id}`}
        initial={false}
        className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
          calendar.isPrimary
            ? "border-primary/50 bg-primary/5"
            : calendar.isFavorite
            ? "border-yellow-500/30 bg-yellow-500/5"
            : "border-border hover:bg-muted/50"
        }`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Hide button */}
          <button
            type="button"
            onClick={() => onUpdateCalendar(calendar.id, { isVisible: false })}
            className="p-1 rounded-md text-muted-foreground/40 hover:text-muted-foreground transition-colors flex-shrink-0"
            title="Hide calendar"
          >
            <EyeOff className="h-4 w-4" />
          </button>

          {/* Set as primary */}
          <button
            type="button"
            onClick={() => onUpdateCalendar(calendar.id, { isPrimary: true })}
            className={`p-1 rounded-md transition-colors flex-shrink-0 ${
              calendar.isPrimary
                ? "text-primary"
                : "text-muted-foreground/40 hover:text-primary"
            }`}
            title={calendar.isPrimary ? "Primary calendar" : "Set as primary"}
            disabled={calendar.isPrimary}
          >
            <Crown className={`h-4 w-4 ${calendar.isPrimary ? "fill-current" : ""}`} />
          </button>

          {/* Favorite star */}
          <button
            type="button"
            onClick={() => onUpdateCalendar(calendar.id, { isFavorite: !calendar.isFavorite })}
            className={`p-1 rounded-md transition-colors flex-shrink-0 ${
              calendar.isFavorite
                ? "text-yellow-500 hover:text-yellow-600"
                : "text-muted-foreground/40 hover:text-yellow-500"
            }`}
            title={calendar.isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Star className={`h-4 w-4 ${calendar.isFavorite ? "fill-current" : ""}`} />
          </button>

          {/* Color indicator */}
          <div
            className="h-4 w-4 rounded-md flex-shrink-0"
            style={{ backgroundColor: calendar.color }}
          />

          {/* Calendar name + preview toggle */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {isRenaming ? (
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && renameValue.trim()) {
                        onUpdateCalendar(calendar.id, { name: renameValue.trim() });
                        setIsRenaming(false);
                      } else if (e.key === "Escape") {
                        setRenameValue(calendar.name);
                        setIsRenaming(false);
                      }
                    }}
                    className="flex-1 min-w-0 px-2 py-0.5 text-sm rounded border border-primary bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (renameValue.trim()) {
                        onUpdateCalendar(calendar.id, { name: renameValue.trim() });
                        setIsRenaming(false);
                      }
                    }}
                    className="p-0.5 text-green-500 hover:text-green-600"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRenameValue(calendar.name);
                      setIsRenaming(false);
                    }}
                    className="p-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => hasEvents && setShowPreview(!showPreview)}
                    className={`font-medium truncate text-left ${hasEvents ? "hover:text-primary cursor-pointer" : ""}`}
                    title={hasEvents ? "Click to preview events" : undefined}
                  >
                    {calendar.name}
                  </button>
                  {isLocal && (
                    <button
                      type="button"
                      onClick={() => {
                        setRenameValue(calendar.name);
                        setIsRenaming(true);
                      }}
                      className="p-0.5 text-muted-foreground/40 hover:text-primary transition-colors flex-shrink-0"
                      title="Rename calendar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {hasEvents && (
                    <button
                      type="button"
                      onClick={() => setShowPreview(!showPreview)}
                      className="p-0.5 text-muted-foreground/40 hover:text-primary transition-colors flex-shrink-0"
                    >
                      {showPreview ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                  {calendar.isPrimary && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary/20 text-primary text-xs font-medium flex-shrink-0">
                      <Crown className="h-3 w-3" />
                      Primary
                    </span>
                  )}
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {calendar.isReadOnly ? "Read-only" : "Read-write"}
            </p>
          </div>

          {/* Delete button for local calendars */}
          {isLocal && onDeleteCalendar && !showDeleteConfirm && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="p-1 rounded-md text-muted-foreground/40 hover:text-red-500 transition-colors flex-shrink-0 mr-2"
              title="Delete calendar"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          {isLocal && showDeleteConfirm && (
            <div className="flex items-center gap-1 mr-2 flex-shrink-0">
              <span className="text-xs text-red-500">Delete?</span>
              <button
                type="button"
                onClick={() => {
                  onDeleteCalendar?.(calendar.id);
                  setShowDeleteConfirm(false);
                }}
                className="p-0.5 text-red-500 hover:text-red-600"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Visibility toggles */}
        <ToggleGroup
          items={[
            {
              key: "week",
              label: "Week",
              checked: visibility.week,
              onChange: (checked) =>
                onUpdateCalendar(calendar.id, {
                  visibility: { ...visibility, week: checked },
                }),
            },
            {
              key: "month",
              label: "Month",
              checked: visibility.month,
              onChange: (checked) =>
                onUpdateCalendar(calendar.id, {
                  visibility: { ...visibility, month: checked },
                }),
            },
            {
              key: "day",
              label: "Day",
              checked: visibility.day,
              onChange: (checked) =>
                onUpdateCalendar(calendar.id, {
                  visibility: { ...visibility, day: checked },
                }),
            },
            {
              key: "popup",
              label: "Popup",
              checked: visibility.popup,
              onChange: (checked) =>
                onUpdateCalendar(calendar.id, {
                  visibility: { ...visibility, popup: checked },
                }),
            },
            {
              key: "screensaver",
              label: "Custom Screen",
              checked: visibility.screensaver,
              onChange: (checked) =>
                onUpdateCalendar(calendar.id, {
                  visibility: { ...visibility, screensaver: checked },
                }),
            },
          ]}
        />
      </motion.div>

      {/* Event preview */}
      <AnimatePresence>
        {showPreview && previewEvents.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden ml-8 mr-2"
          >
            <div className="py-2 space-y-1">
              {previewEvents.map((event) => {
                const start = new Date(event.startTime);
                const isUpcoming = start >= new Date();
                return (
                  <div
                    key={event.id}
                    className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-md bg-muted/30"
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: calendar.color }}
                    />
                    <span className={`font-medium tabular-nums flex-shrink-0 ${isUpcoming ? "text-primary" : "text-muted-foreground"}`}>
                      {event.isAllDay
                        ? start.toLocaleDateString(undefined, { month: "short", day: "numeric" })
                        : start.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
                          " " +
                          start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                    </span>
                    <span className="truncate text-muted-foreground">
                      {event.title}
                    </span>
                  </div>
                );
              })}
              {!calendarEvents.length && recentEvents.length > 0 && (
                <p className="text-xs text-muted-foreground/60 px-3 italic">
                  No upcoming events — showing recent
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function CalendarListForAccount({
  provider,
  calendars,
  favoriteTeams,
  events,
  onUpdateCalendar,
  onUpdateTeam,
  onConnect,
  onManageTeams,
  onDeleteCalendar,
}: CalendarListForAccountProps) {
  const config = PROVIDER_CONFIG[provider];

  // Filter calendars for this provider
  const providerCalendars = useMemo(() => {
    return calendars.filter((c) => c.provider === provider);
  }, [calendars, provider]);

  // Group calendars by account
  const accountGroups = useMemo(() => {
    const groups = new Map<string, Calendar[]>();

    for (const cal of providerCalendars) {
      const key = cal.oauthTokenId || "unlinked";
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(cal);
    }

    // Convert to array with labels
    const result: AccountGroup[] = [];
    for (const [key, cals] of groups) {
      const label = cals[0]?.accountLabel || "";
      result.push({ key, label, calendars: sortCalendars(cals) });
    }

    return result;
  }, [providerCalendars]);

  const hasMultipleAccounts = accountGroups.length > 1;

  // Flat sorted list for single-account view
  const sortedCalendars = useMemo(() => sortCalendars(providerCalendars), [providerCalendars]);

  // Separate visible and hidden calendars
  const { visibleCalendars, hiddenCalendars } = useMemo(() => {
    return {
      visibleCalendars: sortedCalendars.filter((c) => c.isVisible),
      hiddenCalendars: sortedCalendars.filter((c) => !c.isVisible),
    };
  }, [sortedCalendars]);

  // Check if provider is connected
  const isConnected = provider === "sports" ? favoriteTeams.length > 0 : providerCalendars.length > 0;

  // Render empty state for unconnected providers
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="max-w-sm space-y-4">
          <h3 className="text-lg font-semibold">{config.name}</h3>
          <p className="text-sm text-muted-foreground">{config.description}</p>
          <Button onClick={onConnect} className="mt-4">
            <ExternalLink className="mr-2 h-4 w-4" />
            {config.connectLabel}
          </Button>
        </div>
      </div>
    );
  }

  // Render sports teams
  if (provider === "sports") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <h3 className="text-sm font-medium text-muted-foreground">
            Favorite Teams ({favoriteTeams.length})
          </h3>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {(["week", "month", "day", "popup", "screensaver"] as const).map((view) => (
                <span
                  key={view}
                  className="px-2 py-1 text-xs font-medium text-muted-foreground"
                >
                  {view.charAt(0).toUpperCase() + view.slice(1)}
                </span>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={onManageTeams}>
              Manage Teams
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {favoriteTeams.map((team) => {
            const visibility = team.visibility || DEFAULT_VISIBILITY;
            return (
              <div
                key={team.id}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div className="flex items-center gap-3">
                  {team.teamLogo && (
                    <img
                      src={team.teamLogo}
                      alt={team.teamName}
                      className="h-8 w-8 object-contain"
                    />
                  )}
                  <div>
                    <p className="font-medium">{team.teamName}</p>
                    <p className="text-xs text-muted-foreground uppercase">
                      {team.league}
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
                        onUpdateTeam(team.id, { visibility: { week: checked } }),
                    },
                    {
                      key: "month",
                      label: "Month",
                      checked: visibility.month,
                      onChange: (checked) =>
                        onUpdateTeam(team.id, { visibility: { month: checked } }),
                    },
                    {
                      key: "day",
                      label: "Day",
                      checked: visibility.day,
                      onChange: (checked) =>
                        onUpdateTeam(team.id, { visibility: { day: checked } }),
                    },
                    {
                      key: "popup",
                      label: "Popup",
                      checked: visibility.popup,
                      onChange: (checked) =>
                        onUpdateTeam(team.id, { visibility: { popup: checked } }),
                    },
                    {
                      key: "screensaver",
                      label: "Custom Screen",
                      checked: visibility.screensaver,
                      onChange: (checked) =>
                        onUpdateTeam(team.id, { visibility: { screensaver: checked } }),
                    },
                  ]}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Render calendars list
  return (
    <div className="space-y-4">
      {/* Header with column labels */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <h3 className="text-sm font-medium text-muted-foreground">
          Calendars ({visibleCalendars.length})
        </h3>
        <div className="flex items-center gap-1">
          {(["week", "month", "day", "popup", "screensaver"] as const).map((view) => (
            <span
              key={view}
              className="px-2 py-1 text-xs font-medium text-muted-foreground"
            >
              {view.charAt(0).toUpperCase() + view.slice(1)}
            </span>
          ))}
        </div>
      </div>

      {/* Calendar list - grouped by account if multiple accounts */}
      {hasMultipleAccounts ? (
        <div className="space-y-6">
          {accountGroups.map((group) => {
            const groupVisible = group.calendars.filter((c) => c.isVisible);
            const groupHidden = group.calendars.filter((c) => !c.isVisible);
            if (groupVisible.length === 0 && groupHidden.length === 0) return null;

            return (
              <div key={group.key} className="space-y-2">
                {/* Account header */}
                <div className="flex items-center gap-2 py-1">
                  <User className="h-3.5 w-3.5 text-primary" />
                  <span className="text-sm font-medium text-primary">
                    {group.label || "Unknown Account"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({groupVisible.length} calendar{groupVisible.length !== 1 ? "s" : ""})
                  </span>
                </div>

                {/* Visible calendars for this account */}
                <motion.div className="space-y-2" layoutScroll>
                  <AnimatePresence mode="popLayout">
                    {groupVisible.map((calendar) => (
                      <CalendarRow
                        key={calendar.id}
                        calendar={calendar}
                        events={events}
                        onUpdateCalendar={onUpdateCalendar}
                        onDeleteCalendar={onDeleteCalendar}
                      />
                    ))}
                  </AnimatePresence>
                </motion.div>

                {/* Hidden calendars for this account */}
                {groupHidden.length > 0 && (
                  <details className="group ml-5">
                    <summary className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer list-none">
                      <EyeOff className="h-3.5 w-3.5" />
                      <span>{groupHidden.length} hidden</span>
                    </summary>
                    <div className="mt-2 space-y-1">
                      {groupHidden.map((calendar) => (
                        <div
                          key={calendar.id}
                          className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/30 p-2.5 opacity-60 hover:opacity-80 transition-opacity"
                        >
                          <button
                            type="button"
                            onClick={() => onUpdateCalendar(calendar.id, { isVisible: true })}
                            className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                            title="Show calendar"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <div
                            className="h-3.5 w-3.5 rounded-md"
                            style={{ backgroundColor: calendar.color }}
                          />
                          <span className="text-sm">{calendar.name}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Single account - flat list (original behavior) */
        <>
          <motion.div className="space-y-2" layoutScroll>
            <AnimatePresence mode="popLayout">
              {visibleCalendars.map((calendar) => (
                <CalendarRow
                  key={calendar.id}
                  calendar={calendar}
                  events={events}
                  onUpdateCalendar={onUpdateCalendar}
                  onDeleteCalendar={onDeleteCalendar}
                />
              ))}
            </AnimatePresence>
          </motion.div>

          {/* Hidden calendars section */}
          {hiddenCalendars.length > 0 && (
            <div className="mt-6 pt-4 border-t border-border">
              <details className="group">
                <summary className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer list-none">
                  <EyeOff className="h-4 w-4" />
                  <span>Hidden calendars ({hiddenCalendars.length})</span>
                </summary>
                <div className="mt-3 space-y-2">
                  {hiddenCalendars.map((calendar) => (
                    <div
                      key={calendar.id}
                      className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 p-3 opacity-60 hover:opacity-80 transition-opacity"
                    >
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => onUpdateCalendar(calendar.id, { isVisible: true })}
                          className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
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
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}
        </>
      )}

      {/* Add more calendars button */}
      {provider === "local" && (
        <div className="pt-4">
          <Button variant="outline" size="sm" onClick={onConnect}>
            <Plus className="mr-2 h-4 w-4" />
            Create Calendar
          </Button>
        </div>
      )}

      {provider !== "ics" && provider !== "local" && (
        <div className="pt-4">
          <Button variant="outline" size="sm" onClick={onConnect}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Reconnect to refresh calendars
          </Button>
        </div>
      )}

      {provider === "ics" && (
        <div className="pt-4">
          <Button variant="outline" size="sm" onClick={onConnect}>
            Subscribe to another calendar
          </Button>
        </div>
      )}
    </div>
  );
}
