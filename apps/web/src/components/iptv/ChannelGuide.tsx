import { useState, useMemo, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, Star, Play } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/Button";
import type { IptvChannel } from "@openframe/shared";

interface EpgEntry {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
}

interface ChannelGuideProps {
  channels: IptvChannel[];
  epg: Record<string, EpgEntry[]>;
  favorites: IptvChannel[];
  searchQuery?: string;
  onChannelSelect: (channel: IptvChannel) => void;
}

// Constants for the grid layout
const SLOT_WIDTH = 120; // pixels per 30 minutes
const CHANNEL_COL_WIDTH = 160; // pixels for channel column
const TIME_HEADER_HEIGHT = 36; // pixels for time header
const CHANNEL_ROW_HEIGHT = 56; // pixels per channel row
const MIN_PROGRAM_WIDTH = 60; // minimum width for very short programs

export function ChannelGuide({
  channels,
  epg,
  favorites,
  searchQuery,
  onChannelSelect,
}: ChannelGuideProps) {
  // Round current time down to nearest 30 minutes for the initial view
  const now = new Date();
  const initialStartTime = new Date(now);
  initialStartTime.setMinutes(Math.floor(now.getMinutes() / 30) * 30, 0, 0);
  // Start 30 minutes before current time so "now" is visible
  initialStartTime.setMinutes(initialStartTime.getMinutes() - 30);

  const [viewStartTime, setViewStartTime] = useState(initialStartTime);
  const [hoursToShow] = useState(3);
  const gridRef = useRef<HTMLDivElement>(null);

  // Filter by search, then sort channels: favorites first, then alphabetically
  const sortedChannels = useMemo(() => {
    const favoriteIds = new Set(favorites.map((f) => f.id));
    let filtered = channels;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const now = new Date();
      filtered = channels.filter((c) => {
        if (c.name.toLowerCase().includes(query)) return true;
        const channelEpg = epg[c.id];
        if (channelEpg) {
          const currentProgram = channelEpg.find((e) => {
            const start = new Date(e.startTime);
            const end = new Date(e.endTime);
            return now >= start && now < end;
          });
          if (currentProgram?.title.toLowerCase().includes(query)) return true;
        }
        return false;
      });
    }

    return [...filtered].sort((a, b) => {
      const aIsFav = favoriteIds.has(a.id);
      const bIsFav = favoriteIds.has(b.id);
      if (aIsFav && !bIsFav) return -1;
      if (!aIsFav && bIsFav) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [channels, favorites, searchQuery, epg]);

  // Show all channels, not just those with EPG data
  const channelsWithEpg = sortedChannels;

  // Generate time slots for the header
  const timeSlots = useMemo(() => {
    const slots: Date[] = [];
    const numSlots = hoursToShow * 2; // 2 slots per hour (30 min each)
    for (let i = 0; i < numSlots; i++) {
      const slotTime = new Date(viewStartTime);
      slotTime.setMinutes(viewStartTime.getMinutes() + i * 30);
      slots.push(slotTime);
    }
    return slots;
  }, [viewStartTime, hoursToShow]);

  // Calculate the position of the "now" indicator
  const nowIndicatorPosition = useMemo(() => {
    const nowTime = new Date();
    const diffMs = nowTime.getTime() - viewStartTime.getTime();
    const diffMinutes = diffMs / (1000 * 60);
    const position = (diffMinutes / 30) * SLOT_WIDTH;
    // Only show if within visible range
    const maxPosition = hoursToShow * 2 * SLOT_WIDTH;
    if (position < 0 || position > maxPosition) return null;
    return position;
  }, [viewStartTime, hoursToShow]);

  // Auto-scroll to current time on mount
  useEffect(() => {
    if (gridRef.current && nowIndicatorPosition !== null) {
      // Scroll so "now" is about 1/3 from the left
      const scrollPosition = Math.max(0, nowIndicatorPosition - SLOT_WIDTH);
      gridRef.current.scrollLeft = scrollPosition;
    }
  }, []); // Only on mount

  // Navigation handlers
  const navigateEarlier = () => {
    const newStart = new Date(viewStartTime);
    newStart.setHours(newStart.getHours() - 1);
    setViewStartTime(newStart);
  };

  const navigateLater = () => {
    const newStart = new Date(viewStartTime);
    newStart.setHours(newStart.getHours() + 1);
    setViewStartTime(newStart);
  };

  const navigateToNow = () => {
    const now = new Date();
    const newStart = new Date(now);
    newStart.setMinutes(Math.floor(now.getMinutes() / 30) * 30, 0, 0);
    newStart.setMinutes(newStart.getMinutes() - 30);
    setViewStartTime(newStart);
  };

  const formatTimeSlot = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  const totalGridWidth = hoursToShow * 2 * SLOT_WIDTH;

  if (channelsWithEpg.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <div className="text-muted-foreground">
          <p className="text-lg font-medium">No channels available</p>
          <p className="mt-2 text-sm">
            Add an IPTV server and sync channels to see the guide.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Navigation bar */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
        <Button variant="outline" size="sm" onClick={navigateEarlier}>
          <ChevronLeft className="mr-1 h-4 w-4" />
          Earlier
        </Button>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={navigateToNow}>
            Jump to Now
          </Button>
          <span className="text-sm text-muted-foreground">
            {viewStartTime.toLocaleDateString([], {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>

        <Button variant="outline" size="sm" onClick={navigateLater}>
          Later
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>

      {/* Guide grid */}
      <div className="flex flex-1 overflow-hidden">
        {/* Fixed channel column */}
        <div
          className="flex-shrink-0 border-r border-border bg-card"
          style={{ width: CHANNEL_COL_WIDTH }}
        >
          {/* Spacer for time header */}
          <div
            className="border-b border-border bg-muted/50"
            style={{ height: TIME_HEADER_HEIGHT }}
          />

          {/* Channel list */}
          <div className="overflow-y-auto" style={{ height: `calc(100% - ${TIME_HEADER_HEIGHT}px)` }}>
            {channelsWithEpg.map((channel) => (
              <ChannelRow
                key={channel.id}
                channel={channel}
                isFavorite={favorites.some((f) => f.id === channel.id)}
                onSelect={() => onChannelSelect(channel)}
              />
            ))}
          </div>
        </div>

        {/* Scrollable time grid */}
        <div
          ref={gridRef}
          className="flex-1 overflow-x-auto overflow-y-auto"
        >
          <div style={{ width: totalGridWidth, minHeight: "100%" }}>
            {/* Time header */}
            <div
              className="sticky top-0 z-10 flex border-b border-border bg-muted/50"
              style={{ height: TIME_HEADER_HEIGHT }}
            >
              {timeSlots.map((slot, idx) => (
                <div
                  key={idx}
                  className="flex items-center border-r border-border/50 px-2 text-sm font-medium"
                  style={{ width: SLOT_WIDTH }}
                >
                  {formatTimeSlot(slot)}
                </div>
              ))}
            </div>

            {/* Program grid with now indicator */}
            <div className="relative">
              {/* Now indicator */}
              {nowIndicatorPosition !== null && (
                <div
                  className="absolute top-0 bottom-0 z-20 w-0.5 bg-red-500"
                  style={{ left: nowIndicatorPosition }}
                >
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-red-500" />
                </div>
              )}

              {/* Program rows */}
              {channelsWithEpg.map((channel) => (
                <ProgramRow
                  key={channel.id}
                  channel={channel}
                  epgEntries={epg[channel.id] || []}
                  viewStartTime={viewStartTime}
                  hoursToShow={hoursToShow}
                  onChannelSelect={onChannelSelect}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Channel row in the fixed left column
function ChannelRow({
  channel,
  isFavorite,
  onSelect,
}: {
  channel: IptvChannel;
  isFavorite: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className="group flex items-center gap-2 border-b border-border px-2 cursor-pointer hover:bg-muted/50 transition-colors"
      style={{ height: CHANNEL_ROW_HEIGHT }}
      onClick={onSelect}
    >
      {/* Channel logo */}
      <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded bg-muted">
        <ChannelLogo channel={channel} size="md" />
      </div>

      {/* Channel name */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          {isFavorite && <Star className="h-3 w-3 text-yellow-500 fill-current flex-shrink-0" />}
          <span className="truncate text-sm font-medium">{channel.name}</span>
        </div>
      </div>

      {/* Play button on hover */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <Play className="h-4 w-4 text-primary" />
      </div>
    </div>
  );
}

// Program row showing all programs for a channel
function ProgramRow({
  channel,
  epgEntries,
  viewStartTime,
  hoursToShow,
  onChannelSelect,
}: {
  channel: IptvChannel;
  epgEntries: EpgEntry[];
  viewStartTime: Date;
  hoursToShow: number;
  onChannelSelect: (channel: IptvChannel) => void;
}) {
  const viewEndTime = new Date(viewStartTime);
  viewEndTime.setHours(viewEndTime.getHours() + hoursToShow);

  // Filter and calculate positions for visible programs
  const visiblePrograms = useMemo(() => {
    const programs: Array<{
      entry: EpgEntry;
      left: number;
      width: number;
      isCurrentlyPlaying: boolean;
      progress: number;
    }> = [];

    const now = new Date();

    for (const entry of epgEntries) {
      const start = new Date(entry.startTime);
      const end = new Date(entry.endTime);

      // Skip programs that end before view starts or start after view ends
      if (end <= viewStartTime || start >= viewEndTime) continue;

      // Calculate position (clipped to visible area)
      const visibleStart = start < viewStartTime ? viewStartTime : start;
      const visibleEnd = end > viewEndTime ? viewEndTime : end;

      const leftMinutes = (visibleStart.getTime() - viewStartTime.getTime()) / (1000 * 60);
      const widthMinutes = (visibleEnd.getTime() - visibleStart.getTime()) / (1000 * 60);

      const left = (leftMinutes / 30) * SLOT_WIDTH;
      const width = Math.max(MIN_PROGRAM_WIDTH, (widthMinutes / 30) * SLOT_WIDTH);

      // Check if currently playing
      const isCurrentlyPlaying = now >= start && now < end;

      // Calculate progress
      let progress = 0;
      if (isCurrentlyPlaying) {
        const totalDuration = end.getTime() - start.getTime();
        const elapsed = now.getTime() - start.getTime();
        progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
      }

      programs.push({
        entry,
        left,
        width,
        isCurrentlyPlaying,
        progress,
      });
    }

    return programs;
  }, [epgEntries, viewStartTime, viewEndTime]);

  const totalWidth = hoursToShow * 2 * SLOT_WIDTH;

  return (
    <div
      className="relative border-b border-border"
      style={{ height: CHANNEL_ROW_HEIGHT, width: totalWidth }}
    >
      {/* Background grid lines */}
      <div className="absolute inset-0 flex">
        {Array.from({ length: hoursToShow * 2 }).map((_, idx) => (
          <div
            key={idx}
            className="border-r border-border/30"
            style={{ width: SLOT_WIDTH }}
          />
        ))}
      </div>

      {/* Programs */}
      {visiblePrograms.map((program) => (
        <ProgramBlock
          key={program.entry.id}
          entry={program.entry}
          left={program.left}
          width={program.width}
          isCurrentlyPlaying={program.isCurrentlyPlaying}
          progress={program.progress}
          onClick={() => onChannelSelect(channel)}
        />
      ))}

      {/* No program info indicator */}
      {visiblePrograms.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
          No program info
        </div>
      )}
    </div>
  );
}

// Individual program block
function ProgramBlock({
  entry,
  left,
  width,
  isCurrentlyPlaying,
  progress,
  onClick,
}: {
  entry: EpgEntry;
  left: number;
  width: number;
  isCurrentlyPlaying: boolean;
  progress: number;
  onClick: () => void;
}) {
  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div
      className={cn(
        "absolute top-1 bottom-1 overflow-hidden rounded border cursor-pointer transition-colors group",
        isCurrentlyPlaying
          ? "bg-primary/10 border-primary/50 hover:bg-primary/20"
          : "bg-card border-border hover:bg-muted"
      )}
      style={{ left, width: width - 4 }} // -4 for margin
      onClick={onClick}
      title={`${entry.title}\n${formatTime(entry.startTime)} - ${formatTime(entry.endTime)}${entry.description ? `\n\n${entry.description}` : ""}`}
    >
      <div className="p-1.5 h-full flex flex-col">
        {/* Program title */}
        <div className="flex-1 min-h-0">
          <p className={cn(
            "text-xs font-medium line-clamp-2",
            isCurrentlyPlaying && "text-primary"
          )}>
            {entry.title}
          </p>
        </div>

        {/* Time range */}
        <p className="text-[10px] text-muted-foreground mt-auto">
          {formatTime(entry.startTime)} - {formatTime(entry.endTime)}
        </p>

        {/* Progress bar for currently playing */}
        {isCurrentlyPlaying && (
          <div className="mt-1 h-1 w-full rounded-full bg-primary/20 overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Play overlay on hover */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded">
        <Play className="h-6 w-6 text-white" />
      </div>
    </div>
  );
}

// Reusable channel logo with error handling
function ChannelLogo({
  channel,
  size = "md",
}: {
  channel: IptvChannel;
  size?: "sm" | "md" | "lg";
}) {
  const [imgError, setImgError] = useState(false);
  const logoUrl = channel.logoUrl || channel.streamIcon;

  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-lg",
  };

  if (!logoUrl || imgError) {
    return (
      <div className={cn(
        "flex h-full w-full items-center justify-center font-bold text-muted-foreground",
        sizeClasses[size]
      )}>
        {channel.name.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={channel.name}
      className="h-full w-full object-contain p-0.5"
      onError={() => setImgError(true)}
    />
  );
}
