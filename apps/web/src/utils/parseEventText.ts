import { setHours, setMinutes, addHours } from "date-fns";

export interface ParsedEvent {
  title: string;
  startTime: Date | null; // null if no time found (all-day event)
  endTime: Date | null;
}

/**
 * Time pattern matchers for various natural language time expressions.
 */
const TIME_PATTERNS = {
  // "at 3pm", "at 3:30pm", "at 3 pm", "at 3:30 pm", "at 15:00"
  atTime: /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i,

  // "3pm", "3:30pm", "3 pm", "3:30 pm" (standalone time)
  standaloneTime: /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i,

  // "from 2pm to 4pm", "from 2-4pm", "from 2pm-4pm", "2pm to 4pm", "2pm-4pm"
  timeRange:
    /\b(?:from\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|-)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i,

  // "24hr format: 14:30", "15:00"
  militaryTime: /\b([01]?\d|2[0-3]):([0-5]\d)\b/,
};

/**
 * Parse hours and optional minutes from matched groups.
 * Handles AM/PM conversion.
 */
function parseTime(
  hourStr: string,
  minuteStr: string | undefined,
  ampm: string | undefined
): { hours: number; minutes: number } | null {
  let hours = parseInt(hourStr, 10);
  const minutes = minuteStr ? parseInt(minuteStr, 10) : 0;

  if (isNaN(hours) || hours < 0 || hours > 23) {
    return null;
  }

  if (ampm) {
    const isPM = ampm.toLowerCase() === "pm";
    if (hours === 12) {
      hours = isPM ? 12 : 0;
    } else if (isPM) {
      hours += 12;
    }
  } else if (hours <= 12 && hours >= 1) {
    // No AM/PM specified, assume PM for times like "3" (common for events)
    // unless it's clearly a morning time like 7, 8, 9
    if (hours >= 1 && hours <= 6) {
      hours += 12; // Assume 1-6 means PM
    }
  }

  return { hours, minutes };
}

/**
 * Parse natural language text into event details.
 *
 * @param text - The recognized text (e.g., "playdate at 3pm", "dinner 7pm-9pm")
 * @param targetDate - The date on which the event should be created
 * @returns ParsedEvent with title, startTime, and endTime
 *
 * @example
 * parseEventText("playdate at 3pm", new Date(2024, 0, 15))
 * // => { title: "playdate", startTime: Jan 15 2024 15:00, endTime: Jan 15 2024 16:00 }
 *
 * parseEventText("dinner from 7pm to 9pm", new Date(2024, 0, 15))
 * // => { title: "dinner", startTime: Jan 15 2024 19:00, endTime: Jan 15 2024 21:00 }
 *
 * parseEventText("buy groceries", new Date(2024, 0, 15))
 * // => { title: "buy groceries", startTime: null, endTime: null }
 */
export function parseEventText(text: string, targetDate: Date): ParsedEvent {
  let workingText = text.trim();
  let startTime: Date | null = null;
  let endTime: Date | null = null;

  // Try to match time range first (most specific)
  const rangeMatch = workingText.match(TIME_PATTERNS.timeRange);
  if (rangeMatch && rangeMatch[1] && rangeMatch[4]) {
    const startParsed = parseTime(rangeMatch[1], rangeMatch[2], rangeMatch[3]);
    const endParsed = parseTime(rangeMatch[4], rangeMatch[5], rangeMatch[6]);

    if (startParsed && endParsed) {
      startTime = setMinutes(
        setHours(targetDate, startParsed.hours),
        startParsed.minutes
      );
      endTime = setMinutes(
        setHours(targetDate, endParsed.hours),
        endParsed.minutes
      );

      // Handle case where end time is earlier (e.g., "11pm to 1am")
      if (endTime <= startTime) {
        endTime = addHours(endTime, 12);
        if (endTime <= startTime) {
          // Still not right, just add 1 hour to start
          endTime = addHours(startTime, 1);
        }
      }
    }

    // Remove the time range from text to get title
    workingText = workingText.replace(TIME_PATTERNS.timeRange, "").trim();
  }

  // Try "at X" pattern if no range found
  if (!startTime) {
    const atMatch = workingText.match(TIME_PATTERNS.atTime);
    if (atMatch && atMatch[1]) {
      const parsed = parseTime(atMatch[1], atMatch[2], atMatch[3]);
      if (parsed) {
        startTime = setMinutes(
          setHours(targetDate, parsed.hours),
          parsed.minutes
        );
        endTime = addHours(startTime, 1); // Default 1 hour duration
      }
      workingText = workingText.replace(TIME_PATTERNS.atTime, "").trim();
    }
  }

  // Try standalone time pattern (e.g., "dinner 7pm")
  if (!startTime) {
    const standaloneMatch = workingText.match(TIME_PATTERNS.standaloneTime);
    if (standaloneMatch && standaloneMatch[1]) {
      const parsed = parseTime(
        standaloneMatch[1],
        standaloneMatch[2],
        standaloneMatch[3]
      );
      if (parsed) {
        startTime = setMinutes(
          setHours(targetDate, parsed.hours),
          parsed.minutes
        );
        endTime = addHours(startTime, 1);
      }
      workingText = workingText
        .replace(TIME_PATTERNS.standaloneTime, "")
        .trim();
    }
  }

  // Try military time (e.g., "meeting 14:30")
  if (!startTime) {
    const militaryMatch = workingText.match(TIME_PATTERNS.militaryTime);
    if (militaryMatch && militaryMatch[1] && militaryMatch[2]) {
      const hours = parseInt(militaryMatch[1], 10);
      const minutes = parseInt(militaryMatch[2], 10);
      startTime = setMinutes(setHours(targetDate, hours), minutes);
      endTime = addHours(startTime, 1);
      workingText = workingText.replace(TIME_PATTERNS.militaryTime, "").trim();
    }
  }

  // Clean up the title
  let title = workingText
    .replace(/\s+/g, " ") // Normalize whitespace
    .replace(/^[-–—,.\s]+|[-–—,.\s]+$/g, "") // Remove leading/trailing punctuation
    .trim();

  // Capitalize first letter
  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }

  // If title is empty after parsing, use original text
  if (!title) {
    title = text.trim();
    if (title.length > 0) {
      title = title.charAt(0).toUpperCase() + title.slice(1);
    }
  }

  return {
    title,
    startTime,
    endTime,
  };
}
