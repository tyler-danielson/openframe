import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Pin, StickyNote } from "lucide-react";
import { api } from "../../services/api";
import type { WidgetStyle, FontSizePreset } from "../../stores/screensaver";
import { getFontSizeConfig } from "../../lib/font-size";
import { cn } from "../../lib/utils";

interface StickyNotesWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
  widgetId?: string;
}

interface StickyNoteItem {
  id: string;
  content: string;
  color: string;
  pinned: boolean;
  authorName?: string;
  createdAt: string;
}

const FONT_SIZE_CLASSES: Record<Exclude<FontSizePreset, "custom">, { content: string; meta: string }> = {
  xs: { content: "text-[10px]", meta: "text-[8px]" },
  sm: { content: "text-xs", meta: "text-[9px]" },
  md: { content: "text-sm", meta: "text-[10px]" },
  lg: { content: "text-base", meta: "text-xs" },
  xl: { content: "text-lg", meta: "text-sm" },
};

const CUSTOM_SCALE = {
  content: 1,
  meta: 0.7,
};

export function StickyNotesWidget({ config, style, isBuilder }: StickyNotesWidgetProps) {
  const maxNotes = (config.maxNotes as number) ?? 6;
  const showAuthor = (config.showAuthor as boolean) ?? true;
  const showTimestamp = (config.showTimestamp as boolean) ?? false;
  const columns = (config.columns as number) ?? 2;
  const defaultColor = (config.defaultColor as string) ?? "#FEF3C7";

  const { preset, isCustom, customValue } = getFontSizeConfig(style);
  const sizeClasses = isCustom ? null : FONT_SIZE_CLASSES[preset as Exclude<FontSizePreset, "custom">];

  const getCustomFontSize = (scale: number) => {
    if (!customValue) return undefined;
    const value = parseFloat(customValue);
    const unit = customValue.replace(/[\d.]/g, "") || "px";
    return `${value * scale}${unit}`;
  };

  const { data, isLoading } = useQuery({
    queryKey: ["sticky-notes"],
    queryFn: () => api.getStickyNotes() as Promise<{ notes: StickyNoteItem[] }>,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    enabled: !isBuilder,
  });

  const notes = data?.notes ?? [];

  // Sort pinned notes first
  const sortedNotes = [...notes]
    .sort((a, b) => (a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1))
    .slice(0, maxNotes);

  // Mock data for builder preview
  const mockNotes: StickyNoteItem[] = [
    { id: "1", content: "Pick up groceries after school", color: "#FEF3C7", pinned: true, authorName: "Mom", createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
    { id: "2", content: "Soccer practice at 4pm", color: "#DBEAFE", pinned: false, authorName: "Dad", createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() },
    { id: "3", content: "Math homework due Friday", color: "#D1FAE5", pinned: false, authorName: "Alex", createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString() },
    { id: "4", content: "Vet appointment Saturday 10am", color: "#FCE7F3", pinned: true, authorName: "Mom", createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
  ];

  const displayNotes = isBuilder
    ? mockNotes.slice(0, maxNotes)
    : sortedNotes;

  if (!isBuilder && isLoading) {
    return (
      <div
        className="flex h-full items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <span className="text-sm opacity-50">Loading notes...</span>
      </div>
    );
  }

  if (!isBuilder && displayNotes.length === 0) {
    return (
      <div
        className="flex h-full flex-col items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <StickyNote className="h-8 w-8 opacity-30 mb-2" />
        <span className="text-sm opacity-50">No sticky notes</span>
      </div>
    );
  }

  const gridCols = columns === 1 ? "grid-cols-1" : columns === 3 ? "grid-cols-3" : "grid-cols-2";

  return (
    <div
      className={cn(
        "relative flex h-full flex-col p-3 rounded-lg overflow-hidden",
        "bg-black/40 backdrop-blur-sm"
      )}
      style={{ color: style?.textColor || "#ffffff" }}
    >
      <div className={cn("grid gap-2 flex-1 overflow-hidden auto-rows-fr", gridCols)}>
        {displayNotes.map((note) => {
          const noteColor = note.color || defaultColor;
          return (
            <div
              key={note.id}
              className="relative rounded-md p-2.5 overflow-hidden flex flex-col"
              style={{
                backgroundColor: noteColor,
                color: "#1a1a1a",
              }}
            >
              {note.pinned && (
                <Pin className="absolute top-1.5 right-1.5 h-3 w-3 opacity-50" />
              )}
              <p
                className={cn(sizeClasses?.content, "flex-1 leading-snug line-clamp-4")}
                style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.content) } : undefined}
              >
                {note.content}
              </p>
              {(showAuthor || showTimestamp) && (
                <div
                  className={cn(sizeClasses?.meta, "mt-1.5 opacity-60 flex items-center gap-1")}
                  style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.meta) } : undefined}
                >
                  {showAuthor && note.authorName && (
                    <span className="truncate">{note.authorName}</span>
                  )}
                  {showAuthor && note.authorName && showTimestamp && <span>·</span>}
                  {showTimestamp && (
                    <span className="flex-shrink-0">
                      {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
