import "dotenv/config";
import { Bot, type Context, session, type SessionFlavor } from "grammy";
import {
  type Conversation,
  type ConversationFlavor,
  conversations,
  createConversation,
} from "@grammyjs/conversations";
import { todayCommand } from "./commands/today.js";
import { upcomingCommand } from "./commands/upcoming.js";
import { addEventConversation } from "./conversations/add-event.js";
import { ApiClient } from "./api-client.js";

// Session data
interface SessionData {
  apiKey?: string;
}

// Context type - properly extend Context with flavors
type MyContext = Context & SessionFlavor<SessionData> & ConversationFlavor;

type MyConversation = Conversation<MyContext>;

// Environment validation
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_URL = process.env.API_URL ?? "http://localhost:3001";
const API_KEY = process.env.API_KEY;

if (!TELEGRAM_BOT_TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN is required");
  process.exit(1);
}

if (!API_KEY) {
  console.error("API_KEY is required");
  process.exit(1);
}

// Create API client
export const apiClient = new ApiClient(API_URL, API_KEY);

// Create bot
const bot = new Bot<MyContext>(TELEGRAM_BOT_TOKEN);

// Install session middleware
bot.use(
  session({
    initial: (): SessionData => ({}),
  })
);

// Install conversations middleware
bot.use(conversations());

// Register conversations
bot.use(createConversation(addEventConversation));

// Start command
bot.command("start", async (ctx) => {
  await ctx.reply(
    `Welcome to OpenFrame Bot! 📅\n\n` +
      `Available commands:\n` +
      `/today - View today's events\n` +
      `/upcoming - View upcoming events (next 7 days)\n` +
      `/add - Add a new event\n` +
      `/help - Show this help message`
  );
});

// Help command
bot.command("help", async (ctx) => {
  await ctx.reply(
    `OpenFrame Bot Commands:\n\n` +
      `📅 /today - View today's events\n` +
      `📆 /upcoming - View events for the next 7 days\n` +
      `➕ /add - Add a new event to your calendar\n` +
      `❓ /help - Show this help message\n\n` +
      `You can also send me a message like "Meeting with John tomorrow at 2pm" to quickly add an event!`
  );
});

// Today command
bot.command("today", todayCommand);

// Upcoming command
bot.command("upcoming", upcomingCommand);

// Add event command - start conversation
bot.command("add", async (ctx) => {
  await ctx.conversation.enter("addEvent");
});

// Handle natural language event creation
bot.on("message:text", async (ctx) => {
  const text = ctx.message.text;

  // Check if it looks like an event description
  const eventPatterns = [
    /\b(meeting|call|lunch|dinner|appointment|event)\b/i,
    /\b(tomorrow|today|next|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    /\b(at|@)\s*\d{1,2}(:\d{2})?\s*(am|pm)?\b/i,
  ];

  const looksLikeEvent = eventPatterns.some((pattern) => pattern.test(text));

  if (looksLikeEvent) {
    try {
      await ctx.reply("Creating event...");

      const result = await apiClient.createQuickEvent(text);

      await ctx.reply(
        `✅ Event created!\n\n` +
          `📌 ${result.title}\n` +
          `📅 ${result.date}\n` +
          `⏰ ${result.time}\n` +
          `📁 ${result.calendar}`
      );
    } catch (error) {
      await ctx.reply(
        `❌ Could not create event. Try using /add for more options, or check the format:\n\n` +
          `Example: "Meeting with John tomorrow at 2pm"`
      );
    }
  }
});

// Error handler
bot.catch((err) => {
  console.error("Bot error:", err);
});

// Start bot
console.log("Starting OpenFrame Bot...");
bot.start();

export type { MyContext, MyConversation };
