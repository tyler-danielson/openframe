import type { MyContext } from "../index.js";
import { apiClient } from "../index.js";

export async function todayCommand(ctx: MyContext) {
  try {
    await ctx.reply("Fetching today's events...");

    const data = await apiClient.getToday();

    if (data.events.length === 0) {
      await ctx.reply(`📅 ${data.date}\n\n${data.summary}`);
      return;
    }

    let message = `📅 ${data.date}\n\n`;

    for (const event of data.events) {
      message += `⏰ ${event.time}\n`;
      message += `📌 ${event.title}\n`;
      if (event.location) {
        message += `📍 ${event.location}\n`;
      }
      message += `📁 ${event.calendar}\n\n`;
    }

    await ctx.reply(message.trim());
  } catch (error) {
    console.error("Today command error:", error);
    await ctx.reply("❌ Failed to fetch today's events. Please try again later.");
  }
}
