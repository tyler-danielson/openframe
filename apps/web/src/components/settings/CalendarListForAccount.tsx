import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Crown, Eye, EyeOff, ExternalLink, RefreshCw } from "lucide-react";
import type { Calendar, CalendarProvider, CalendarVisibility, FavoriteSportsTeam } from "@openframe/shared";
import { ToggleGroup } from "../ui/Toggle";
import { Button } from "../ui/Button";

interface CalendarListForAccountProps {
  provider: CalendarProvider;
  calendars: Calendar[];
  favoriteTeams: FavoriteSportsTeam[];
  onUpdateCalendar: (id: string, updates: Partial<Calendar>) => void;
  onUpdateTeam: (id: string, updates: Partial<FavoriteSportsTeam>) => void;
  onConnect: () => void;
  onManageTeams: () => void;
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
};

export function CalendarListForAccount({
  provider,
  calendars,
  favoriteTeams,
  onUpdateCalendar,
  onUpdateTeam,
  onConnect,
  onManageTeams,
}: CalendarListForAccountProps) {
  const config = PROVIDER_CONFIG[provider];

  // Filter calendars for this provider
  const providerCalendars = useMemo(() => {
    return calendars.filter((c) => c.provider === provider);
  }, [calendars, provider]);

  // Sort calendars: primary -> favorites -> read-write -> alphabetical
  const sortedCalendars = useMemo(() => {
    return [...providerCalendars].sort((a, b) => {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      if (!a.isReadOnly && b.isReadOnly) return -1;
      if (a.isReadOnly && !b.isReadOnly) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [providerCalendars]);

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
                      label: "Screensaver",
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

      {/* Calendar list */}
      <motion.div className="space-y-2" layoutScroll>
        <AnimatePresence mode="popLayout">
          {visibleCalendars.map((calendar) => {
            const visibility = calendar.visibility ?? DEFAULT_VISIBILITY;
            return (
              <motion.div
                key={calendar.id}
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

                  {/* Calendar name */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{calendar.name}</p>
                      {calendar.isPrimary && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary/20 text-primary text-xs font-medium flex-shrink-0">
                          <Crown className="h-3 w-3" />
                          Primary
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {calendar.isReadOnly ? "Read-only" : "Read-write"}
                    </p>
                  </div>
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
                      label: "Screensaver",
                      checked: visibility.screensaver,
                      onChange: (checked) =>
                        onUpdateCalendar(calendar.id, {
                          visibility: { ...visibility, screensaver: checked },
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

      {/* Add more calendars button */}
      {provider !== "ics" && (
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
