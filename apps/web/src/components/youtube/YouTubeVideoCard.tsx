import { Bookmark, BookmarkCheck, Play, Radio } from "lucide-react";
import {
  formatYouTubeDuration,
  formatViewCount,
  formatRelativeTime,
} from "../../lib/youtube-utils";

interface YouTubeVideoCardProps {
  youtubeId: string;
  title: string;
  thumbnailUrl: string;
  channelTitle?: string;
  duration?: string;
  viewCount?: string;
  publishedAt?: string;
  isLive?: boolean;
  isBookmarked?: boolean;
  onPlay: (youtubeId: string) => void;
  onToggleBookmark?: (youtubeId: string) => void;
}

export function YouTubeVideoCard({
  youtubeId,
  title,
  thumbnailUrl,
  channelTitle,
  duration,
  viewCount,
  publishedAt,
  isLive,
  isBookmarked,
  onPlay,
  onToggleBookmark,
}: YouTubeVideoCardProps) {
  return (
    <div
      className="group cursor-pointer rounded-lg border border-border bg-card transition-colors hover:border-primary/40 hover:bg-primary/5"
      onClick={() => onPlay(youtubeId)}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden rounded-t-lg bg-black">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Play className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        {/* Duration badge */}
        {duration && !isLive && (
          <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
            {formatYouTubeDuration(duration)}
          </span>
        )}
        {/* Live badge */}
        {isLive && (
          <span className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-xs font-medium text-white">
            <Radio className="h-3 w-3" />
            LIVE
          </span>
        )}
        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity group-hover:bg-black/30 group-hover:opacity-100">
          <Play className="h-10 w-10 text-white" fill="white" />
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="line-clamp-2 text-sm font-medium leading-tight">{title}</h3>
        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
          {channelTitle && <span className="truncate">{channelTitle}</span>}
          {viewCount && (
            <>
              <span>·</span>
              <span>{formatViewCount(viewCount)} views</span>
            </>
          )}
          {publishedAt && (
            <>
              <span>·</span>
              <span>{formatRelativeTime(publishedAt)}</span>
            </>
          )}
        </div>

        {/* Bookmark toggle */}
        {onToggleBookmark && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleBookmark(youtubeId);
            }}
            className="mt-2 flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
          >
            {isBookmarked ? (
              <BookmarkCheck className="h-3.5 w-3.5 text-primary" />
            ) : (
              <Bookmark className="h-3.5 w-3.5" />
            )}
            {isBookmarked ? "Saved" : "Save"}
          </button>
        )}
      </div>
    </div>
  );
}
