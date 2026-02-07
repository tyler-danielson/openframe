import type { WidgetInstance } from "../stores/screensaver";

/**
 * Determines if a widget should be visible based on its visibility schedule.
 * @param widget The widget instance to check
 * @param now The current date/time (defaults to new Date())
 * @returns true if the widget should be visible, false otherwise
 */
export function isWidgetVisible(widget: WidgetInstance, now: Date = new Date()): boolean {
  // Hide countdown placeholders (no event assigned) on screensaver
  if (widget.type === "countdown" && !widget.config.eventId && !widget.config.targetDate) {
    return false;
  }

  const visibility = widget.visibility;

  // No schedule or schedule disabled = always visible
  if (!visibility?.enabled) return true;

  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentDayOfWeek = now.getDay();

  // Check day of week filter (empty array = all days allowed)
  if (visibility.daysOfWeek.length > 0) {
    if (!visibility.daysOfWeek.includes(currentDayOfWeek)) {
      return false;
    }
  }

  // Parse times
  const startParts = visibility.startTime.split(":").map(Number);
  const endParts = visibility.endTime.split(":").map(Number);

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
