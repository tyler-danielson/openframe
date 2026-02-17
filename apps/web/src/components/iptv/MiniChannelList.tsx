import { useState } from "react";
import { Star, Tv, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";
import type { IptvChannel } from "@openframe/shared";

interface MiniChannelListProps {
  channels: IptvChannel[];
  activeChannelId: string;
  onChannelSelect: (channelId: string) => void;
  onToggleFavorite: (channelId: string, isFavorite: boolean) => void;
  isLoading?: boolean;
  emptyMessage?: string;
}

export function MiniChannelList({
  channels,
  activeChannelId,
  onChannelSelect,
  onToggleFavorite,
  isLoading,
  emptyMessage = "No channels",
}: MiniChannelListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-white/50" />
      </div>
    );
  }

  if (channels.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-white/40">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {channels.map((ch) => (
        <MiniChannelRow
          key={ch.id}
          channel={ch}
          isActive={ch.id === activeChannelId}
          onSelect={() => onChannelSelect(ch.id)}
          onToggleFavorite={() => onToggleFavorite(ch.id, !!ch.isFavorite)}
        />
      ))}
    </div>
  );
}

function MiniChannelRow({
  channel,
  isActive,
  onSelect,
  onToggleFavorite,
}: {
  channel: IptvChannel;
  isActive: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const logoUrl = channel.logoUrl || channel.streamIcon;

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors min-h-[44px]",
        isActive
          ? "bg-white/15 text-white"
          : "text-white/80 hover:bg-white/10"
      )}
      onClick={onSelect}
    >
      {/* Channel logo */}
      <div className="h-6 w-6 flex-shrink-0 rounded overflow-hidden bg-white/10">
        {logoUrl && !imgError ? (
          <img
            src={logoUrl}
            alt=""
            className="h-full w-full object-contain"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Tv className="h-3.5 w-3.5 text-white/40" />
          </div>
        )}
      </div>

      {/* Channel name */}
      <span className="flex-1 truncate text-sm">{channel.name}</span>

      {/* LIVE badge */}
      {isActive && (
        <span className="flex-shrink-0 rounded bg-red-500/80 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
          LIVE
        </span>
      )}

      {/* Favorite toggle */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        className={cn(
          "flex-shrink-0 p-1 rounded transition-colors",
          channel.isFavorite
            ? "text-yellow-400 hover:text-yellow-300"
            : "text-white/30 hover:text-white/60"
        )}
      >
        <Star
          className={cn("h-4 w-4", channel.isFavorite && "fill-current")}
        />
      </button>
    </div>
  );
}
