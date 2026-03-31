export interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
}

export function calculateTimeRemaining(targetDate: Date): TimeRemaining {
  const now = new Date();
  const diff = targetDate.getTime() - now.getTime();

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
  }

  // Count calendar days (midnights) between now and the event, so that an
  // event on Friday shows "2d" on Wednesday regardless of time-of-day.
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetMidnight = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const days = Math.max(0, Math.round((targetMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24)));

  // Hours/minutes/seconds use the exact time-of-day difference so the
  // sub-day portion counts down naturally toward the event start time.
  const nowTod = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const targetTod = targetDate.getHours() * 3600 + targetDate.getMinutes() * 60 + targetDate.getSeconds();
  // If the event time-of-day hasn't passed yet today, show remaining time
  // toward that time. If it has, the hours/minutes/seconds are 0 since the
  // calendar-day count already covers the full gap.
  const todDiff = Math.max(0, targetTod - nowTod);

  const hours = Math.floor(todDiff / 3600);
  const minutes = Math.floor((todDiff % 3600) / 60);
  const seconds = todDiff % 60;

  return { days, hours, minutes, seconds, isExpired: false };
}

export function formatCountdown(tr: TimeRemaining): string {
  if (tr.isExpired) return "Expired";
  const parts: string[] = [];
  if (tr.days > 0) parts.push(`${tr.days}d`);
  if (tr.hours > 0) parts.push(`${tr.hours}h`);
  if (tr.minutes > 0) parts.push(`${tr.minutes}m`);
  if (parts.length === 0) parts.push(`${tr.seconds}s`);
  return parts.join(" ");
}

/**
 * Format countdown using the user-chosen format from event metadata.
 * Formats: "dhm" (days/hours/minutes), "dh" (days/hours), "d" (days only), "sleeps"
 */
export function formatCountdownWithOptions(tr: TimeRemaining, format: string, targetDate: Date): string {
  if (tr.isExpired) return "Expired";

  if (format === "sleeps") {
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const eventMidnight = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const sleeps = Math.max(0, Math.round((eventMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24)));
    if (sleeps === 0) return "Today!";
    return `${sleeps} ${sleeps === 1 ? "sleep" : "sleeps"}`;
  }

  const parts: string[] = [];
  if (format === "dhm" || format === "dh" || format === "d") {
    if (tr.days > 0) parts.push(`${tr.days}d`);
  }
  if (format === "dhm" || format === "dh") {
    if (tr.hours > 0 || tr.days > 0) parts.push(`${tr.hours}h`);
  }
  if (format === "dhm") {
    if (tr.minutes > 0 || tr.hours > 0 || tr.days > 0) parts.push(`${tr.minutes}m`);
  }
  if (parts.length === 0) parts.push(`${tr.seconds}s`);
  return parts.join(" ");
}
