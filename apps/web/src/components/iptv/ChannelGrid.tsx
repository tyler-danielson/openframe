import { Star, Play } from "lucide-react";
import { cn } from "../../lib/utils";
import type { IptvChannel } from "@openframe/shared";

interface ChannelGridProps {
  channels: IptvChannel[];
  currentChannelId?: string;
  onChannelSelect: (channel: IptvChannel) => void;
  onToggleFavorite: (channelId: string, isFavorite: boolean) => void;
}

export function ChannelGrid({
  channels,
  currentChannelId,
  onChannelSelect,
  onToggleFavorite,
}: ChannelGridProps) {
  if (channels.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p>No channels found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {channels.map((channel) => (
        <ChannelCard
          key={channel.id}
          channel={channel}
          isActive={channel.id === currentChannelId}
          onSelect={() => onChannelSelect(channel)}
          onToggleFavorite={() => onToggleFavorite(channel.id, !!channel.isFavorite)}
        />
      ))}
    </div>
  );
}

interface ChannelCardProps {
  channel: IptvChannel;
  isActive: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
}

function ChannelCard({ channel, isActive, onSelect, onToggleFavorite }: ChannelCardProps) {
  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg border bg-card transition-all hover:border-primary/50 hover:shadow-lg",
        isActive && "border-primary ring-2 ring-primary/20"
      )}
    >
      {/* Channel logo/image */}
      <button
        onClick={onSelect}
        className="relative aspect-video w-full overflow-hidden bg-muted"
      >
        {channel.logoUrl || channel.streamIcon ? (
          <img
            src={channel.logoUrl || channel.streamIcon || ""}
            alt={channel.name}
            className="h-full w-full object-contain p-2"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-2xl font-bold text-muted-foreground">
            {channel.name.charAt(0).toUpperCase()}
          </div>
        )}

        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
          <Play className="h-10 w-10 text-white" />
        </div>

        {/* Active indicator */}
        {isActive && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            LIVE
          </div>
        )}
      </button>

      {/* Channel info */}
      <div className="flex items-start justify-between gap-2 p-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium" title={channel.name}>
            {channel.name}
          </h3>
          {channel.categoryName && (
            <p className="truncate text-xs text-muted-foreground">
              {channel.categoryName}
            </p>
          )}
        </div>

        {/* Favorite button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className={cn(
            "shrink-0 rounded p-1 transition-colors hover:bg-muted",
            channel.isFavorite ? "text-yellow-500" : "text-muted-foreground"
          )}
          title={channel.isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Star
            className={cn("h-4 w-4", channel.isFavorite && "fill-current")}
          />
        </button>
      </div>
    </div>
  );
}
