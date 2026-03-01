import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  api,
  type AdminLogsResponse,
  type AdminSystemStatus,
  type AdminLogEntry,
} from "../../services/api";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import {
  Activity,
  Database,
  HardDrive,
  Clock,
  Server,
  Search,
  Trash2,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Pause,
  Play,
  Layers,
} from "lucide-react";
import { cn } from "../../lib/utils";

// ============ Level Helpers ============

const LEVEL_TABS = [
  { id: 0, label: "All" },
  { id: 50, label: "Error" },
  { id: 40, label: "Warn" },
  { id: 30, label: "Info" },
  { id: 20, label: "Debug" },
];

const LEVEL_BADGE: Record<string, string> = {
  fatal: "bg-red-900/80 text-red-100",
  error: "bg-red-500/15 text-red-600 border border-red-500/30",
  warn: "bg-amber-500/15 text-amber-600 border border-amber-500/30",
  info: "bg-blue-500/15 text-blue-600 border border-blue-500/30",
  debug: "bg-muted text-muted-foreground border border-border",
  trace: "bg-muted text-muted-foreground border border-border",
};

// ============ Troubleshooting Tips ============

const TIPS = [
  {
    title: "Calendar Sync Issues",
    content:
      "Check that your CalDAV/Google Calendar credentials are valid. Look for 401 or 403 errors in the logs. Try removing and re-adding the calendar source.",
  },
  {
    title: "Camera Streams Not Loading",
    content:
      "Verify RTSP/MJPEG URLs are reachable from the server. Check for network timeouts in logs. Ensure ffmpeg is installed if using RTSP transcoding.",
  },
  {
    title: "Weather Data Missing",
    content:
      "Confirm the weather API key is set in settings. Check for rate limit errors (429). The weather provider may be temporarily unavailable.",
  },
  {
    title: "IPTV Channels Not Working",
    content:
      "Validate your M3U playlist URL. Check for EPG parsing errors. Large playlists may take time to sync on first load.",
  },
  {
    title: "Performance Issues",
    content:
      "Monitor memory usage in System Status above. If heap usage is consistently above 80%, consider restarting. Check for slow database queries in the logs.",
  },
  {
    title: "Database Errors",
    content:
      "If DB status shows 'error', check that PostgreSQL is running and accessible. Verify DATABASE_URL is correct. Run pending migrations if needed.",
  },
];

// ============ Format Helpers ============

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatTime(timestamp: string): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString("en-US", { hour12: false });
}

// ============ Component ============

export function AdminDebugPage() {
  const queryClient = useQueryClient();
  const [levelFilter, setLevelFilter] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [tipsOpen, setTipsOpen] = useState(false);
  const [expandedTip, setExpandedTip] = useState<number | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);

  // Debounce search
  useMemo(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Auto-scroll detection
  const handleScroll = useCallback(() => {
    const el = logContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setUserScrolled(!atBottom);
  }, []);

  // Fetch logs
  const { data: logsData } = useQuery<AdminLogsResponse>({
    queryKey: ["admin", "logs", levelFilter, debouncedSearch],
    queryFn: () =>
      api.getAdminLogs({
        level: levelFilter || undefined,
        search: debouncedSearch || undefined,
        limit: 500,
      }),
    refetchInterval: autoRefresh ? 3000 : false,
  });

  // Fetch system status
  const { data: systemStatus } = useQuery<AdminSystemStatus>({
    queryKey: ["admin", "system-status"],
    queryFn: () => api.getAdminSystemStatus(),
    refetchInterval: 10000,
  });

  // Auto-scroll to bottom
  useEffect(() => {
    if (!userScrolled && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logsData, userScrolled]);

  const handleClearLogs = async () => {
    await api.postAdminClearLogs();
    queryClient.invalidateQueries({ queryKey: ["admin", "logs"] });
  };

  const handleRestart = async () => {
    if (
      !window.confirm(
        "Are you sure you want to restart the API server? This will briefly interrupt all connections."
      )
    ) {
      return;
    }
    await api.postAdminRestart();
  };

  const entries: AdminLogEntry[] = logsData?.entries ?? [];

  // ============ System Status Cards ============

  const statusCards = systemStatus
    ? [
        {
          label: "Uptime",
          value: formatUptime(systemStatus.uptime),
          icon: Clock,
        },
        {
          label: "Memory",
          value: `${systemStatus.memoryUsage.heapUsed} / ${systemStatus.memoryUsage.heapTotal} MB`,
          icon: HardDrive,
        },
        {
          label: "Database",
          value: systemStatus.dbStatus === "ok" ? "Connected" : "Error",
          icon: Database,
          alert: systemStatus.dbStatus !== "ok",
        },
        {
          label: "Node.js",
          value: systemStatus.nodeVersion,
          icon: Server,
        },
        {
          label: "Environment",
          value: systemStatus.env,
          icon: Layers,
        },
        {
          label: "Log Level",
          value: systemStatus.logLevel,
          icon: Activity,
        },
      ]
    : [];

  return (
    <div className="p-6 max-w-6xl">
      <h1 className="text-2xl font-bold text-primary mb-6">
        Debug & Troubleshooting
      </h1>

      {/* System Status Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {systemStatus
          ? statusCards.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.label} className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {card.label}
                    </span>
                  </div>
                  <p
                    className={cn(
                      "text-sm font-semibold truncate",
                      "alert" in card && card.alert
                        ? "text-destructive"
                        : "text-foreground"
                    )}
                  >
                    {card.value}
                  </p>
                </Card>
              );
            })
          : Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="p-4 animate-pulse">
                <div className="h-3 bg-muted rounded w-16 mb-3" />
                <div className="h-4 bg-muted rounded w-12" />
              </Card>
            ))}
      </div>

      {/* Log Viewer */}
      <Card className="mb-6">
        {/* Log Toolbar */}
        <div className="p-3 border-b border-border flex flex-wrap items-center gap-2">
          {/* Level tabs */}
          <div className="flex gap-1">
            {LEVEL_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setLevelFilter(tab.id)}
                className={cn(
                  "px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                  levelFilter === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-primary/10"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-muted border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>

          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
              autoRefresh
                ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30"
                : "bg-muted text-muted-foreground border border-border"
            )}
          >
            {autoRefresh ? (
              <Pause className="h-3 w-3" />
            ) : (
              <Play className="h-3 w-3" />
            )}
            {autoRefresh ? "Live" : "Paused"}
          </button>

          {/* Buffer size */}
          {logsData && (
            <span className="text-xs text-muted-foreground">
              {logsData.bufferSize} entries
            </span>
          )}
        </div>

        {/* Log Content */}
        <div
          ref={logContainerRef}
          onScroll={handleScroll}
          className="h-[400px] overflow-y-auto font-mono text-xs"
        >
          {entries.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              No log entries
            </div>
          ) : (
            <div className="p-2 space-y-px">
              {entries.map((entry, i) => (
                <div
                  key={`${entry.timestamp}-${i}`}
                  className="flex items-start gap-2 py-1 px-2 rounded hover:bg-muted/50"
                >
                  <span className="text-muted-foreground shrink-0 w-[60px]">
                    {formatTime(entry.timestamp)}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 w-[46px] text-center rounded px-1 py-0.5 text-[10px] font-semibold uppercase",
                      LEVEL_BADGE[entry.levelLabel] ?? LEVEL_BADGE.info
                    )}
                  >
                    {entry.levelLabel}
                  </span>
                  <span className="text-foreground break-all">
                    {entry.msg}
                    {entry.reqMethod && entry.reqUrl && (
                      <span className="text-muted-foreground ml-2">
                        {entry.reqMethod} {entry.reqUrl}
                      </span>
                    )}
                    {entry.err && (
                      <span className="text-destructive ml-2">
                        {entry.err}
                      </span>
                    )}
                  </span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          )}
        </div>
      </Card>

      {/* Troubleshooting Tips */}
      <Card className="mb-6">
        <button
          onClick={() => setTipsOpen(!tipsOpen)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-muted/30 transition-colors"
        >
          <span className="font-semibold text-foreground">
            Troubleshooting Tips
          </span>
          {tipsOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        {tipsOpen && (
          <div className="px-4 pb-4 space-y-1">
            {TIPS.map((tip, i) => (
              <div key={i} className="border border-border rounded-lg">
                <button
                  onClick={() =>
                    setExpandedTip(expandedTip === i ? null : i)
                  }
                  className="w-full px-4 py-3 flex items-center justify-between text-left text-sm hover:bg-muted/30 transition-colors"
                >
                  <span className="font-medium text-foreground">
                    {tip.title}
                  </span>
                  {expandedTip === i ? (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </button>
                {expandedTip === i && (
                  <p className="px-4 pb-3 text-sm text-muted-foreground">
                    {tip.content}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          className="gap-2"
          onClick={handleClearLogs}
        >
          <Trash2 className="h-4 w-4" />
          Clear Logs
        </Button>
        <Button
          variant="outline"
          className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
          onClick={handleRestart}
        >
          <RotateCcw className="h-4 w-4" />
          Restart API
        </Button>
      </div>
    </div>
  );
}
