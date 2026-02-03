import { useMemo } from "react";
import { Plus, RefreshCw, Check, AlertCircle } from "lucide-react";
import type { Calendar, CalendarProvider, FavoriteSportsTeam } from "@openframe/shared";
import { Button } from "../ui/Button";

// Provider display configuration
const PROVIDER_CONFIG: Record<
  CalendarProvider,
  {
    name: string;
    icon: React.ReactNode;
    bgColor: string;
    description: string;
  }
> = {
  google: {
    name: "Google Calendar",
    icon: (
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
    ),
    bgColor: "bg-red-500/10",
    description: "Connect your Google account to sync calendars",
  },
  microsoft: {
    name: "Microsoft Outlook",
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24">
        <path fill="#0078D4" d="M0 0h11.5v11.5H0z" />
        <path fill="#0078D4" d="M12.5 0H24v11.5H12.5z" />
        <path fill="#0078D4" d="M0 12.5h11.5V24H0z" />
        <path fill="#0078D4" d="M12.5 12.5H24V24H12.5z" />
      </svg>
    ),
    bgColor: "bg-blue-500/10",
    description: "Connect Microsoft 365 or Outlook calendars",
  },
  caldav: {
    name: "CalDAV",
    icon: <span className="text-lg">📅</span>,
    bgColor: "bg-purple-500/10",
    description: "Connect via CalDAV (iCloud, Fastmail, etc.)",
  },
  ics: {
    name: "ICS Subscription",
    icon: <span className="text-lg">🔗</span>,
    bgColor: "bg-emerald-500/10",
    description: "Subscribe to .ics calendar feeds",
  },
  sports: {
    name: "Sports",
    icon: <span className="text-lg">🏈</span>,
    bgColor: "bg-orange-500/10",
    description: "Follow your favorite teams' game schedules",
  },
  homeassistant: {
    name: "Home Assistant",
    icon: <span className="text-lg">🏠</span>,
    bgColor: "bg-cyan-500/10",
    description: "Calendars from your Home Assistant instance",
  },
};

interface CalendarAccountsListProps {
  calendars: Calendar[];
  favoriteTeams: FavoriteSportsTeam[];
  selectedProvider: CalendarProvider | null;
  onSelectProvider: (provider: CalendarProvider) => void;
  onAddAccount: () => void;
  onSyncAll: () => void;
  isSyncing?: boolean;
}

interface ProviderGroup {
  provider: CalendarProvider;
  calendars: Calendar[];
  isConnected: boolean;
}

export function CalendarAccountsList({
  calendars,
  favoriteTeams,
  selectedProvider,
  onSelectProvider,
  onAddAccount,
  onSyncAll,
  isSyncing,
}: CalendarAccountsListProps) {
  // Group calendars by provider and determine connection status
  const providerGroups = useMemo(() => {
    const groups: ProviderGroup[] = [];

    // Standard calendar providers
    const providers: CalendarProvider[] = ["google", "microsoft", "caldav", "ics", "homeassistant"];

    for (const provider of providers) {
      const providerCalendars = calendars.filter((c) => c.provider === provider);
      groups.push({
        provider,
        calendars: providerCalendars,
        isConnected: providerCalendars.length > 0,
      });
    }

    // Sports provider - connected if user has favorite teams
    groups.push({
      provider: "sports",
      calendars: [], // Sports doesn't use Calendar objects
      isConnected: favoriteTeams.length > 0,
    });

    return groups;
  }, [calendars, favoriteTeams]);

  return (
    <div className="flex flex-col h-full">
      {/* Header with Sync All button */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <h3 className="text-sm font-medium text-muted-foreground">Accounts</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onSyncAll}
          disabled={isSyncing}
          className="h-8 px-2"
        >
          <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Provider list */}
      <div className="flex-1 space-y-2 py-4 overflow-y-auto">
        {providerGroups.map(({ provider, calendars: providerCalendars, isConnected }) => {
          const config = PROVIDER_CONFIG[provider];
          const calendarCount = provider === "sports" ? favoriteTeams.length : providerCalendars.length;
          const isSelected = selectedProvider === provider;

          return (
            <button
              key={provider}
              type="button"
              onClick={() => onSelectProvider(provider)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
                isSelected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-transparent hover:bg-muted/50"
              }`}
            >
              {/* Provider icon */}
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${config.bgColor}`}
              >
                {config.icon}
              </div>

              {/* Provider info */}
              <div className="flex-1 text-left min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">{config.name}</p>
                  {isConnected && (
                    <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {isConnected
                    ? `${calendarCount} ${provider === "sports" ? "team" : "calendar"}${calendarCount !== 1 ? "s" : ""}`
                    : "Not connected"}
                </p>
              </div>

              {/* Selection indicator */}
              {isSelected && (
                <div className="w-1 h-8 rounded-full bg-primary flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Add Account button */}
      <div className="pt-4 border-t border-border">
        <Button
          variant="outline"
          className="w-full"
          onClick={onAddAccount}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Account
        </Button>
      </div>
    </div>
  );
}
