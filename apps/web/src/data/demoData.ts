import type { Calendar, CalendarEvent, Task, TaskList, User, NewsHeadline, ShoppingItem } from "@openframe/shared";
import type { WeatherData, WeatherForecast, HourlyForecast } from "../services/api";
import { addDays, addHours, setHours, setMinutes, startOfDay, subDays } from "date-fns";

// --- Calendars ---

export const DEMO_CALENDARS: Calendar[] = [
  {
    id: "demo-personal",
    provider: "google",
    externalId: "demo-personal",
    name: "Personal",
    description: null,
    color: "#3B82F6",
    icon: null,
    isVisible: true,
    isPrimary: true,
    isFavorite: false,
    isReadOnly: false,
    syncEnabled: true,
    syncInterval: null,
    showOnDashboard: true,
    kioskEnabled: true,
    displayName: null,
    originalName: null,
    lastSyncAt: new Date(),
    visibility: { week: true, month: true, day: true, popup: true, screensaver: false },
  },
  {
    id: "demo-work",
    provider: "google",
    externalId: "demo-work",
    name: "Work",
    description: null,
    color: "#10B981",
    icon: null,
    isVisible: true,
    isPrimary: false,
    isFavorite: false,
    isReadOnly: false,
    syncEnabled: true,
    syncInterval: null,
    showOnDashboard: true,
    kioskEnabled: true,
    displayName: null,
    originalName: null,
    lastSyncAt: new Date(),
    visibility: { week: true, month: true, day: true, popup: true, screensaver: false },
  },
  {
    id: "demo-family",
    provider: "google",
    externalId: "demo-family",
    name: "Family",
    description: null,
    color: "#F59E0B",
    icon: null,
    isVisible: true,
    isPrimary: false,
    isFavorite: false,
    isReadOnly: false,
    syncEnabled: true,
    syncInterval: null,
    showOnDashboard: true,
    kioskEnabled: true,
    displayName: null,
    originalName: null,
    lastSyncAt: new Date(),
    visibility: { week: true, month: true, day: true, popup: true, screensaver: false },
  },
  {
    id: "demo-kids",
    provider: "google",
    externalId: "demo-kids",
    name: "Kids",
    description: null,
    color: "#EC4899",
    icon: null,
    isVisible: true,
    isPrimary: false,
    isFavorite: false,
    isReadOnly: false,
    syncEnabled: true,
    syncInterval: null,
    showOnDashboard: true,
    kioskEnabled: true,
    displayName: null,
    originalName: null,
    lastSyncAt: new Date(),
    visibility: { week: true, month: true, day: true, popup: true, screensaver: false },
  },
];

// --- Events (generated relative to today) ---

function evt(
  id: string,
  calendarId: string,
  title: string,
  dayOffset: number,
  startHour: number,
  startMin: number,
  endHour: number,
  endMin: number,
  opts: Partial<CalendarEvent> = {}
): CalendarEvent {
  const base = startOfDay(addDays(new Date(), dayOffset));
  return {
    id,
    calendarId,
    externalId: id,
    title,
    description: opts.description ?? null,
    location: opts.location ?? null,
    startTime: setMinutes(setHours(base, startHour), startMin),
    endTime: setMinutes(setHours(base, endHour), endMin),
    isAllDay: false,
    status: "confirmed",
    recurrenceRule: null,
    recurringEventId: null,
    attendees: opts.attendees ?? [],
    reminders: [],
  };
}

function allDay(
  id: string,
  calendarId: string,
  title: string,
  dayOffset: number,
  opts: Partial<CalendarEvent> = {}
): CalendarEvent {
  const base = startOfDay(addDays(new Date(), dayOffset));
  return {
    id,
    calendarId,
    externalId: id,
    title,
    description: opts.description ?? null,
    location: opts.location ?? null,
    startTime: base,
    endTime: base,
    isAllDay: true,
    status: "confirmed",
    recurrenceRule: null,
    recurringEventId: null,
    attendees: opts.attendees ?? [],
    reminders: [],
  };
}

export function generateDemoEvents(): CalendarEvent[] {
  return [
    // ===== PAST EVENTS (so month view looks populated) =====

    // -14 days
    evt("d-p14a", "demo-work", "Quarterly Planning", -14, 10, 0, 12, 0, { location: "Main Conference Room" }),
    evt("d-p14b", "demo-personal", "Haircut", -14, 14, 0, 14, 45),
    // -13 days
    evt("d-p13a", "demo-kids", "Emma's Soccer Practice", -13, 16, 0, 17, 30, { location: "Riverside Fields" }),
    evt("d-p13b", "demo-work", "1:1 with Manager", -13, 11, 0, 11, 30),
    // -12 days
    allDay("d-p12a", "demo-family", "Anniversary", -12, { description: "10 years!" }),
    evt("d-p12b", "demo-personal", "Dinner Reservation", -12, 19, 0, 21, 0, { location: "Chez Laurent" }),
    // -11 days
    evt("d-p11a", "demo-work", "Team Standup", -11, 9, 30, 10, 0),
    evt("d-p11b", "demo-kids", "Piano Lesson", -11, 15, 30, 16, 15, { location: "Music Academy" }),
    // -10 days
    evt("d-p10a", "demo-work", "Design Review", -10, 14, 0, 15, 0),
    evt("d-p10b", "demo-family", "Grocery Shopping", -10, 17, 0, 18, 0, { location: "Trader Joe's" }),
    // -9 days
    allDay("d-p9a", "demo-family", "Family Day Out", -9, { location: "City Zoo", description: "Pack lunches and sunscreen" }),
    // -8 days
    evt("d-p8a", "demo-work", "Sprint Retrospective", -8, 13, 0, 14, 0),
    evt("d-p8b", "demo-personal", "Gym - Upper Body", -8, 6, 30, 7, 30),
    // -7 days
    evt("d-p7a", "demo-work", "Team Standup", -7, 9, 30, 10, 0),
    evt("d-p7b", "demo-kids", "Emma's Soccer Game", -7, 10, 0, 11, 30, { location: "Riverside Fields" }),
    evt("d-p7c", "demo-personal", "Brunch", -7, 11, 0, 12, 30, { location: "The Morning Table" }),
    // -6 days
    evt("d-p6a", "demo-work", "Product Review", -6, 14, 0, 15, 30, { description: "Q1 feature review with stakeholders" }),
    evt("d-p6b", "demo-kids", "Piano Lesson", -6, 15, 30, 16, 15, { location: "Music Academy" }),
    // -5 days
    evt("d-p5a", "demo-personal", "Dentist", -5, 10, 0, 11, 0, { location: "Downtown Dental" }),
    evt("d-p5b", "demo-work", "Lunch & Learn", -5, 12, 0, 13, 0, { description: "AI/ML overview" }),
    // -4 days
    evt("d-p4a", "demo-work", "Team Standup", -4, 9, 30, 10, 0),
    evt("d-p4b", "demo-family", "Date Night", -4, 19, 0, 21, 30, { location: "Rialto Cinema" }),
    // -3 days
    evt("d-p3a", "demo-work", "Sprint Planning", -3, 13, 0, 14, 30, { description: "Plan next sprint backlog" }),
    evt("d-p3b", "demo-kids", "Playdate at Jake's", -3, 14, 0, 16, 0),
    // -2 days
    evt("d-p2a", "demo-personal", "Morning Run", -2, 7, 0, 8, 0, { location: "City Park" }),
    evt("d-p2b", "demo-work", "Code Review Session", -2, 11, 0, 12, 0),
    evt("d-p2c", "demo-kids", "Emma's Soccer Practice", -2, 16, 0, 17, 30, { location: "Riverside Fields" }),
    // -1 day (yesterday)
    evt("d-p1a", "demo-work", "Team Standup", -1, 9, 30, 10, 0),
    evt("d-p1b", "demo-work", "Architecture Review", -1, 14, 0, 15, 30, { description: "Microservices migration plan" }),
    evt("d-p1c", "demo-family", "Grocery Shopping", -1, 17, 30, 18, 30, { location: "Whole Foods" }),

    // ===== TODAY =====
    evt("d-t1", "demo-personal", "Morning Run", 0, 7, 0, 8, 0, { location: "City Park", description: "5K around the lake" }),
    evt("d-t2", "demo-work", "Team Standup", 0, 9, 30, 10, 0, { description: "Daily sync with engineering team" }),
    evt("d-t3", "demo-kids", "Emma's Piano Recital", 0, 12, 0, 13, 0, { location: "Music Academy", description: "She's playing Fur Elise!" }),
    evt("d-t4", "demo-work", "Product Review", 0, 14, 0, 15, 30, { location: "Conference Room B", description: "Q1 feature review with stakeholders" }),
    evt("d-t5", "demo-family", "Grocery Shopping", 0, 17, 30, 18, 30, { location: "Whole Foods" }),
    evt("d-t6", "demo-personal", "Yoga Class", 0, 19, 0, 20, 0, { location: "Community Center" }),

    // ===== TOMORROW =====
    evt("d-f1a", "demo-personal", "Gym - Leg Day", 1, 6, 30, 7, 30),
    evt("d-f1b", "demo-work", "Team Standup", 1, 9, 30, 10, 0),
    evt("d-f1c", "demo-personal", "Dentist Appointment", 1, 10, 30, 11, 30, { location: "Downtown Dental", description: "Regular checkup" }),
    evt("d-f1d", "demo-work", "Sprint Planning", 1, 13, 0, 14, 30, { description: "Plan next sprint backlog" }),
    evt("d-f1e", "demo-kids", "Soccer Practice", 1, 16, 0, 17, 30, { location: "Riverside Fields" }),

    // ===== +2 DAYS =====
    allDay("d-f2a", "demo-family", "Family Camping Trip", 2, { location: "Pine Lake Campground", description: "Pack tent, sleeping bags, s'mores supplies" }),
    evt("d-f2b", "demo-work", "Team Standup", 2, 9, 30, 10, 0),
    evt("d-f2c", "demo-work", "Design Workshop", 2, 11, 0, 13, 0, { location: "Design Lab", description: "UX redesign brainstorming" }),

    // ===== +3 DAYS =====
    evt("d-f3a", "demo-work", "Team Standup", 3, 9, 30, 10, 0),
    evt("d-f3b", "demo-work", "Demo Day", 3, 15, 0, 16, 0, { description: "Sprint demo to stakeholders" }),
    evt("d-f3c", "demo-kids", "Piano Lesson", 3, 15, 30, 16, 15, { location: "Music Academy" }),
    evt("d-f3d", "demo-personal", "Happy Hour", 3, 17, 30, 19, 0, { location: "The Rusty Anchor" }),

    // ===== +4 DAYS =====
    evt("d-f4a", "demo-personal", "Morning Run", 4, 7, 0, 8, 0, { location: "City Park" }),
    evt("d-f4b", "demo-work", "1:1 with Manager", 4, 11, 0, 11, 30),
    evt("d-f4c", "demo-kids", "Emma's Soccer Game", 4, 10, 0, 11, 30, { location: "Riverside Fields" }),
    evt("d-f4d", "demo-family", "Dinner with Grandparents", 4, 18, 0, 20, 0, { location: "Olive Garden" }),

    // ===== +5 DAYS =====
    allDay("d-f5a", "demo-family", "Emma's 7th Birthday", 5, { location: "123 Maple St", description: "Unicorn theme party! Cake pickup at 10am." }),
    evt("d-f5b", "demo-personal", "Yoga Class", 5, 8, 0, 9, 0, { location: "Community Center" }),
    evt("d-f5c", "demo-work", "Team Retro", 5, 13, 0, 14, 0),

    // ===== +6 DAYS =====
    evt("d-f6a", "demo-work", "Team Standup", 6, 9, 30, 10, 0),
    evt("d-f6b", "demo-personal", "Car Maintenance", 6, 14, 0, 15, 30, { location: "AutoCare Plus", description: "Oil change + tire rotation" }),
    evt("d-f6c", "demo-kids", "Swim Class", 6, 16, 0, 17, 0, { location: "Aquatic Center" }),

    // ===== +7-10 DAYS =====
    evt("d-f7a", "demo-work", "All-Hands Meeting", 7, 10, 0, 11, 0, { description: "Monthly company all-hands" }),
    evt("d-f7b", "demo-family", "Neighborhood BBQ", 7, 16, 0, 19, 0, { location: "Community Park" }),
    evt("d-f8a", "demo-work", "Team Standup", 8, 9, 30, 10, 0),
    evt("d-f8b", "demo-kids", "Piano Lesson", 8, 15, 30, 16, 15, { location: "Music Academy" }),
    allDay("d-f9a", "demo-personal", "Day Off", 9),
    evt("d-f9b", "demo-family", "Museum Visit", 9, 10, 0, 14, 0, { location: "Natural History Museum" }),
    evt("d-f10a", "demo-work", "Quarterly Review", 10, 9, 0, 11, 0, { description: "Q1 performance review" }),
    evt("d-f10b", "demo-kids", "School Play", 10, 18, 0, 19, 30, { location: "Lincoln Elementary Auditorium" }),
  ];
}

// --- Task Lists & Tasks ---

export const DEMO_TASK_LISTS: TaskList[] = [
  { id: "demo-list-1", name: "Personal", isVisible: true },
  { id: "demo-list-2", name: "Work", isVisible: true },
  { id: "demo-list-3", name: "Home Projects", isVisible: true },
];

const today = startOfDay(new Date());

export const DEMO_TASKS: Task[] = [
  // Personal
  {
    id: "demo-task-1",
    taskListId: "demo-list-1",
    title: "Pick up dry cleaning",
    notes: "The blue suit and two shirts",
    status: "needsAction",
    dueDate: today,
    completedAt: null,
    showOnCalendar: false,
  },
  {
    id: "demo-task-2",
    taskListId: "demo-list-1",
    title: "Schedule car maintenance",
    notes: "Oil change + tire rotation — AutoCare Plus",
    status: "needsAction",
    dueDate: addDays(today, 1),
    completedAt: null,
    showOnCalendar: false,
  },
  {
    id: "demo-task-3",
    taskListId: "demo-list-1",
    title: "Buy birthday gift for Emma",
    notes: "She wants the LEGO Friends set and art supplies",
    status: "needsAction",
    dueDate: addDays(today, 4),
    completedAt: null,
    showOnCalendar: false,
  },
  {
    id: "demo-task-4",
    taskListId: "demo-list-1",
    title: "Renew gym membership",
    notes: null,
    status: "needsAction",
    dueDate: addDays(today, 7),
    completedAt: null,
    showOnCalendar: false,
  },
  {
    id: "demo-task-4b",
    taskListId: "demo-list-1",
    title: "Book flights for summer trip",
    notes: "Check Southwest and Alaska — flexible dates late July",
    status: "needsAction",
    dueDate: addDays(today, 10),
    completedAt: null,
    showOnCalendar: false,
  },
  {
    id: "demo-task-4c",
    taskListId: "demo-list-1",
    title: "Return library books",
    notes: null,
    status: "completed",
    dueDate: subDays(today, 2),
    completedAt: subDays(today, 2),
    showOnCalendar: false,
  },
  {
    id: "demo-task-4d",
    taskListId: "demo-list-1",
    title: "Order new running shoes",
    notes: null,
    status: "completed",
    dueDate: subDays(today, 3),
    completedAt: subDays(today, 3),
    showOnCalendar: false,
  },
  // Work
  {
    id: "demo-task-5",
    taskListId: "demo-list-2",
    title: "Review PR #42 — auth refactor",
    notes: "Check token refresh logic and rate limiting",
    status: "needsAction",
    dueDate: today,
    completedAt: null,
    showOnCalendar: false,
  },
  {
    id: "demo-task-6",
    taskListId: "demo-list-2",
    title: "Update API documentation",
    notes: "New endpoints from sprint 14",
    status: "needsAction",
    dueDate: addDays(today, 2),
    completedAt: null,
    showOnCalendar: false,
  },
  {
    id: "demo-task-7",
    taskListId: "demo-list-2",
    title: "Prepare sprint demo",
    notes: "Include new dashboard features and perf improvements",
    status: "needsAction",
    dueDate: addDays(today, 3),
    completedAt: null,
    showOnCalendar: false,
  },
  {
    id: "demo-task-8",
    taskListId: "demo-list-2",
    title: "Set up staging environment",
    notes: "Need Docker Compose config and seed data",
    status: "needsAction",
    dueDate: addDays(today, 5),
    completedAt: null,
    showOnCalendar: false,
  },
  {
    id: "demo-task-8b",
    taskListId: "demo-list-2",
    title: "Write unit tests for payment module",
    notes: null,
    status: "needsAction",
    dueDate: addDays(today, 6),
    completedAt: null,
    showOnCalendar: false,
  },
  {
    id: "demo-task-8c",
    taskListId: "demo-list-2",
    title: "Fix login redirect bug",
    notes: "Reproduce: login from /settings, gets redirected to /",
    status: "completed",
    dueDate: subDays(today, 1),
    completedAt: subDays(today, 1),
    showOnCalendar: false,
  },
  {
    id: "demo-task-8d",
    taskListId: "demo-list-2",
    title: "Deploy v2.4 to production",
    notes: null,
    status: "completed",
    dueDate: subDays(today, 4),
    completedAt: subDays(today, 3),
    showOnCalendar: false,
  },
  // Home Projects
  {
    id: "demo-task-9",
    taskListId: "demo-list-3",
    title: "Fix leaky kitchen faucet",
    notes: "Need new washer from hardware store",
    status: "needsAction",
    dueDate: addDays(today, 2),
    completedAt: null,
    showOnCalendar: false,
  },
  {
    id: "demo-task-10",
    taskListId: "demo-list-3",
    title: "Paint guest bedroom",
    notes: "Color: Benjamin Moore HC-172 Revere Pewter",
    status: "needsAction",
    dueDate: addDays(today, 8),
    completedAt: null,
    showOnCalendar: false,
  },
  {
    id: "demo-task-11",
    taskListId: "demo-list-3",
    title: "Replace air filters",
    notes: "16x25x1 MERV 11 — ordered from Amazon",
    status: "needsAction",
    dueDate: null,
    completedAt: null,
    showOnCalendar: false,
  },
  {
    id: "demo-task-12",
    taskListId: "demo-list-3",
    title: "Organize garage",
    notes: null,
    status: "needsAction",
    dueDate: null,
    completedAt: null,
    showOnCalendar: false,
  },
  {
    id: "demo-task-12b",
    taskListId: "demo-list-3",
    title: "Install smart thermostat",
    notes: null,
    status: "completed",
    dueDate: subDays(today, 5),
    completedAt: subDays(today, 5),
    showOnCalendar: false,
  },
];

// --- Shopping List ---

export const DEMO_SHOPPING_ITEMS: ShoppingItem[] = [
  { id: "demo-shop-1", userId: "demo-user", name: "Milk (whole)", amazonUrl: null, checked: false, sortOrder: 0, createdAt: subDays(new Date(), 1), updatedAt: subDays(new Date(), 1) },
  { id: "demo-shop-2", userId: "demo-user", name: "Eggs (dozen)", amazonUrl: null, checked: false, sortOrder: 1, createdAt: subDays(new Date(), 1), updatedAt: subDays(new Date(), 1) },
  { id: "demo-shop-3", userId: "demo-user", name: "Chicken breast", amazonUrl: null, checked: false, sortOrder: 2, createdAt: subDays(new Date(), 1), updatedAt: subDays(new Date(), 1) },
  { id: "demo-shop-4", userId: "demo-user", name: "Bananas", amazonUrl: null, checked: false, sortOrder: 3, createdAt: new Date(), updatedAt: new Date() },
  { id: "demo-shop-5", userId: "demo-user", name: "Spinach", amazonUrl: null, checked: false, sortOrder: 4, createdAt: new Date(), updatedAt: new Date() },
  { id: "demo-shop-6", userId: "demo-user", name: "Olive oil", amazonUrl: null, checked: false, sortOrder: 5, createdAt: new Date(), updatedAt: new Date() },
  { id: "demo-shop-7", userId: "demo-user", name: "Bread", amazonUrl: null, checked: true, sortOrder: 6, createdAt: subDays(new Date(), 2), updatedAt: new Date() },
  { id: "demo-shop-8", userId: "demo-user", name: "Pasta", amazonUrl: null, checked: true, sortOrder: 7, createdAt: subDays(new Date(), 2), updatedAt: new Date() },
  { id: "demo-shop-9", userId: "demo-user", name: "Paper towels", amazonUrl: null, checked: false, sortOrder: 8, createdAt: new Date(), updatedAt: new Date() },
  { id: "demo-shop-10", userId: "demo-user", name: "Birthday candles", amazonUrl: null, checked: false, sortOrder: 9, createdAt: new Date(), updatedAt: new Date() },
];

// --- Weather ---

export const DEMO_WEATHER: WeatherData = {
  temp: 72,
  feels_like: 70,
  temp_min: 62,
  temp_max: 78,
  humidity: 55,
  description: "partly cloudy",
  icon: "02d",
  wind_speed: 8,
  city: "San Francisco",
  units: "imperial",
};

export const DEMO_HOURLY: HourlyForecast[] = [
  { time: "9 AM", temp: 65, description: "sunny", icon: "01d", humidity: 60, wind_speed: 5, pop: 0, units: "imperial" },
  { time: "10 AM", temp: 68, description: "sunny", icon: "01d", humidity: 55, wind_speed: 6, pop: 0, units: "imperial" },
  { time: "11 AM", temp: 70, description: "partly cloudy", icon: "02d", humidity: 52, wind_speed: 7, pop: 5, units: "imperial" },
  { time: "12 PM", temp: 72, description: "partly cloudy", icon: "02d", humidity: 50, wind_speed: 8, pop: 10, units: "imperial" },
  { time: "1 PM", temp: 74, description: "partly cloudy", icon: "02d", humidity: 48, wind_speed: 9, pop: 10, units: "imperial" },
  { time: "2 PM", temp: 76, description: "sunny", icon: "01d", humidity: 45, wind_speed: 8, pop: 5, units: "imperial" },
  { time: "3 PM", temp: 78, description: "sunny", icon: "01d", humidity: 43, wind_speed: 7, pop: 0, units: "imperial" },
  { time: "4 PM", temp: 76, description: "partly cloudy", icon: "02d", humidity: 48, wind_speed: 6, pop: 5, units: "imperial" },
];

export const DEMO_FORECAST: WeatherForecast[] = [
  { date: "Mon", temp_min: 58, temp_max: 75, description: "sunny", icon: "01d", units: "imperial" },
  { date: "Tue", temp_min: 60, temp_max: 78, description: "partly cloudy", icon: "02d", units: "imperial" },
  { date: "Wed", temp_min: 55, temp_max: 70, description: "cloudy", icon: "03d", units: "imperial" },
  { date: "Thu", temp_min: 52, temp_max: 65, description: "light rain", icon: "10d", units: "imperial" },
  { date: "Fri", temp_min: 56, temp_max: 72, description: "sunny", icon: "01d", units: "imperial" },
];

// --- News ---

export const DEMO_HEADLINES: NewsHeadline[] = [
  {
    id: "demo-news-1",
    title: "NASA's Artemis IV Mission Confirms Lunar Gateway Assembly Date",
    link: "#",
    imageUrl: null,
    publishedAt: new Date(),
    feedName: "Science Daily",
    feedCategory: "science",
  },
  {
    id: "demo-news-2",
    title: "AI-Powered Code Review Tools See 300% Adoption Increase Among Enterprises",
    link: "#",
    imageUrl: null,
    publishedAt: addHours(new Date(), -1),
    feedName: "TechCrunch",
    feedCategory: "technology",
  },
  {
    id: "demo-news-3",
    title: "Local Community Garden Wins National Sustainability Award for Third Year",
    link: "#",
    imageUrl: null,
    publishedAt: addHours(new Date(), -2),
    feedName: "Local News",
    feedCategory: "local",
  },
  {
    id: "demo-news-4",
    title: "New Study Links Mediterranean Diet to Improved Cognitive Function in Adults Over 50",
    link: "#",
    imageUrl: null,
    publishedAt: addHours(new Date(), -3),
    feedName: "Health Today",
    feedCategory: "health",
  },
  {
    id: "demo-news-5",
    title: "S&P 500 Hits New Record High on Strong Earnings Reports from Tech Sector",
    link: "#",
    imageUrl: null,
    publishedAt: addHours(new Date(), -4),
    feedName: "Financial Times",
    feedCategory: "business",
  },
  {
    id: "demo-news-6",
    title: "Summer Blockbuster Season Preview: 15 Films to Watch This Year",
    link: "#",
    imageUrl: null,
    publishedAt: addHours(new Date(), -5),
    feedName: "Entertainment Weekly",
    feedCategory: "entertainment",
  },
  {
    id: "demo-news-7",
    title: "Electric Vehicle Sales Surpass Gas Cars in Norway for Record 18th Month",
    link: "#",
    imageUrl: null,
    publishedAt: addHours(new Date(), -6),
    feedName: "Reuters",
    feedCategory: "technology",
  },
  {
    id: "demo-news-8",
    title: "Golden State Warriors Announce New Community Center Partnership",
    link: "#",
    imageUrl: null,
    publishedAt: addHours(new Date(), -7),
    feedName: "ESPN",
    feedCategory: "sports",
  },
  {
    id: "demo-news-9",
    title: "City Council Approves Downtown Bike Lane Expansion Project",
    link: "#",
    imageUrl: null,
    publishedAt: addHours(new Date(), -8),
    feedName: "Local News",
    feedCategory: "local",
  },
  {
    id: "demo-news-10",
    title: "Breakthrough in Solid-State Battery Technology Could Double EV Range",
    link: "#",
    imageUrl: null,
    publishedAt: addHours(new Date(), -10),
    feedName: "Science Daily",
    feedCategory: "science",
  },
];

// --- User ---

export const DEMO_USER: User = {
  id: "demo-user",
  email: "demo@openframe.us",
  name: "Alex Johnson",
  avatarUrl: null,
  role: "admin",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  preferences: {},
  createdAt: subDays(new Date(), 90),
  updatedAt: new Date(),
};
