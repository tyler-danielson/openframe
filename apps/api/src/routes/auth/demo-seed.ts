import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  calendars,
  events,
  taskLists,
  tasks,
  newsFeeds,
  kiosks,
  systemSettings,
  refreshTokens,
} from "@openframe/database/schema";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

const DEMO_USER_ID = "a0000000-0000-0000-0000-000000000de0";

// Stable UUIDs for demo data so we can re-seed idempotently
const CAL_PERSONAL = "d0000000-0000-0000-0001-000000000001";
const CAL_WORK = "d0000000-0000-0000-0001-000000000002";
const CAL_FAMILY = "d0000000-0000-0000-0001-000000000003";
const LIST_PERSONAL = "d0000000-0000-0000-0002-000000000001";
const LIST_WORK = "d0000000-0000-0000-0002-000000000002";
const KIOSK_ID = "d0000000-0000-0000-0003-000000000001";
const FEED_REUTERS = "d0000000-0000-0000-0004-000000000001";
const FEED_HN = "d0000000-0000-0000-0004-000000000002";

function dayAt(offsetDays: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function startOfDay(offsetDays: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Wipe all data owned by the demo user and re-seed with fresh sample data.
 * Called on every demo login to give each visitor a clean slate.
 */
export async function resetDemoData(db: NodePgDatabase<any>) {
  const userId = DEMO_USER_ID;

  // --- Wipe (cascade handles events/tasks/articles via FK) ---
  await Promise.all([
    db.delete(calendars).where(eq(calendars.userId, userId)),
    db.delete(taskLists).where(eq(taskLists.userId, userId)),
    db.delete(newsFeeds).where(eq(newsFeeds.userId, userId)),
    db.delete(kiosks).where(eq(kiosks.userId, userId)),
    db.delete(systemSettings).where(eq(systemSettings.userId, userId)),
    db.delete(refreshTokens).where(eq(refreshTokens.userId, userId)),
  ]);

  // --- Seed calendars ---
  await db.insert(calendars).values([
    {
      id: CAL_PERSONAL,
      userId,
      provider: "google",
      externalId: "demo-personal",
      name: "Personal",
      color: "#3B82F6",
      isVisible: true,
      isPrimary: true,
      syncEnabled: false,
      showOnDashboard: true,
      visibility: { week: true, month: true, day: true, popup: true, screensaver: false },
    },
    {
      id: CAL_WORK,
      userId,
      provider: "google",
      externalId: "demo-work",
      name: "Work",
      color: "#10B981",
      isVisible: true,
      isPrimary: false,
      syncEnabled: false,
      showOnDashboard: true,
      visibility: { week: true, month: true, day: true, popup: true, screensaver: false },
    },
    {
      id: CAL_FAMILY,
      userId,
      provider: "google",
      externalId: "demo-family",
      name: "Family",
      color: "#F59E0B",
      isVisible: true,
      isPrimary: false,
      syncEnabled: false,
      showOnDashboard: true,
      visibility: { week: true, month: true, day: true, popup: true, screensaver: false },
    },
  ]);

  // --- Seed events ---
  await db.insert(events).values([
    {
      calendarId: CAL_PERSONAL,
      externalId: "demo-evt-1",
      title: "Morning Run",
      description: "5K around the park",
      location: "City Park",
      startTime: dayAt(0, 7, 0),
      endTime: dayAt(0, 8, 0),
      isAllDay: false,
      status: "confirmed",
    },
    {
      calendarId: CAL_WORK,
      externalId: "demo-evt-2",
      title: "Team Standup",
      description: "Daily sync with engineering team",
      startTime: dayAt(0, 9, 30),
      endTime: dayAt(0, 10, 0),
      isAllDay: false,
      status: "confirmed",
    },
    {
      calendarId: CAL_WORK,
      externalId: "demo-evt-3",
      title: "Product Review",
      description: "Q1 feature review with stakeholders",
      location: "Conference Room B",
      startTime: dayAt(0, 14, 0),
      endTime: dayAt(0, 15, 30),
      isAllDay: false,
      status: "confirmed",
    },
    {
      calendarId: CAL_FAMILY,
      externalId: "demo-evt-4",
      title: "Grocery Shopping",
      location: "Whole Foods",
      startTime: dayAt(0, 17, 30),
      endTime: dayAt(0, 18, 30),
      isAllDay: false,
      status: "confirmed",
    },
    {
      calendarId: CAL_PERSONAL,
      externalId: "demo-evt-5",
      title: "Dentist Appointment",
      description: "Regular checkup",
      location: "Downtown Dental",
      startTime: dayAt(1, 10, 0),
      endTime: dayAt(1, 11, 0),
      isAllDay: false,
      status: "confirmed",
    },
    {
      calendarId: CAL_WORK,
      externalId: "demo-evt-6",
      title: "Sprint Planning",
      description: "Plan next sprint backlog",
      startTime: dayAt(1, 13, 0),
      endTime: dayAt(1, 14, 30),
      isAllDay: false,
      status: "confirmed",
    },
    {
      calendarId: CAL_FAMILY,
      externalId: "demo-evt-7",
      title: "Family Day Out",
      description: "Zoo trip with the kids",
      location: "City Zoo",
      startTime: startOfDay(2),
      endTime: startOfDay(2),
      isAllDay: true,
      status: "confirmed",
    },
    {
      calendarId: CAL_WORK,
      externalId: "demo-evt-8",
      title: "Design Workshop",
      description: "UX redesign brainstorming",
      location: "Design Lab",
      startTime: dayAt(3, 11, 0),
      endTime: dayAt(3, 13, 0),
      isAllDay: false,
      status: "confirmed",
    },
    {
      calendarId: CAL_PERSONAL,
      externalId: "demo-evt-9",
      title: "Yoga Class",
      location: "Community Center",
      startTime: dayAt(4, 18, 0),
      endTime: dayAt(4, 19, 0),
      isAllDay: false,
      status: "confirmed",
    },
    {
      calendarId: CAL_FAMILY,
      externalId: "demo-evt-10",
      title: "Birthday Party",
      description: "Emma's 7th birthday celebration",
      location: "123 Maple St",
      startTime: startOfDay(5),
      endTime: startOfDay(5),
      isAllDay: true,
      status: "confirmed",
    },
  ]);

  // --- Seed task lists ---
  await db.insert(taskLists).values([
    {
      id: LIST_PERSONAL,
      userId,
      provider: "google",
      externalId: "demo-list-personal",
      name: "Personal",
      isVisible: true,
    },
    {
      id: LIST_WORK,
      userId,
      provider: "google",
      externalId: "demo-list-work",
      name: "Work",
      isVisible: true,
    },
  ]);

  // --- Seed tasks ---
  await db.insert(tasks).values([
    {
      taskListId: LIST_PERSONAL,
      externalId: "demo-task-1",
      title: "Pick up dry cleaning",
      status: "needsAction",
      dueDate: startOfDay(0),
    },
    {
      taskListId: LIST_PERSONAL,
      externalId: "demo-task-2",
      title: "Schedule car maintenance",
      notes: "Oil change + tire rotation",
      status: "needsAction",
      dueDate: startOfDay(1),
    },
    {
      taskListId: LIST_PERSONAL,
      externalId: "demo-task-3",
      title: "Buy birthday gift for Emma",
      status: "needsAction",
      dueDate: startOfDay(4),
    },
    {
      taskListId: LIST_PERSONAL,
      externalId: "demo-task-4",
      title: "Renew gym membership",
      status: "needsAction",
    },
    {
      taskListId: LIST_WORK,
      externalId: "demo-task-5",
      title: "Review PR #42",
      notes: "Auth refactor changes",
      status: "needsAction",
      dueDate: startOfDay(0),
    },
    {
      taskListId: LIST_WORK,
      externalId: "demo-task-6",
      title: "Update project documentation",
      status: "needsAction",
      dueDate: startOfDay(2),
    },
    {
      taskListId: LIST_WORK,
      externalId: "demo-task-7",
      title: "Prepare sprint demo",
      notes: "Include new dashboard features",
      status: "needsAction",
      dueDate: startOfDay(3),
    },
    {
      taskListId: LIST_WORK,
      externalId: "demo-task-8",
      title: "Set up staging environment",
      status: "needsAction",
    },
  ]);

  // --- Seed news feeds ---
  await db.insert(newsFeeds).values([
    {
      id: FEED_REUTERS,
      userId,
      name: "Reuters",
      feedUrl: "https://feeds.reuters.com/reuters/topNews",
      category: "news",
      isActive: true,
    },
    {
      id: FEED_HN,
      userId,
      name: "Hacker News",
      feedUrl: "https://hnrss.org/frontpage",
      category: "technology",
      isActive: true,
    },
  ]);

  // --- Seed weather settings (San Francisco) ---
  await db.insert(systemSettings).values([
    { userId, category: "weather", key: "latitude", value: "37.7749" },
    { userId, category: "weather", key: "longitude", value: "-122.4194" },
    { userId, category: "weather", key: "units", value: "imperial" },
  ]);

  // --- Seed one kiosk ---
  await db.insert(kiosks).values({
    id: KIOSK_ID,
    userId,
    name: "Living Room Display",
    isActive: true,
    displayMode: "full",
    displayType: "touch",
    homePage: "calendar",
  });
}
