import type { MyContext, MyConversation } from "../index.js";
import { apiClient } from "../index.js";

export async function addEventConversation(
  conversation: MyConversation,
  ctx: MyContext
) {
  await ctx.reply("Let's add a new event! What's the event title?");

  const titleResponse = await conversation.wait();
  const title = titleResponse.message?.text;

  if (!title) {
    await ctx.reply("❌ No title provided. Cancelled.");
    return;
  }

  await ctx.reply(
    "What date? (e.g., 'tomorrow', '2024-12-25', 'next Monday')"
  );

  const dateResponse = await conversation.wait();
  const dateText = dateResponse.message?.text;

  if (!dateText) {
    await ctx.reply("❌ No date provided. Cancelled.");
    return;
  }

  // Parse date
  const date = parseDate(dateText);
  if (!date) {
    await ctx.reply("❌ Could not understand the date. Cancelled.");
    return;
  }

  await ctx.reply(
    "What time? (e.g., '2pm', '14:00', 'all day')\n\nOr type 'skip' for an all-day event."
  );

  const timeResponse = await conversation.wait();
  const timeText = timeResponse.message?.text;

  let time: string | undefined;
  let isAllDay = false;

  if (!timeText || timeText.toLowerCase() === "skip" || timeText.toLowerCase() === "all day") {
    isAllDay = true;
  } else {
    time = timeText;
  }

  // Create the event
  try {
    await ctx.reply("Creating event...");

    const result = await apiClient.addEvent({
      title,
      date: formatDate(date),
      time: isAllDay ? undefined : time,
    });

    await ctx.reply(
      `✅ Event created!\n\n` +
        `📌 ${result.title}\n` +
        `📅 ${result.date}\n` +
        `⏰ ${result.time}\n` +
        `📁 ${result.calendar}`
    );
  } catch (error) {
    console.error("Add event error:", error);
    await ctx.reply(
      "❌ Failed to create event. Please check your input and try again."
    );
  }
}

function parseDate(text: string): Date | null {
  const lower = text.toLowerCase().trim();
  const today = new Date();

  if (lower === "today") {
    return today;
  }

  if (lower === "tomorrow") {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }

  // Next [day of week]
  const dayMatch = lower.match(
    /^next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/
  );
  if (dayMatch) {
    const dayNames = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const targetDay = dayNames.indexOf(dayMatch[1]!);
    const currentDay = today.getDay();
    let daysToAdd = targetDay - currentDay;
    if (daysToAdd <= 0) daysToAdd += 7;
    const result = new Date(today);
    result.setDate(result.getDate() + daysToAdd);
    return result;
  }

  // ISO date format
  const isoMatch = lower.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return new Date(
      parseInt(isoMatch[1]!),
      parseInt(isoMatch[2]!) - 1,
      parseInt(isoMatch[3]!)
    );
  }

  // US date format
  const usMatch = lower.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (usMatch) {
    const year = usMatch[3]
      ? parseInt(usMatch[3]) < 100
        ? 2000 + parseInt(usMatch[3])
        : parseInt(usMatch[3])
      : today.getFullYear();
    return new Date(year, parseInt(usMatch[1]!) - 1, parseInt(usMatch[2]!));
  }

  return null;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0]!;
}
