import { useQuery } from "@tanstack/react-query";
import { SectionTitle, type EditableWidgetProps } from "./types";
import { usePlannerEvents } from "../../../hooks/usePlannerEvents";
import { api } from "../../../services/api";
import type { CalendarEvent } from "@openframe/shared";

// Height of each hour row in pixels
const HOUR_HEIGHT = 48;

export function EditableSchedule({ widget, isSelected, onSelect, onConfigChange, colors }: EditableWidgetProps) {
  const config = widget.config;
  const startHour = (config.startHour as number) ?? 7;
  const endHour = (config.endHour as number) ?? 21;
  const title = (config.title as string) || "Schedule";
  const calendarIds = (config.calendarIds as string[]) || [];

  // Fetch calendar events if calendars are selected
  const { data: events } = usePlannerEvents(calendarIds, new Date());

  // Fetch calendars for color information
  const { data: calendars } = useQuery({
    queryKey: ["calendars"],
    queryFn: () => api.getCalendars(),
    enabled: calendarIds.length > 0,
  });

  // Create a map of calendar colors
  const calendarColorMap = new Map<string, string>();
  calendars?.forEach((cal) => {
    calendarColorMap.set(cal.id, cal.color || "#3B82F6");
  });

  // Filter events to those within the visible time range
  const visibleEvents = (events || []).filter((event) => {
    if (event.isAllDay) return false;
    const eventStart = new Date(event.startTime);
    const eventEnd = new Date(event.endTime);
    const eventStartHour = eventStart.getHours() + eventStart.getMinutes() / 60;
    const eventEndHour = eventEnd.getHours() + eventEnd.getMinutes() / 60;
    return eventEndHour > startHour && eventStartHour < endHour + 1;
  });

  // Calculate layout positions for overlapping events
  const eventLayouts = calculateEventLayouts(visibleEvents);

  const hours: number[] = [];
  for (let h = startHour; h <= endHour; h++) {
    hours.push(h);
  }

  const totalHeight = hours.length * HOUR_HEIGHT;

  return (
    <div
      style={{
        padding: "12px 14px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'DM Sans', sans-serif",
        color: colors.ink,
      }}
      onClick={onSelect}
    >
      <SectionTitle colors={colors}>{title}</SectionTitle>

      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={{ position: "relative", minHeight: totalHeight }}>
          {/* Hour grid with 30-minute marks */}
          {hours.map((h, index) => {
            const hr = h > 12 ? h - 12 : h;
            const ampm = h >= 12 ? "pm" : "am";
            const isLast = index === hours.length - 1;

            return (
              <div
                key={h}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  height: HOUR_HEIGHT,
                  position: "relative",
                }}
              >
                {/* Time label */}
                <div
                  style={{
                    width: 40,
                    flexShrink: 0,
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    color: colors.inkFaint,
                    padding: "0 6px 0 0",
                    textAlign: "right",
                    lineHeight: 1,
                    transform: "translateY(-6px)",
                  }}
                >
                  {String(hr).padStart(2, "0")}
                  <small style={{ fontSize: 9, display: "block", marginTop: 1 }}>{ampm}</small>
                </div>

                {/* Grid cell */}
                <div
                  style={{
                    flex: 1,
                    height: "100%",
                    borderLeft: `1.5px solid ${colors.ruleLine}`,
                    position: "relative",
                  }}
                >
                  {/* Hour line (top of cell) */}
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 1,
                      backgroundColor: colors.ruleLineLight,
                    }}
                  />

                  {/* 30-minute mark */}
                  <div
                    style={{
                      position: "absolute",
                      top: HOUR_HEIGHT / 2,
                      left: 0,
                      right: 0,
                      height: 1,
                      backgroundColor: colors.ruleLineLight,
                      opacity: 0.5,
                    }}
                  />

                  {/* Small tick mark for 30 min */}
                  <div
                    style={{
                      position: "absolute",
                      top: HOUR_HEIGHT / 2 - 3,
                      left: 0,
                      width: 6,
                      height: 6,
                      borderLeft: `1px dashed ${colors.ruleLine}`,
                    }}
                  />

                  {/* Bottom border for last hour */}
                  {isLast && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: 1,
                        backgroundColor: colors.ruleLineLight,
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}

          {/* Event blocks overlay */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 46, // Time label width + some padding
              right: 4,
              bottom: 0,
              pointerEvents: "none",
            }}
          >
            {visibleEvents.map((event) => {
              const layout = eventLayouts.get(event.id);
              return (
                <EventBlock
                  key={event.id}
                  event={event}
                  color={calendarColorMap.get(event.calendarId) || "#3B82F6"}
                  startHour={startHour}
                  endHour={endHour}
                  hourHeight={HOUR_HEIGHT}
                  colors={colors}
                  column={layout?.column ?? 0}
                  totalColumns={layout?.totalColumns ?? 1}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// Event block component - positioned absolutely based on time
interface EventBlockProps {
  event: CalendarEvent;
  color: string;
  startHour: number;
  endHour: number;
  hourHeight: number;
  colors: typeof import("./types").plannerColors;
  column: number;
  totalColumns: number;
}

function EventBlock({ event, color, startHour, endHour, hourHeight, colors, column, totalColumns }: EventBlockProps) {
  const eventStart = new Date(event.startTime);
  const eventEnd = new Date(event.endTime);

  // Calculate position in decimal hours from the start of the grid
  const eventStartDecimal = eventStart.getHours() + eventStart.getMinutes() / 60;
  const eventEndDecimal = eventEnd.getHours() + eventEnd.getMinutes() / 60;

  // Clamp to visible range
  const clampedStart = Math.max(eventStartDecimal, startHour);
  const clampedEnd = Math.min(eventEndDecimal, endHour + 1);

  // Convert to pixels
  const topOffset = (clampedStart - startHour) * hourHeight;
  const height = (clampedEnd - clampedStart) * hourHeight;

  // Format time for display
  const formatTime = (date: Date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? "pm" : "am";
    const displayHours = hours % 12 || 12;
    if (minutes === 0) {
      return `${displayHours}${ampm}`;
    }
    return `${displayHours}:${minutes.toString().padStart(2, "0")}${ampm}`;
  };

  const timeRange = `${formatTime(eventStart)} - ${formatTime(eventEnd)}`;
  const isShort = height < 32; // Short events need condensed display

  // Calculate width and left offset for overlapping events
  const widthPercent = 100 / totalColumns;
  const leftPercent = column * widthPercent;
  // Add small gap between columns
  const gapPx = totalColumns > 1 ? 2 : 0;

  return (
    <div
      style={{
        position: "absolute",
        top: topOffset,
        left: `calc(${leftPercent}% + ${column > 0 ? gapPx : 0}px)`,
        width: `calc(${widthPercent}% - ${gapPx}px)`,
        height: Math.max(height - 2, 18), // Min height, -2 for spacing
        backgroundColor: hexToRgba(color, 0.15),
        borderLeft: `3px solid ${color}`,
        borderRadius: 2,
        padding: isShort ? "2px 4px" : "4px 6px",
        overflow: "hidden",
        pointerEvents: "auto",
        cursor: "default",
        boxSizing: "border-box",
      }}
    >
      {isShort ? (
        // Condensed single-line display for short events
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 10,
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          <span style={{ fontWeight: 600, color: colors.ink }}>{event.title}</span>
          <span style={{ color: colors.inkFaint }}>{timeRange}</span>
        </div>
      ) : (
        // Full display for longer events
        <>
          <div
            style={{
              fontWeight: 600,
              fontSize: 11,
              color: colors.ink,
              lineHeight: 1.2,
              marginBottom: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {event.title}
          </div>
          <div
            style={{
              fontSize: 10,
              color: colors.inkLight,
              lineHeight: 1.2,
            }}
          >
            {timeRange}
          </div>
          {event.location && height > 50 && (
            <div
              style={{
                fontSize: 9,
                color: colors.inkFaint,
                marginTop: 2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {event.location}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Helper to convert hex to rgba
function hexToRgba(hex: string, alpha: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result || !result[1] || !result[2] || !result[3]) {
    return `rgba(59, 130, 246, ${alpha})`; // Fallback blue
  }
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Layout info for positioning overlapping events
interface EventLayout {
  column: number;
  totalColumns: number;
}

// Calculate layouts for overlapping events (Google Calendar style)
function calculateEventLayouts(events: CalendarEvent[]): Map<string, EventLayout> {
  const layouts = new Map<string, EventLayout>();

  if (events.length === 0) return layouts;

  // Sort events by start time, then by end time (longer events first)
  const sortedEvents = [...events].sort((a, b) => {
    const aStart = new Date(a.startTime).getTime();
    const bStart = new Date(b.startTime).getTime();
    if (aStart !== bStart) return aStart - bStart;
    // If same start, put longer events first
    const aEnd = new Date(a.endTime).getTime();
    const bEnd = new Date(b.endTime).getTime();
    return bEnd - aEnd;
  });

  // Track active columns (events currently in progress)
  interface ColumnSlot {
    eventId: string;
    endTime: number;
  }

  // Group overlapping events into clusters
  const clusters: CalendarEvent[][] = [];
  let currentCluster: CalendarEvent[] = [];
  let clusterEnd = 0;

  for (const event of sortedEvents) {
    const eventStart = new Date(event.startTime).getTime();
    const eventEnd = new Date(event.endTime).getTime();

    if (currentCluster.length === 0 || eventStart < clusterEnd) {
      // Event overlaps with current cluster
      currentCluster.push(event);
      clusterEnd = Math.max(clusterEnd, eventEnd);
    } else {
      // New cluster
      if (currentCluster.length > 0) {
        clusters.push(currentCluster);
      }
      currentCluster = [event];
      clusterEnd = eventEnd;
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  // Process each cluster to assign columns
  for (const cluster of clusters) {
    const columns: ColumnSlot[] = [];

    for (const event of cluster) {
      const eventStart = new Date(event.startTime).getTime();
      const eventEnd = new Date(event.endTime).getTime();

      // Find the first available column
      let assignedColumn = -1;
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        if (col && col.endTime <= eventStart) {
          // This column is free
          assignedColumn = i;
          columns[i] = { eventId: event.id, endTime: eventEnd };
          break;
        }
      }

      if (assignedColumn === -1) {
        // Need a new column
        assignedColumn = columns.length;
        columns.push({ eventId: event.id, endTime: eventEnd });
      }

      layouts.set(event.id, { column: assignedColumn, totalColumns: 0 });
    }

    // Update totalColumns for all events in this cluster
    const totalColumns = columns.length;
    for (const event of cluster) {
      const layout = layouts.get(event.id);
      if (layout) {
        layout.totalColumns = totalColumns;
      }
    }
  }

  return layouts;
}
