/**
 * Telegram Bot Service
 * Wrapper around the Telegram Bot API for notifications and commands.
 *
 * API Documentation: https://core.telegram.org/bots/api
 *
 * Supported commands:
 * - /start - Link account and show welcome
 * - /today - Show today's events
 * - /tomorrow - Show tomorrow's events
 * - /week - Show this week's events
 * - /tasks - Show pending tasks
 * - /quick [text] - Quick add an event
 * - /help - Show available commands
 */

import type { FastifyInstance } from "fastify";
import { eq, and, gte, lte } from "drizzle-orm";
import { format, startOfDay, endOfDay, addDays, startOfWeek, endOfWeek } from "date-fns";
import {
  telegramConfig,
  telegramChats,
  calendars,
  events,
  tasks,
  taskLists,
} from "@openframe/database/schema";

const TELEGRAM_API_BASE = "https://api.telegram.org/bot";

// Telegram API types
export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  entities?: TelegramMessageEntity[];
}

export interface TelegramMessageEntity {
  type: string;
  offset: number;
  length: number;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: {
    id: string;
    from: TelegramUser;
    message?: TelegramMessage;
    data?: string;
  };
}

export interface TelegramBotInfo {
  id: number;
  is_bot: boolean;
  first_name: string;
  username: string;
  can_join_groups: boolean;
  can_read_all_group_messages: boolean;
  supports_inline_queries: boolean;
}

export class TelegramService {
  private db: FastifyInstance["db"];
  private fastify: FastifyInstance;
  private userId: string;

  constructor(fastify: FastifyInstance, userId: string) {
    this.db = fastify.db;
    this.fastify = fastify;
    this.userId = userId;
  }

  /**
   * Get the bot token for the current user
   */
  private async getBotToken(): Promise<string> {
    const [config] = await this.db
      .select()
      .from(telegramConfig)
      .where(eq(telegramConfig.userId, this.userId))
      .limit(1);

    if (!config) {
      throw new Error("Telegram bot not configured");
    }

    return config.botToken;
  }

  /**
   * Make request to Telegram Bot API
   */
  private async telegramFetch<T>(
    method: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const token = await this.getBotToken();

    const response = await fetch(`${TELEGRAM_API_BASE}${token}/${method}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!data.ok) {
      this.fastify.log.error(
        { error: data.description, method },
        "Telegram API error"
      );
      throw new Error(data.description || "Telegram API error");
    }

    return data.result;
  }

  /**
   * Get bot information
   */
  async getMe(): Promise<TelegramBotInfo> {
    return this.telegramFetch<TelegramBotInfo>("getMe");
  }

  /**
   * Send a text message
   */
  async sendMessage(
    chatId: string | number,
    text: string,
    options?: {
      parseMode?: "HTML" | "Markdown" | "MarkdownV2";
      disableWebPagePreview?: boolean;
      replyMarkup?: unknown;
    }
  ): Promise<TelegramMessage> {
    return this.telegramFetch<TelegramMessage>("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: options?.parseMode || "HTML",
      disable_web_page_preview: options?.disableWebPagePreview,
      reply_markup: options?.replyMarkup,
    });
  }

  /**
   * Set webhook for receiving updates
   */
  async setWebhook(
    url: string,
    options?: {
      secretToken?: string;
      maxConnections?: number;
      allowedUpdates?: string[];
    }
  ): Promise<boolean> {
    return this.telegramFetch<boolean>("setWebhook", {
      url,
      secret_token: options?.secretToken,
      max_connections: options?.maxConnections,
      allowed_updates: options?.allowedUpdates || ["message", "callback_query"],
    });
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(): Promise<boolean> {
    return this.telegramFetch<boolean>("deleteWebhook");
  }

  /**
   * Get webhook info
   */
  async getWebhookInfo(): Promise<{
    url: string;
    has_custom_certificate: boolean;
    pending_update_count: number;
    last_error_date?: number;
    last_error_message?: string;
  }> {
    return this.telegramFetch("getWebhookInfo");
  }

  // --- Command Handlers ---

  /**
   * Handle incoming message/command
   */
  async handleUpdate(update: TelegramUpdate): Promise<void> {
    const message = update.message;
    if (!message?.text) return;

    const chatId = message.chat.id.toString();
    const text = message.text.trim();

    // Check if it's a command
    if (text.startsWith("/")) {
      const parts = text.split(" ");
      const command = parts[0] || "";
      const args = parts.slice(1);
      const cmdName = command.substring(1).split("@")[0]; // Remove @ mention

      switch (cmdName) {
        case "start":
          await this.handleStart(chatId, message);
          break;
        case "today":
          await this.handleToday(chatId);
          break;
        case "tomorrow":
          await this.handleTomorrow(chatId);
          break;
        case "week":
          await this.handleWeek(chatId);
          break;
        case "tasks":
          await this.handleTasks(chatId);
          break;
        case "quick":
          await this.handleQuickAdd(chatId, args.join(" "));
          break;
        case "help":
          await this.handleHelp(chatId);
          break;
        default:
          await this.sendMessage(
            chatId,
            "Unknown command. Use /help to see available commands."
          );
      }
    }

    // Update last message time
    await this.db
      .update(telegramChats)
      .set({ lastMessageAt: new Date() })
      .where(
        and(
          eq(telegramChats.userId, this.userId),
          eq(telegramChats.chatId, chatId)
        )
      );
  }

  /**
   * Handle /start command - link chat to account
   */
  private async handleStart(
    chatId: string,
    message: TelegramMessage
  ): Promise<void> {
    const chat = message.chat;

    // Check if chat already linked
    const [existing] = await this.db
      .select()
      .from(telegramChats)
      .where(
        and(
          eq(telegramChats.userId, this.userId),
          eq(telegramChats.chatId, chatId)
        )
      )
      .limit(1);

    if (existing) {
      await this.sendMessage(
        chatId,
        "This chat is already linked to your OpenFrame account! Use /help to see available commands."
      );
      return;
    }

    // Link the chat
    await this.db.insert(telegramChats).values({
      userId: this.userId,
      chatId,
      chatType: chat.type,
      chatTitle: chat.title,
      firstName: chat.first_name,
      lastName: chat.last_name,
      username: chat.username,
      isActive: true,
    });

    await this.sendMessage(
      chatId,
      `Welcome to OpenFrame! 🗓️\n\nYour chat has been linked successfully. You'll now receive calendar notifications here.\n\nAvailable commands:\n/today - Today's schedule\n/tomorrow - Tomorrow's schedule\n/week - This week's events\n/tasks - Pending tasks\n/quick [text] - Quick add event\n/help - Show all commands`
    );
  }

  /**
   * Handle /today command
   */
  private async handleToday(chatId: string): Promise<void> {
    const today = new Date();
    const agenda = await this.getAgendaForDate(today);

    if (agenda.length === 0) {
      await this.sendMessage(chatId, "📅 <b>Today's Schedule</b>\n\nNo events scheduled for today.");
      return;
    }

    const header = `📅 <b>Today's Schedule</b>\n${format(today, "EEEE, MMMM d")}\n\n`;
    const eventList = this.formatEventList(agenda);
    await this.sendMessage(chatId, header + eventList);
  }

  /**
   * Handle /tomorrow command
   */
  private async handleTomorrow(chatId: string): Promise<void> {
    const tomorrow = addDays(new Date(), 1);
    const agenda = await this.getAgendaForDate(tomorrow);

    if (agenda.length === 0) {
      await this.sendMessage(chatId, "📅 <b>Tomorrow's Schedule</b>\n\nNo events scheduled for tomorrow.");
      return;
    }

    const header = `📅 <b>Tomorrow's Schedule</b>\n${format(tomorrow, "EEEE, MMMM d")}\n\n`;
    const eventList = this.formatEventList(agenda);
    await this.sendMessage(chatId, header + eventList);
  }

  /**
   * Handle /week command
   */
  private async handleWeek(chatId: string): Promise<void> {
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

    const agenda = await this.getAgendaForRange(weekStart, weekEnd);

    if (agenda.length === 0) {
      await this.sendMessage(chatId, "📅 <b>This Week</b>\n\nNo events scheduled this week.");
      return;
    }

    const header = `📅 <b>This Week</b>\n${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d")}\n\n`;
    const eventList = this.formatEventListGrouped(agenda);
    await this.sendMessage(chatId, header + eventList);
  }

  /**
   * Handle /tasks command
   */
  private async handleTasks(chatId: string): Promise<void> {
    // Get user's task lists
    const userTaskLists = await this.db
      .select()
      .from(taskLists)
      .where(eq(taskLists.userId, this.userId));

    if (userTaskLists.length === 0) {
      await this.sendMessage(chatId, "✅ <b>Tasks</b>\n\nNo task lists found.");
      return;
    }

    // Get pending tasks
    const pendingTasks = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.status, "needsAction"));

    const userTasks = pendingTasks.filter((t) =>
      userTaskLists.some((tl) => tl.id === t.taskListId)
    );

    if (userTasks.length === 0) {
      await this.sendMessage(chatId, "✅ <b>Tasks</b>\n\nNo pending tasks. Great job!");
      return;
    }

    const header = `✅ <b>Pending Tasks</b> (${userTasks.length})\n\n`;
    const taskList = userTasks
      .slice(0, 10) // Limit to 10 tasks
      .map((t) => {
        const dueStr = t.dueDate
          ? ` <i>(due ${format(new Date(t.dueDate), "MMM d")})</i>`
          : "";
        return `• ${t.title}${dueStr}`;
      })
      .join("\n");

    const footer =
      userTasks.length > 10 ? `\n\n<i>...and ${userTasks.length - 10} more</i>` : "";

    await this.sendMessage(chatId, header + taskList + footer);
  }

  /**
   * Handle /quick command - quick add an event
   */
  private async handleQuickAdd(chatId: string, text: string): Promise<void> {
    if (!text.trim()) {
      await this.sendMessage(
        chatId,
        "Usage: /quick [event description]\n\nExample: /quick Meeting with John tomorrow at 3pm"
      );
      return;
    }

    // For now, just acknowledge - actual implementation would parse natural language
    await this.sendMessage(
      chatId,
      `📝 Quick add is not yet implemented.\n\nYou tried to add: "${text}"\n\nPlease use the OpenFrame web interface to add events for now.`
    );
  }

  /**
   * Handle /help command
   */
  private async handleHelp(chatId: string): Promise<void> {
    const helpText = `<b>OpenFrame Bot Commands</b>

📅 <b>Calendar</b>
/today - Show today's schedule
/tomorrow - Show tomorrow's schedule
/week - Show this week's events

✅ <b>Tasks</b>
/tasks - Show pending tasks

📝 <b>Quick Actions</b>
/quick [text] - Quick add an event (coming soon)

ℹ️ <b>Other</b>
/help - Show this help message

<i>Tip: You'll receive automatic reminders for upcoming events!</i>`;

    await this.sendMessage(chatId, helpText);
  }

  // --- Helper Methods ---

  /**
   * Get events for a specific date
   */
  private async getAgendaForDate(date: Date): Promise<typeof events.$inferSelect[]> {
    const start = startOfDay(date);
    const end = endOfDay(date);
    return this.getAgendaForRange(start, end);
  }

  /**
   * Get events for a date range
   */
  private async getAgendaForRange(
    start: Date,
    end: Date
  ): Promise<typeof events.$inferSelect[]> {
    // Get user's visible calendars
    const userCalendars = await this.db
      .select()
      .from(calendars)
      .where(
        and(eq(calendars.userId, this.userId), eq(calendars.isVisible, true))
      );

    if (userCalendars.length === 0) {
      return [];
    }

    const calendarIds = userCalendars.map((c) => c.id);

    // Get events in range
    const allEvents = await this.db
      .select()
      .from(events)
      .where(
        and(
          gte(events.startTime, start),
          lte(events.startTime, end)
        )
      );

    // Filter to user's calendars
    return allEvents
      .filter((e) => calendarIds.includes(e.calendarId))
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }

  /**
   * Format a list of events for display
   */
  private formatEventList(eventList: typeof events.$inferSelect[]): string {
    return eventList
      .map((e) => {
        if (e.isAllDay) {
          return `🔵 <b>${e.title}</b> (All day)`;
        }
        const time = format(new Date(e.startTime), "h:mm a");
        const location = e.location ? `\n   📍 ${e.location}` : "";
        return `⏰ ${time} - <b>${e.title}</b>${location}`;
      })
      .join("\n\n");
  }

  /**
   * Format events grouped by day
   */
  private formatEventListGrouped(
    eventList: typeof events.$inferSelect[]
  ): string {
    const grouped = new Map<string, typeof events.$inferSelect[]>();

    for (const event of eventList) {
      const dateKey = format(new Date(event.startTime), "yyyy-MM-dd");
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(event);
    }

    const parts: string[] = [];
    for (const [dateKey, dayEvents] of grouped) {
      const date = new Date(dateKey);
      const dayHeader = `<b>${format(date, "EEEE, MMM d")}</b>`;
      const eventLines = dayEvents
        .map((e) => {
          if (e.isAllDay) {
            return `  🔵 ${e.title}`;
          }
          const time = format(new Date(e.startTime), "h:mm a");
          return `  ⏰ ${time} - ${e.title}`;
        })
        .join("\n");
      parts.push(`${dayHeader}\n${eventLines}`);
    }

    return parts.join("\n\n");
  }

  // --- Static Methods ---

  /**
   * Connect a bot using its token
   */
  static async connect(
    fastify: FastifyInstance,
    userId: string,
    botToken: string
  ): Promise<{ botInfo: TelegramBotInfo }> {
    // Test the token by getting bot info
    const response = await fetch(`${TELEGRAM_API_BASE}${botToken}/getMe`);
    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.description || "Invalid bot token");
    }

    const botInfo: TelegramBotInfo = data.result;

    // Generate webhook secret
    const webhookSecret = crypto.randomUUID();

    // Check if already connected
    const [existing] = await fastify.db
      .select()
      .from(telegramConfig)
      .where(eq(telegramConfig.userId, userId))
      .limit(1);

    if (existing) {
      // Update existing config
      await fastify.db
        .update(telegramConfig)
        .set({
          botToken,
          botUsername: botInfo.username,
          webhookSecret,
          isConnected: true,
          updatedAt: new Date(),
        })
        .where(eq(telegramConfig.userId, userId));
    } else {
      // Create new config
      await fastify.db.insert(telegramConfig).values({
        userId,
        botToken,
        botUsername: botInfo.username,
        webhookSecret,
        isConnected: true,
      });
    }

    return { botInfo };
  }

  /**
   * Disconnect the bot
   */
  static async disconnect(
    fastify: FastifyInstance,
    userId: string
  ): Promise<void> {
    // Get config to delete webhook
    const [config] = await fastify.db
      .select()
      .from(telegramConfig)
      .where(eq(telegramConfig.userId, userId))
      .limit(1);

    if (config) {
      // Try to delete webhook
      try {
        await fetch(`${TELEGRAM_API_BASE}${config.botToken}/deleteWebhook`);
      } catch {
        // Ignore errors
      }
    }

    // Delete config
    await fastify.db
      .delete(telegramConfig)
      .where(eq(telegramConfig.userId, userId));

    // Delete linked chats
    await fastify.db
      .delete(telegramChats)
      .where(eq(telegramChats.userId, userId));
  }

  /**
   * Get the current user's Telegram config
   */
  static async getConfig(
    fastify: FastifyInstance,
    userId: string
  ): Promise<typeof telegramConfig.$inferSelect | null> {
    const [config] = await fastify.db
      .select()
      .from(telegramConfig)
      .where(eq(telegramConfig.userId, userId))
      .limit(1);

    return config || null;
  }

  /**
   * Get linked chats for a user
   */
  static async getChats(
    fastify: FastifyInstance,
    userId: string
  ): Promise<typeof telegramChats.$inferSelect[]> {
    return fastify.db
      .select()
      .from(telegramChats)
      .where(eq(telegramChats.userId, userId));
  }

  /**
   * Test if the bot token is valid
   */
  static async testConnection(
    fastify: FastifyInstance,
    userId: string
  ): Promise<boolean> {
    try {
      const config = await TelegramService.getConfig(fastify, userId);
      if (!config) {
        return false;
      }

      const response = await fetch(`${TELEGRAM_API_BASE}${config.botToken}/getMe`);
      const data = await response.json();

      const isValid = data.ok === true;

      // Update connection status if changed
      if (config.isConnected !== isValid) {
        await fastify.db
          .update(telegramConfig)
          .set({ isConnected: isValid, updatedAt: new Date() })
          .where(eq(telegramConfig.userId, userId));
      }

      return isValid;
    } catch (error) {
      fastify.log.error({ err: error }, "Telegram connection test failed");
      return false;
    }
  }

  /**
   * Send a notification to all linked chats
   */
  static async broadcast(
    fastify: FastifyInstance,
    userId: string,
    message: string,
    options?: { parseMode?: "HTML" | "Markdown" }
  ): Promise<{ sent: number; failed: number }> {
    const config = await TelegramService.getConfig(fastify, userId);
    if (!config) {
      throw new Error("Telegram not configured");
    }

    const chats = await TelegramService.getChats(fastify, userId);
    const activeChats = chats.filter((c) => c.isActive);

    let sent = 0;
    let failed = 0;

    for (const chat of activeChats) {
      try {
        await fetch(`${TELEGRAM_API_BASE}${config.botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chat.chatId,
            text: message,
            parse_mode: options?.parseMode || "HTML",
          }),
        });
        sent++;
      } catch {
        failed++;
      }
    }

    return { sent, failed };
  }
}
