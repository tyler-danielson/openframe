import type { WidgetInstance, VisibilityCondition, TimeScheduleCondition, HAEntityCondition, SpotifyPlayingCondition, CalendarEventCondition } from "../stores/screensaver";

export interface VisibilityContext {
  now: Date;
  getEntityState?: (entityId: string) => { state: string; attributes: Record<string, unknown> } | undefined;
  spotifyPlaying?: boolean;
  activeEvents?: { calendarId: string; startTime: string; endTime: string }[];
}

/**
 * Determines if a widget should be visible based on its visibility conditions.
 * @param widget The widget instance to check
 * @param ctx Visibility context with current state from HA, Spotify, calendar, etc.
 * @returns true if the widget should be visible, false otherwise
 */
export function isWidgetVisible(widget: WidgetInstance, ctx: VisibilityContext = { now: new Date() }): boolean {
  // Hide countdown placeholders (no event assigned) on screensaver
  if (widget.type === "countdown" && !widget.config.eventId && !widget.config.targetDate) {
    return false;
  }

  // New multi-condition system takes precedence
  const vc = widget.visibilityConditions;
  if (vc?.enabled && vc.conditions.length > 0) {
    const results = vc.conditions.map((c) => evaluateCondition(c, ctx));
    const visible = vc.logic === "any" ? results.some(Boolean) : results.every(Boolean);
    return visible;
  }

  // Legacy visibility schedule (backward compatibility)
  const visibility = widget.visibility;
  if (!visibility?.enabled) return true;

  return evaluateTimeSchedule(
    { type: "time-schedule", startTime: visibility.startTime, endTime: visibility.endTime, daysOfWeek: visibility.daysOfWeek },
    ctx.now
  );
}

function evaluateCondition(condition: VisibilityCondition, ctx: VisibilityContext): boolean {
  switch (condition.type) {
    case "time-schedule":
      return evaluateTimeSchedule(condition, ctx.now);
    case "ha-entity":
      return evaluateHAEntity(condition, ctx);
    case "spotify-playing":
      return evaluateSpotifyPlaying(condition, ctx);
    case "calendar-event":
      return evaluateCalendarEvent(condition, ctx);
    default:
      return true;
  }
}

function evaluateTimeSchedule(condition: TimeScheduleCondition, now: Date): boolean {
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentDayOfWeek = now.getDay();

  // Check day of week filter (empty array = all days allowed)
  if (condition.daysOfWeek.length > 0) {
    if (!condition.daysOfWeek.includes(currentDayOfWeek)) {
      return false;
    }
  }

  // Parse times
  const startParts = condition.startTime.split(":").map(Number);
  const endParts = condition.endTime.split(":").map(Number);

  const startHour = startParts[0] ?? 0;
  const startMin = startParts[1] ?? 0;
  const endHour = endParts[0] ?? 23;
  const endMin = endParts[1] ?? 59;

  const currentMins = currentHour * 60 + currentMinute;
  const startMins = startHour * 60 + startMin;
  const endMins = endHour * 60 + endMin;

  // Handle overnight range (e.g., 19:00 to 07:00)
  if (startMins > endMins) {
    return currentMins >= startMins || currentMins < endMins;
  }

  // Normal range (e.g., 09:00 to 17:00)
  return currentMins >= startMins && currentMins < endMins;
}

function evaluateHAEntity(condition: HAEntityCondition, ctx: VisibilityContext): boolean {
  if (!ctx.getEntityState) return true; // No HA connection, don't hide
  const entity = ctx.getEntityState(condition.entityId);
  if (!entity) return true; // Entity not found, don't hide

  const actual = entity.state;
  const expected = condition.value;

  // Attempt numeric comparison if both sides are numbers
  const actualNum = Number(actual);
  const expectedNum = Number(expected);
  const bothNumeric = !isNaN(actualNum) && !isNaN(expectedNum) && actual !== "" && expected !== "";

  switch (condition.operator) {
    case "eq":
      return bothNumeric ? actualNum === expectedNum : actual === expected;
    case "neq":
      return bothNumeric ? actualNum !== expectedNum : actual !== expected;
    case "gt":
      return bothNumeric ? actualNum > expectedNum : actual > expected;
    case "lt":
      return bothNumeric ? actualNum < expectedNum : actual < expected;
    case "gte":
      return bothNumeric ? actualNum >= expectedNum : actual >= expected;
    case "lte":
      return bothNumeric ? actualNum <= expectedNum : actual <= expected;
    case "contains":
      return actual.toLowerCase().includes(expected.toLowerCase());
    default:
      return true;
  }
}

function evaluateSpotifyPlaying(condition: SpotifyPlayingCondition, ctx: VisibilityContext): boolean {
  if (ctx.spotifyPlaying === undefined) return true; // No Spotify data, don't hide
  return ctx.spotifyPlaying === condition.isPlaying;
}

function evaluateCalendarEvent(condition: CalendarEventCondition, ctx: VisibilityContext): boolean {
  if (!ctx.activeEvents) return true; // No calendar data, don't hide

  const now = ctx.now.getTime();

  // Filter to currently active events
  let active = ctx.activeEvents.filter((e) => {
    const start = new Date(e.startTime).getTime();
    const end = new Date(e.endTime).getTime();
    return start <= now && now < end;
  });

  // Filter by specific calendars if specified
  if (condition.calendarIds && condition.calendarIds.length > 0) {
    active = active.filter((e) => condition.calendarIds!.includes(e.calendarId));
  }

  const hasActive = active.length > 0;
  return condition.hasActiveEvent ? hasActive : !hasActive;
}
