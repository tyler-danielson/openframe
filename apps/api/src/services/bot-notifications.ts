/**
 * Scheduled Telegram and WhatsApp notifications: the daily agenda and event
 * reminders set in each bot's settings. Run every minute by the scheduler
 * plugin; the timing decisions are in lib/notification-timing.ts.
 *
 * Delivery is at most once. What's about to be sent is recorded on the
 * bot's config row (dailyAgendaSentAt, sentReminders) before sending, so a
 * restart — or a failing database write — never repeats a notification. A
 * send that fails (a chat that blocked the bot, a network error) is logged,
 * not retried: retrying every minute would spam a broken chat, and a late
 * duplicate is worse than a missed reminder. Nothing is attempted, and so
 * nothing recorded, while a bot can't send (Telegram token marked invalid,
 * WhatsApp not connected); the agenda (within its catch-up window) and any
 * reminders for events that haven't started go out once it can.
 */
import type { FastifyInstance } from "fastify";
import { and, eq, or } from "drizzle-orm";
import { telegramConfig, users, whatsappConfig } from "@openframe/database/schema";
import { resolveTimeZone } from "../lib/timezone.js";
import {
  MAX_REMINDER_MINUTES,
  dueReminders,
  isDailyAgendaDue,
  pendingReminderKeys,
  reminderKey,
} from "../lib/notification-timing.js";
import type { ExpandedEvent } from "./calendar-sync/recurrence.js";
import { TelegramService } from "./telegram.js";
import { WhatsAppService } from "./whatsapp.js";

/** What the scheduler needs from a bot (TelegramService, WhatsAppService) */
export interface NotifyingBot {
  linkedChatIds(): Promise<string[]>;
  sendMessage(chatId: string, text: string): Promise<unknown>;
  todayMessage(now: Date, timeZone: string): Promise<string>;
  reminderMessage(event: ExpandedEvent, now: Date, timeZone: string): string;
  getAgendaForRange(start: Date, end: Date, timeZone: string): Promise<ExpandedEvent[]>;
}

/** The notification columns shared by telegram_config and whatsapp_config */
export interface NotificationSettings {
  userId: string;
  dailyAgendaEnabled: boolean;
  dailyAgendaTime: string;
  dailyAgendaSentAt: Date | null;
  eventRemindersEnabled: boolean;
  eventReminderMinutes: number;
  sentReminders: string[] | null;
}

type SentMarkers = Partial<Pick<NotificationSettings, "dailyAgendaSentAt" | "sentReminders">>;

/** Send every due agenda and reminder, for both bots. */
export async function sendDueBotNotifications(fastify: FastifyInstance, now: Date = new Date()): Promise<void> {
  const telegramRows = await fastify.db
    .select({ config: telegramConfig, timeZone: users.timezone })
    .from(telegramConfig)
    .innerJoin(users, eq(users.id, telegramConfig.userId))
    .where(
      and(
        eq(telegramConfig.isConnected, true),
        or(eq(telegramConfig.dailyAgendaEnabled, true), eq(telegramConfig.eventRemindersEnabled, true))
      )
    );
  for (const { config, timeZone } of telegramRows) {
    await notify(fastify, now, "telegram", config, resolveTimeZone(timeZone), new TelegramService(fastify, config.userId),
      (markers) => fastify.db.update(telegramConfig).set(markers).where(eq(telegramConfig.id, config.id)));
  }

  const whatsappRows = await fastify.db
    .select({ config: whatsappConfig, timeZone: users.timezone })
    .from(whatsappConfig)
    .innerJoin(users, eq(users.id, whatsappConfig.userId))
    .where(or(eq(whatsappConfig.dailyAgendaEnabled, true), eq(whatsappConfig.eventRemindersEnabled, true)));
  for (const { config, timeZone } of whatsappRows) {
    // Baileys sends only through this user's open socket
    if (!WhatsAppService.isConnected(config.userId)) continue;
    await notify(fastify, now, "whatsapp", config, resolveTimeZone(timeZone), new WhatsAppService(fastify, config.userId),
      (markers) => fastify.db.update(whatsappConfig).set(markers).where(eq(whatsappConfig.id, config.id)));
  }
}

/** One user's due notifications on one bot. Exported for tests. */
export async function notify(
  fastify: FastifyInstance,
  now: Date,
  channel: "telegram" | "whatsapp",
  config: NotificationSettings,
  timeZone: string,
  bot: NotifyingBot,
  record: (markers: SentMarkers) => PromiseLike<unknown>
): Promise<void> {
  const log = fastify.log.child({ channel, userId: config.userId });
  try {
    const chatIds = await bot.linkedChatIds();
    // Nothing recorded: the agenda still goes out if a chat links in time
    if (chatIds.length === 0) return;

    const messages: string[] = [];
    const markers: SentMarkers = {};

    if (
      config.dailyAgendaEnabled &&
      isDailyAgendaDue({ now, timeZone, agendaTime: config.dailyAgendaTime, lastSentAt: config.dailyAgendaSentAt })
    ) {
      messages.push(await bot.todayMessage(now, timeZone));
      markers.dailyAgendaSentAt = now;
    }

    const leadMinutes = Math.min(config.eventReminderMinutes, MAX_REMINDER_MINUTES);
    if (config.eventRemindersEnabled && leadMinutes > 0) {
      const upcoming = await bot.getAgendaForRange(now, new Date(now.getTime() + leadMinutes * 60 * 1000), timeZone);
      const sent = config.sentReminders ?? [];
      const due = dueReminders(upcoming, { now, leadMinutes, sent });
      if (due.length > 0) {
        markers.sentReminders = [...pendingReminderKeys(sent, now), ...due.map(reminderKey)];
        messages.push(...due.map((event) => bot.reminderMessage(event, now, timeZone)));
      }
    }

    if (messages.length === 0) return;
    await record(markers);

    let failed = 0;
    for (const text of messages) {
      for (const chatId of chatIds) {
        try {
          await bot.sendMessage(chatId, text);
        } catch (err) {
          failed++;
          log.warn({ err, chatId }, "Failed to send scheduled bot notification");
        }
      }
    }
    log.info(
      { agenda: !!markers.dailyAgendaSentAt, reminders: messages.length - (markers.dailyAgendaSentAt ? 1 : 0), chats: chatIds.length, failed },
      "Sent scheduled bot notifications"
    );
  } catch (err) {
    log.error({ err }, "Scheduled bot notifications failed");
  }
}
