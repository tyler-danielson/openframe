import type { MyContext } from "../index.js";
import { apiClient } from "../index.js";

export async function upcomingCommand(ctx: MyContext) {
  try {
    await ctx.reply("Fetching upcoming events...");

    const data = await apiClient.getUpcoming(7);

    if (data.days.length === 0) {
      await ctx.reply("📆 No upcoming events in the next 7 days.");
      return;
    }

    let message = `📆 Upcoming Events\n`;
    message += `${data.startDate} to ${data.endDate}\n\n`;

    for (const day of data.days) {
      message += `📅 ${day.dayName}\n`;

      for (const event of day.events) {
        message += `  ⏰ ${event.time} - ${event.title}`;
        if (event.location) {
          message += ` 📍`;
        }
        message += `\n`;
      }

      message += `\n`;
    }

    // Telegram message length limit is 4096
    if (message.length > 4000) {
      // Send in chunks
      const chunks = [];
      let currentChunk = "";

      for (const line of message.split("\n")) {
        if (currentChunk.length + line.length > 3900) {
          chunks.push(currentChunk);
          currentChunk = "";
        }
        currentChunk += line + "\n";
      }

      if (currentChunk) {
        chunks.push(currentChunk);
      }

      for (const chunk of chunks) {
        await ctx.reply(chunk.trim());
      }
    } else {
      await ctx.reply(message.trim());
    }
  } catch (error) {
    console.error("Upcoming command error:", error);
    await ctx.reply("❌ Failed to fetch upcoming events. Please try again later.");
  }
}
