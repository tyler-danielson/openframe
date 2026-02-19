import { WifiOff, RefreshCw } from "lucide-react";
import type { ConnectionStatus } from "../hooks/useConnectionHealth";

function formatTimeAgo(date: Date | null): string {
  if (!date) return "Unknown";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleTimeString();
}

interface ConnectionStatusIndicatorProps {
  status: ConnectionStatus;
  lastOnlineAt: Date | null;
}

export function ConnectionStatusIndicator({
  status,
  lastOnlineAt,
}: ConnectionStatusIndicatorProps) {
  if (status === "online") return null;

  return (
    <div className="fixed bottom-4 right-4 bg-card/95 backdrop-blur-sm border border-border rounded-lg px-4 py-3 shadow-lg z-50 flex items-center gap-3">
      {status === "offline" && (
        <>
          <WifiOff className="h-5 w-5 text-destructive" />
          <div>
            <div className="text-sm font-medium text-destructive">Offline</div>
            <div className="text-xs text-muted-foreground">
              Last online: {formatTimeAgo(lastOnlineAt)}
            </div>
          </div>
        </>
      )}
      {status === "reconnecting" && (
        <>
          <RefreshCw className="h-5 w-5 text-yellow-500 animate-spin" />
          <div>
            <div className="text-sm font-medium text-yellow-500">Reconnecting...</div>
            <div className="text-xs text-muted-foreground">
              Last online: {formatTimeAgo(lastOnlineAt)}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
