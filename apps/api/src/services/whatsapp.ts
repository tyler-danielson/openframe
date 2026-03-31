/**
 * WhatsApp Bot Service
 * Uses Baileys (WhatsApp Web multi-device) for self-hosted WhatsApp integration.
 *
 * Supported commands:
 * - /start - Show welcome message
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
import path from "path";
import fs from "fs";
import {
  whatsappConfig,
  whatsappChats,
  calendars,
  events,
  tasks,
  taskLists,
} from "@openframe/database/schema";
import { decryptEventFields } from "../lib/encryption.js";

// Baileys - dynamic import to handle ESM/CJS differences
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _baileys: any = null;

async function loadBaileys() {
  if (_baileys) return _baileys;
  _baileys = await import("@whiskeysockets/baileys");
  return _baileys;
}

// Active socket connections keyed by userId
const activeSockets = new Map<string, {
  socket: any; // WASocket type from Baileys
  userId: string;
}>();

// QR code callbacks for pending connections keyed by userId
const qrCallbacks = new Map<string, (qr: string | null, error?: string) => void>();

const DATA_DIR = process.env.WHATSAPP_DATA_DIR || "./data/whatsapp-sessions";

function getSessionDir(userId: string): string {
  return path.join(DATA_DIR, userId);
}

export class WhatsAppService {
  private db: FastifyInstance["db"];
  private fastify: FastifyInstance;
  private userId: string;

  constructor(fastify: FastifyInstance, userId: string) {
    this.db = fastify.db;
    this.fastify = fastify;
    this.userId = userId;
  }

  /**
   * Send a text message to a WhatsApp JID
   */
  async sendMessage(jid: string, text: string): Promise<void> {
    const conn = activeSockets.get(this.userId);
    if (!conn) {
      throw new Error("WhatsApp not connected");
    }
    await conn.socket.sendMessage(jid, { text });
  }

  // --- Command Handlers ---

  async handleMessage(jid: string, messageText: string): Promise<void> {
    const text = messageText.trim();

    if (text.startsWith("/")) {
      const parts = text.split(" ");
      const command = parts[0] || "";
      const args = parts.slice(1);
      const cmdName = command.substring(1).toLowerCase();

      switch (cmdName) {
        case "start":
          await this.handleStart(jid);
          break;
        case "today":
          await this.handleToday(jid);
          break;
        case "tomorrow":
          await this.handleTomorrow(jid);
          break;
        case "week":
          await this.handleWeek(jid);
          break;
        case "tasks":
          await this.handleTasks(jid);
          break;
        case "quick":
          await this.handleQuickAdd(jid, args.join(" "));
          break;
        case "help":
          await this.handleHelp(jid);
          break;
        default:
          await this.sendMessage(jid, "Unknown command. Send /help to see available commands.");
      }
    }

    // Update last message time for this chat
    await this.db
      .update(whatsappChats)
      .set({ lastMessageAt: new Date() })
      .where(
        and(
          eq(whatsappChats.userId, this.userId),
          eq(whatsappChats.jid, jid)
        )
      );
  }

  private async handleStart(jid: string): Promise<void> {
    // Auto-link the chat
    const [existing] = await this.db
      .select()
      .from(whatsappChats)
      .where(
        and(
          eq(whatsappChats.userId, this.userId),
          eq(whatsappChats.jid, jid)
        )
      )
      .limit(1);

    if (!existing) {
      const isGroup = jid.endsWith("@g.us");
      await this.db.insert(whatsappChats).values({
        userId: this.userId,
        jid,
        chatType: isGroup ? "group" : "private",
        isActive: true,
      });
    }

    await this.sendMessage(
      jid,
      `Welcome to OpenFrame! 🗓️

Your chat has been linked. You'll receive calendar notifications here.

*Available commands:*
/today - Today's schedule
/tomorrow - Tomorrow's schedule
/week - This week's events
/tasks - Pending tasks
/quick [text] - Quick add event
/help - Show all commands`
    );
  }

  private async handleToday(jid: string): Promise<void> {
    const today = new Date();
    const agenda = await this.getAgendaForDate(today);

    if (agenda.length === 0) {
      await this.sendMessage(jid, "📅 *Today's Schedule*\n\nNo events scheduled for today.");
      return;
    }

    const header = `📅 *Today's Schedule*\n${format(today, "EEEE, MMMM d")}\n\n`;
    const eventList = this.formatEventList(agenda);
    await this.sendMessage(jid, header + eventList);
  }

  private async handleTomorrow(jid: string): Promise<void> {
    const tomorrow = addDays(new Date(), 1);
    const agenda = await this.getAgendaForDate(tomorrow);

    if (agenda.length === 0) {
      await this.sendMessage(jid, "📅 *Tomorrow's Schedule*\n\nNo events scheduled for tomorrow.");
      return;
    }

    const header = `📅 *Tomorrow's Schedule*\n${format(tomorrow, "EEEE, MMMM d")}\n\n`;
    const eventList = this.formatEventList(agenda);
    await this.sendMessage(jid, header + eventList);
  }

  private async handleWeek(jid: string): Promise<void> {
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });

    const agenda = await this.getAgendaForRange(weekStart, weekEnd);

    if (agenda.length === 0) {
      await this.sendMessage(jid, "📅 *This Week*\n\nNo events scheduled this week.");
      return;
    }

    const header = `📅 *This Week*\n${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d")}\n\n`;
    const eventList = this.formatEventListGrouped(agenda);
    await this.sendMessage(jid, header + eventList);
  }

  private async handleTasks(jid: string): Promise<void> {
    const userTaskLists = await this.db
      .select()
      .from(taskLists)
      .where(eq(taskLists.userId, this.userId));

    if (userTaskLists.length === 0) {
      await this.sendMessage(jid, "✅ *Tasks*\n\nNo task lists found.");
      return;
    }

    const pendingTasks = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.status, "needsAction"));

    const userTasks = pendingTasks.filter((t) =>
      userTaskLists.some((tl) => tl.id === t.taskListId)
    );

    if (userTasks.length === 0) {
      await this.sendMessage(jid, "✅ *Tasks*\n\nNo pending tasks. Great job!");
      return;
    }

    const header = `✅ *Pending Tasks* (${userTasks.length})\n\n`;
    const taskList = userTasks
      .slice(0, 10)
      .map((t) => {
        const dueStr = t.dueDate
          ? ` _(due ${format(new Date(t.dueDate), "MMM d")})_`
          : "";
        return `• ${t.title}${dueStr}`;
      })
      .join("\n");

    const footer =
      userTasks.length > 10 ? `\n\n_...and ${userTasks.length - 10} more_` : "";

    await this.sendMessage(jid, header + taskList + footer);
  }

  private async handleQuickAdd(jid: string, text: string): Promise<void> {
    if (!text.trim()) {
      await this.sendMessage(
        jid,
        "Usage: /quick [event description]\n\nExample: /quick Meeting with John tomorrow at 3pm"
      );
      return;
    }

    await this.sendMessage(
      jid,
      `📝 Quick add is not yet implemented.\n\nYou tried to add: "${text}"\n\nPlease use the OpenFrame web interface to add events for now.`
    );
  }

  private async handleHelp(jid: string): Promise<void> {
    const helpText = `*OpenFrame WhatsApp Commands*

📅 *Calendar*
/today - Show today's schedule
/tomorrow - Show tomorrow's schedule
/week - Show this week's events

✅ *Tasks*
/tasks - Show pending tasks

📝 *Quick Actions*
/quick [text] - Quick add an event (coming soon)

ℹ️ *Other*
/help - Show this help message

_Tip: You'll receive automatic reminders for upcoming events!_`;

    await this.sendMessage(jid, helpText);
  }

  // --- Helper Methods ---

  private async getAgendaForDate(date: Date): Promise<typeof events.$inferSelect[]> {
    const start = startOfDay(date);
    const end = endOfDay(date);
    return this.getAgendaForRange(start, end);
  }

  private async getAgendaForRange(
    start: Date,
    end: Date
  ): Promise<typeof events.$inferSelect[]> {
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

    const allEvents = await this.db
      .select()
      .from(events)
      .where(
        and(
          gte(events.startTime, start),
          lte(events.startTime, end)
        )
      );

    return allEvents
      .map(decryptEventFields)
      .filter((e) => calendarIds.includes(e.calendarId))
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }

  private formatEventList(eventList: typeof events.$inferSelect[]): string {
    return eventList
      .map((e) => {
        if (e.isAllDay) {
          return `🔵 *${e.title}* (All day)`;
        }
        const time = format(new Date(e.startTime), "h:mm a");
        const location = e.location ? `\n   📍 ${e.location}` : "";
        return `⏰ ${time} - *${e.title}*${location}`;
      })
      .join("\n\n");
  }

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
      const dayHeader = `*${format(date, "EEEE, MMM d")}*`;
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
   * Start the connection flow — creates a Baileys socket and returns QR codes via callback.
   * The callback receives null when the connection is established.
   */
  static async connect(
    fastify: FastifyInstance,
    userId: string,
    onQR: (qr: string | null, error?: string) => void
  ): Promise<void> {
    const baileys = await loadBaileys();

    // Close any existing connection
    const existingConn = activeSockets.get(userId);
    if (existingConn) {
      try {
        existingConn.socket.end(undefined);
      } catch {
        // ignore
      }
      activeSockets.delete(userId);
    }

    const sessionDir = getSessionDir(userId);
    fs.mkdirSync(sessionDir, { recursive: true });

    const { state, saveCreds } = await baileys.useMultiFileAuthState(sessionDir);

    const logger = fastify.log.child({ module: "whatsapp", userId });

    const socket = baileys.default({
      auth: {
        creds: state.creds,
        keys: baileys.makeCacheableSignalKeyStore(state.keys, logger as any),
      },
      printQRInTerminal: false,
      logger: logger as any,
      browser: ["OpenFrame", "Chrome", "1.0.0"] as any,
    });

    // Store the QR callback
    qrCallbacks.set(userId, onQR);

    // Handle connection updates
    socket.ev.on("connection.update", async (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        // Send QR code to the pending callback
        const cb = qrCallbacks.get(userId);
        if (cb) {
          cb(qr);
        }
      }

      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== baileys.DisconnectReason.loggedOut;

        logger.info({ statusCode, shouldReconnect }, "WhatsApp connection closed");

        if (shouldReconnect) {
          // Reconnect
          WhatsAppService.connect(fastify, userId, onQR).catch((err) => {
            logger.error({ err }, "WhatsApp reconnection failed");
          });
        } else {
          // Logged out — clean up
          activeSockets.delete(userId);
          qrCallbacks.delete(userId);
          await fastify.db
            .update(whatsappConfig)
            .set({ isConnected: false, updatedAt: new Date() })
            .where(eq(whatsappConfig.userId, userId));
        }
      }

      if (connection === "open") {
        logger.info("WhatsApp connected successfully");
        qrCallbacks.delete(userId);

        // Get phone info from socket
        const phoneNumber = socket.user?.id?.split(":")[0] || null;
        const displayName = socket.user?.name || null;

        // Upsert config
        const [existing] = await fastify.db
          .select()
          .from(whatsappConfig)
          .where(eq(whatsappConfig.userId, userId))
          .limit(1);

        if (existing) {
          await fastify.db
            .update(whatsappConfig)
            .set({
              phoneNumber,
              displayName,
              isConnected: true,
              sessionDir,
              updatedAt: new Date(),
            })
            .where(eq(whatsappConfig.userId, userId));
        } else {
          await fastify.db.insert(whatsappConfig).values({
            userId,
            phoneNumber,
            displayName,
            isConnected: true,
            sessionDir,
          });
        }

        // Signal to frontend that connection is complete
        const cb = qrCallbacks.get(userId);
        if (cb) {
          cb(null); // null means connected
        }
      }
    });

    // Save credentials when they update
    socket.ev.on("creds.update", saveCreds);

    // Handle incoming messages
    socket.ev.on("messages.upsert", async ({ messages, type }: { messages: any[]; type: string }) => {
      if (type !== "notify") return;

      for (const msg of messages) {
        // Skip messages from self
        if (msg.key.fromMe) continue;
        // Skip non-text messages for now
        const text =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text;
        if (!text) continue;

        const jid = msg.key.remoteJid;
        if (!jid) continue;

        try {
          const service = new WhatsAppService(fastify, userId);

          // Auto-link chat if not linked yet
          const [existingChat] = await fastify.db
            .select()
            .from(whatsappChats)
            .where(
              and(
                eq(whatsappChats.userId, userId),
                eq(whatsappChats.jid, jid)
              )
            )
            .limit(1);

          if (!existingChat) {
            const isGroup = jid.endsWith("@g.us");
            const chatName = msg.pushName || null;
            await fastify.db.insert(whatsappChats).values({
              userId,
              jid,
              chatType: isGroup ? "group" : "private",
              chatName,
              isActive: true,
            });
          }

          await service.handleMessage(jid, text);
        } catch (err) {
          logger.error({ err, jid }, "Error handling WhatsApp message");
        }
      }
    });

    // Store the active socket
    activeSockets.set(userId, { socket, userId });
  }

  /**
   * Disconnect WhatsApp and clean up session
   */
  static async disconnect(
    fastify: FastifyInstance,
    userId: string
  ): Promise<void> {
    // Close socket
    const conn = activeSockets.get(userId);
    if (conn) {
      try {
        await conn.socket.logout();
      } catch {
        try {
          conn.socket.end(undefined);
        } catch {
          // ignore
        }
      }
      activeSockets.delete(userId);
    }
    qrCallbacks.delete(userId);

    // Remove session files
    const sessionDir = getSessionDir(userId);
    try {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    } catch {
      // ignore
    }

    // Delete config
    await fastify.db
      .delete(whatsappConfig)
      .where(eq(whatsappConfig.userId, userId));

    // Delete chats
    await fastify.db
      .delete(whatsappChats)
      .where(eq(whatsappChats.userId, userId));
  }

  /**
   * Get the current user's WhatsApp config
   */
  static async getConfig(
    fastify: FastifyInstance,
    userId: string
  ): Promise<typeof whatsappConfig.$inferSelect | null> {
    const [config] = await fastify.db
      .select()
      .from(whatsappConfig)
      .where(eq(whatsappConfig.userId, userId))
      .limit(1);

    return config || null;
  }

  /**
   * Get linked chats for a user
   */
  static async getChats(
    fastify: FastifyInstance,
    userId: string
  ): Promise<typeof whatsappChats.$inferSelect[]> {
    return fastify.db
      .select()
      .from(whatsappChats)
      .where(eq(whatsappChats.userId, userId));
  }

  /**
   * Check if WhatsApp is currently connected (socket alive)
   */
  static isConnected(userId: string): boolean {
    return activeSockets.has(userId);
  }

  /**
   * Send a test message to a connected WhatsApp
   */
  static async testConnection(
    fastify: FastifyInstance,
    userId: string
  ): Promise<boolean> {
    return activeSockets.has(userId);
  }

  /**
   * Send a message to all active chats for a user
   */
  static async broadcast(
    fastify: FastifyInstance,
    userId: string,
    message: string
  ): Promise<{ sent: number; failed: number }> {
    const conn = activeSockets.get(userId);
    if (!conn) {
      throw new Error("WhatsApp not connected");
    }

    const chats = await WhatsAppService.getChats(fastify, userId);
    const activeChats = chats.filter((c) => c.isActive);

    let sent = 0;
    let failed = 0;

    for (const chat of activeChats) {
      try {
        await conn.socket.sendMessage(chat.jid, { text: message });
        sent++;
      } catch {
        failed++;
      }
    }

    return { sent, failed };
  }

  /**
   * Initialize existing WhatsApp connections on API startup
   */
  static async initializeExisting(fastify: FastifyInstance): Promise<void> {
    await loadBaileys(); // Pre-load module

    const configs = await fastify.db
      .select()
      .from(whatsappConfig)
      .where(eq(whatsappConfig.isConnected, true));

    for (const config of configs) {
      const sessionDir = getSessionDir(config.userId);
      if (!fs.existsSync(sessionDir)) {
        // Session dir missing — mark as disconnected
        await fastify.db
          .update(whatsappConfig)
          .set({ isConnected: false, updatedAt: new Date() })
          .where(eq(whatsappConfig.userId, config.userId));
        continue;
      }

      fastify.log.info({ userId: config.userId }, "Reconnecting WhatsApp session");

      try {
        await WhatsAppService.connect(fastify, config.userId, () => {
          // No QR callback needed for reconnect — session should auto-auth
        });
      } catch (err) {
        fastify.log.error({ err, userId: config.userId }, "Failed to reconnect WhatsApp");
        await fastify.db
          .update(whatsappConfig)
          .set({ isConnected: false, updatedAt: new Date() })
          .where(eq(whatsappConfig.userId, config.userId));
      }
    }
  }
}
