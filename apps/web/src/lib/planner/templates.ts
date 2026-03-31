import type { PlannerLayoutConfig, PlannerTemplate, ColumnLayout } from "@openframe/shared";

export const DEFAULT_PLANNER_CONFIG: PlannerLayoutConfig = {
  gridColumns: 12,
  gridRows: 12,
  pageSize: "remarkable2",
  orientation: "portrait",
  widgets: [],
  backgroundColor: "#ffffff",
  layoutMode: "columns",
  columns: {
    sections: [
      {
        id: "main",
        direction: "vertical",
        children: [
          { id: "slot-1", type: "widget", flex: 1, widgetId: undefined },
        ],
      },
    ],
  },
};

export const PLANNER_TEMPLATES: Record<string, PlannerTemplate> = {
  "daily-agenda": {
    id: "daily-agenda",
    name: "Daily Planner",
    description: "Comprehensive daily planner with schedule, tasks, and reflection",
    thumbnail: "/templates/daily-agenda.png",
    config: {
      gridColumns: 12,
      gridRows: 12,
      pageSize: "remarkable2",
      orientation: "portrait",
      backgroundColor: "#ffffff",
      layoutMode: "columns",
      widgets: [
        // Left column - Date and Tasks
        {
          id: "text-date",
          type: "text",
          x: 0,
          y: 0,
          width: 4,
          height: 1,
          config: { text: "{{date:D dddd}}", fontSize: "lg", align: "center" },
        },
        {
          id: "calendar-week-mini",
          type: "calendar-week",
          x: 0,
          y: 1,
          width: 4,
          height: 1,
          config: { showDayNames: true, compact: true },
        },
        {
          id: "tasks-top3",
          type: "tasks",
          x: 0,
          y: 2,
          width: 4,
          height: 2,
          config: { maxItems: 3, title: "Top 3 Tasks" },
        },
        {
          id: "tasks-todo",
          type: "tasks",
          x: 0,
          y: 4,
          width: 4,
          height: 3,
          config: { maxItems: 6, title: "To-Do List" },
        },
        {
          id: "tasks-personal",
          type: "tasks",
          x: 0,
          y: 7,
          width: 4,
          height: 3,
          config: { maxItems: 5, title: "Personal" },
        },
        {
          id: "habits-tracker",
          type: "habits",
          x: 0,
          y: 10,
          width: 4,
          height: 2,
          config: { habits: ["Water", "Exercise", "Sleep"], title: "Daily Habits" },
        },
        // Center column - Schedule
        {
          id: "text-schedule",
          type: "text",
          x: 4,
          y: 0,
          width: 4,
          height: 1,
          config: { text: "Schedule", fontSize: "base", align: "center" },
        },
        {
          id: "calendar-day-schedule",
          type: "calendar-day",
          x: 4,
          y: 1,
          width: 4,
          height: 11,
          config: { showTime: true, startHour: 7, endHour: 21 },
        },
        // Right column - Gratitude & Reflection
        {
          id: "text-gratitude-header",
          type: "text",
          x: 8,
          y: 0,
          width: 4,
          height: 1,
          config: { text: "Daily Gratitude", fontSize: "base", align: "center" },
        },
        {
          id: "notes-gratitude",
          type: "notes",
          x: 8,
          y: 1,
          width: 4,
          height: 2,
          config: { title: "Gratitude", lineStyle: "ruled" },
        },
        {
          id: "notes-affirmation",
          type: "notes",
          x: 8,
          y: 3,
          width: 4,
          height: 2,
          config: { title: "Affirmation", lineStyle: "ruled" },
        },
        {
          id: "notes-wins",
          type: "notes",
          x: 8,
          y: 5,
          width: 4,
          height: 3,
          config: { title: "Wins of the Day", lineStyle: "ruled" },
        },
        {
          id: "notes-general",
          type: "notes",
          x: 8,
          y: 8,
          width: 4,
          height: 4,
          config: { title: "Notes", lineStyle: "ruled" },
        },
      ],
      columns: {
        sections: [
          {
            id: "main",
            direction: "horizontal",
            children: [
              // Left column
              {
                id: "left-col",
                type: "section",
                flex: 1,
                section: {
                  id: "left-section",
                  direction: "vertical",
                  children: [
                    { id: "s-date", type: "widget", flex: 0.08, widgetId: "text-date" },
                    { id: "s-week", type: "widget", flex: 0.08, widgetId: "calendar-week-mini" },
                    { id: "s-top3", type: "widget", flex: 0.18, widgetId: "tasks-top3" },
                    { id: "s-todo", type: "widget", flex: 0.24, widgetId: "tasks-todo" },
                    { id: "s-personal", type: "widget", flex: 0.24, widgetId: "tasks-personal" },
                    { id: "s-habits", type: "widget", flex: 0.18, widgetId: "habits-tracker" },
                  ],
                },
              },
              // Center column
              {
                id: "center-col",
                type: "section",
                flex: 1,
                section: {
                  id: "center-section",
                  direction: "vertical",
                  children: [
                    { id: "s-sched-header", type: "widget", flex: 0.08, widgetId: "text-schedule" },
                    { id: "s-schedule", type: "widget", flex: 0.92, widgetId: "calendar-day-schedule" },
                  ],
                },
              },
              // Right column
              {
                id: "right-col",
                type: "section",
                flex: 1,
                section: {
                  id: "right-section",
                  direction: "vertical",
                  children: [
                    { id: "s-grat-header", type: "widget", flex: 0.08, widgetId: "text-gratitude-header" },
                    { id: "s-gratitude", type: "widget", flex: 0.18, widgetId: "notes-gratitude" },
                    { id: "s-affirm", type: "widget", flex: 0.18, widgetId: "notes-affirmation" },
                    { id: "s-wins", type: "widget", flex: 0.24, widgetId: "notes-wins" },
                    { id: "s-notes", type: "widget", flex: 0.32, widgetId: "notes-general" },
                  ],
                },
              },
            ],
          },
        ],
      } as ColumnLayout,
    },
  },
  "adhd-planner": {
    id: "adhd-planner",
    name: "ADHD Daily Planner",
    description: "3-column focus planner with updates, priorities, and schedule",
    thumbnail: "/templates/adhd-planner.png",
    config: {
      gridColumns: 12,
      gridRows: 12,
      pageSize: "remarkable2",
      orientation: "portrait",
      backgroundColor: "#ffffff",
      layoutMode: "columns",
      widgets: [
        // Header - Date banner and meta
        {
          id: "text-date",
          type: "text",
          x: 0,
          y: 0,
          width: 4,
          height: 1,
          config: { text: "{{date:D dddd}}", fontSize: "lg", align: "center" },
        },
        {
          id: "text-week-month",
          type: "text",
          x: 4,
          y: 0,
          width: 8,
          height: 1,
          config: { text: "{{date:MMMM YYYY}}", fontSize: "sm", align: "right" },
        },
        // Column 1 (Left): Updates + Brain Dump
        {
          id: "news-updates",
          type: "news-headlines",
          x: 0,
          y: 1,
          width: 4,
          height: 7,
          config: { maxItems: 5, title: "Updates" },
        },
        {
          id: "notes-brain-dump",
          type: "notes",
          x: 0,
          y: 8,
          width: 4,
          height: 4,
          config: { title: "Brain Dump", lineStyle: "dotted" },
        },
        // Column 2 (Center): Priorities + Reward + Less Important + Trackers
        {
          id: "tasks-focus",
          type: "tasks",
          x: 4,
          y: 1,
          width: 4,
          height: 2,
          config: { maxItems: 3, title: "Focus / Top Priorities" },
        },
        {
          id: "notes-reward",
          type: "notes",
          x: 4,
          y: 3,
          width: 4,
          height: 1,
          config: { title: "My Reward", lineStyle: "ruled" },
        },
        {
          id: "tasks-less-important",
          type: "tasks",
          x: 4,
          y: 4,
          width: 4,
          height: 3,
          config: { maxItems: 5, title: "Less Important" },
        },
        {
          id: "habits-tracker",
          type: "habits",
          x: 4,
          y: 7,
          width: 4,
          height: 5,
          config: { habits: ["Hydration", "Nutrition", "Movement", "Sleep", "Mindfulness"], title: "Self-Care" },
        },
        // Column 3 (Right): Schedule
        {
          id: "calendar-day-schedule",
          type: "calendar-day",
          x: 8,
          y: 1,
          width: 4,
          height: 11,
          config: { showTime: true, startHour: 7, endHour: 21 },
        },
      ],
      columns: {
        sections: [
          {
            id: "main",
            direction: "vertical",
            children: [
              // Header row
              {
                id: "header-row",
                type: "section",
                flex: 0.08,
                section: {
                  id: "header-section",
                  direction: "horizontal",
                  children: [
                    { id: "s-date", type: "widget", flex: 1, widgetId: "text-date" },
                    { id: "s-month", type: "widget", flex: 2, widgetId: "text-week-month" },
                  ],
                },
              },
              // Body - 3 columns
              {
                id: "body",
                type: "section",
                flex: 0.92,
                section: {
                  id: "body-section",
                  direction: "horizontal",
                  children: [
                    // Left column
                    {
                      id: "col1",
                      type: "section",
                      flex: 1,
                      section: {
                        id: "col1-section",
                        direction: "vertical",
                        children: [
                          { id: "s-updates", type: "widget", flex: 0.64, widgetId: "news-updates" },
                          { id: "s-braindump", type: "widget", flex: 0.36, widgetId: "notes-brain-dump" },
                        ],
                      },
                    },
                    // Center column
                    {
                      id: "col2",
                      type: "section",
                      flex: 1,
                      section: {
                        id: "col2-section",
                        direction: "vertical",
                        children: [
                          { id: "s-focus", type: "widget", flex: 0.2, widgetId: "tasks-focus" },
                          { id: "s-reward", type: "widget", flex: 0.1, widgetId: "notes-reward" },
                          { id: "s-less", type: "widget", flex: 0.28, widgetId: "tasks-less-important" },
                          { id: "s-habits", type: "widget", flex: 0.42, widgetId: "habits-tracker" },
                        ],
                      },
                    },
                    // Right column
                    { id: "col3", type: "widget", flex: 1, widgetId: "calendar-day-schedule" },
                  ],
                },
              },
            ],
          },
        ],
      } as ColumnLayout,
    },
  },
  "weekly-planner": {
    id: "weekly-planner",
    name: "Weekly Planner",
    description: "7-day week view with tasks sidebar",
    thumbnail: "/templates/weekly-planner.png",
    config: {
      gridColumns: 12,
      gridRows: 8,
      pageSize: "remarkable2",
      orientation: "landscape",
      backgroundColor: "#ffffff",
      layoutMode: "columns",
      widgets: [
        {
          id: "text-week",
          type: "text",
          x: 0,
          y: 0,
          width: 12,
          height: 1,
          config: { text: "Week of {{date:MMMM D, YYYY}}", fontSize: "xl", fontWeight: "bold", textAlign: "center" },
        },
        {
          id: "calendar-week-main",
          type: "calendar-week",
          x: 0,
          y: 1,
          width: 10,
          height: 6,
          config: { showDayNames: true, showDates: true, compactEvents: true },
        },
        {
          id: "tasks-sidebar",
          type: "tasks",
          x: 10,
          y: 1,
          width: 2,
          height: 6,
          config: { maxItems: 15, showCheckboxes: true, showDueDate: false },
        },
        {
          id: "notes-footer",
          type: "notes",
          x: 0,
          y: 7,
          width: 12,
          height: 1,
          config: { lineSpacing: 20, showTitle: false, lineStyle: "ruled" },
        },
      ],
      columns: {
        sections: [
          {
            id: "main",
            direction: "vertical",
            children: [
              { id: "s-header", type: "widget", flex: 0.1, widgetId: "text-week" },
              {
                id: "body",
                type: "section",
                flex: 0.8,
                section: {
                  id: "body-section",
                  direction: "horizontal",
                  children: [
                    { id: "s-week", type: "widget", flex: 5, widgetId: "calendar-week-main" },
                    { id: "s-tasks", type: "widget", flex: 1, widgetId: "tasks-sidebar" },
                  ],
                },
              },
              { id: "s-footer", type: "widget", flex: 0.1, widgetId: "notes-footer" },
            ],
          },
        ],
      } as ColumnLayout,
    },
  },
  "information-dashboard": {
    id: "information-dashboard",
    name: "Information Dashboard",
    description: "News, weather, upcoming events, and tasks",
    thumbnail: "/templates/info-dashboard.png",
    config: {
      gridColumns: 12,
      gridRows: 8,
      pageSize: "remarkable2",
      orientation: "portrait",
      backgroundColor: "#ffffff",
      layoutMode: "columns",
      widgets: [
        {
          id: "text-title",
          type: "text",
          x: 0,
          y: 0,
          width: 12,
          height: 1,
          config: { text: "{{date:dddd, MMMM D}}", fontSize: "xl", fontWeight: "bold", textAlign: "center" },
        },
        {
          id: "weather-top",
          type: "weather",
          x: 0,
          y: 1,
          width: 6,
          height: 2,
          config: { showIcon: true, showHighLow: true, forecastDays: 3 },
        },
        {
          id: "calendar-day-events",
          type: "calendar-day",
          x: 6,
          y: 1,
          width: 6,
          height: 3,
          config: { showTimeSlots: false, showLocation: true },
        },
        {
          id: "divider-1",
          type: "divider",
          x: 0,
          y: 3,
          width: 6,
          height: 1,
          config: { orientation: "horizontal", style: "solid" },
        },
        {
          id: "news-left",
          type: "news-headlines",
          x: 0,
          y: 4,
          width: 6,
          height: 4,
          config: { maxItems: 8, showSource: true },
        },
        {
          id: "tasks-right",
          type: "tasks",
          x: 6,
          y: 4,
          width: 6,
          height: 4,
          config: { maxItems: 10, showCheckboxes: true },
        },
      ],
      columns: {
        sections: [
          {
            id: "main",
            direction: "vertical",
            children: [
              { id: "s-title", type: "widget", flex: 0.1, widgetId: "text-title" },
              // Top row: weather + calendar
              {
                id: "top-row",
                type: "section",
                flex: 0.35,
                section: {
                  id: "top-section",
                  direction: "horizontal",
                  children: [
                    {
                      id: "top-left",
                      type: "section",
                      flex: 1,
                      section: {
                        id: "top-left-section",
                        direction: "vertical",
                        children: [
                          { id: "s-weather", type: "widget", flex: 0.7, widgetId: "weather-top" },
                          { id: "s-divider", type: "widget", flex: 0.3, widgetId: "divider-1" },
                        ],
                      },
                    },
                    { id: "s-calendar", type: "widget", flex: 1, widgetId: "calendar-day-events" },
                  ],
                },
              },
              // Bottom row: news + tasks
              {
                id: "bottom-row",
                type: "section",
                flex: 0.55,
                section: {
                  id: "bottom-section",
                  direction: "horizontal",
                  children: [
                    { id: "s-news", type: "widget", flex: 1, widgetId: "news-left" },
                    { id: "s-tasks", type: "widget", flex: 1, widgetId: "tasks-right" },
                  ],
                },
              },
            ],
          },
        ],
      } as ColumnLayout,
    },
  },
  "habit-tracker": {
    id: "habit-tracker",
    name: "Habit Tracker",
    description: "Monthly habit tracking grid with notes",
    thumbnail: "/templates/habit-tracker.png",
    config: {
      gridColumns: 12,
      gridRows: 8,
      pageSize: "remarkable2",
      orientation: "landscape",
      backgroundColor: "#ffffff",
      layoutMode: "columns",
      widgets: [
        {
          id: "text-month",
          type: "text",
          x: 0,
          y: 0,
          width: 12,
          height: 1,
          config: { text: "{{date:MMMM YYYY}} Habits", fontSize: "xl", fontWeight: "bold", textAlign: "center" },
        },
        {
          id: "habits-grid",
          type: "habits",
          x: 0,
          y: 1,
          width: 12,
          height: 5,
          config: {
            habits: ["Exercise", "Read", "Meditate", "Drink Water", "Journal"],
            showDates: true,
            checkboxStyle: "circle",
          },
        },
        {
          id: "divider-bottom",
          type: "divider",
          x: 0,
          y: 6,
          width: 12,
          height: 1,
          config: { orientation: "horizontal", style: "dashed" },
        },
        {
          id: "notes-bottom",
          type: "notes",
          x: 0,
          y: 7,
          width: 12,
          height: 1,
          config: { lineSpacing: 20, showTitle: false, lineStyle: "ruled" },
        },
      ],
      columns: {
        sections: [
          {
            id: "main",
            direction: "vertical",
            children: [
              { id: "s-title", type: "widget", flex: 0.1, widgetId: "text-month" },
              { id: "s-habits", type: "widget", flex: 0.65, widgetId: "habits-grid" },
              { id: "s-divider", type: "widget", flex: 0.05, widgetId: "divider-bottom" },
              { id: "s-notes", type: "widget", flex: 0.2, widgetId: "notes-bottom" },
            ],
          },
        ],
      } as ColumnLayout,
    },
  },
  "month-at-glance": {
    id: "month-at-glance",
    name: "Month at a Glance",
    description: "Full month calendar with mini task list",
    thumbnail: "/templates/month-glance.png",
    config: {
      gridColumns: 12,
      gridRows: 8,
      pageSize: "remarkable2",
      orientation: "landscape",
      backgroundColor: "#ffffff",
      layoutMode: "columns",
      widgets: [
        {
          id: "text-month",
          type: "text",
          x: 0,
          y: 0,
          width: 12,
          height: 1,
          config: { text: "{{date:MMMM YYYY}}", fontSize: "2xl", fontWeight: "bold", textAlign: "center" },
        },
        {
          id: "calendar-month-main",
          type: "calendar-month",
          x: 0,
          y: 1,
          width: 9,
          height: 7,
          config: { showWeekNumbers: true, highlightToday: true, showEventDots: true },
        },
        {
          id: "tasks-sidebar",
          type: "tasks",
          x: 9,
          y: 1,
          width: 3,
          height: 4,
          config: { maxItems: 10, showCheckboxes: true, showDueDate: true },
        },
        {
          id: "notes-sidebar",
          type: "notes",
          x: 9,
          y: 5,
          width: 3,
          height: 3,
          config: { lineSpacing: 18, title: "Notes", lineStyle: "ruled" },
        },
      ],
      columns: {
        sections: [
          {
            id: "main",
            direction: "vertical",
            children: [
              { id: "s-title", type: "widget", flex: 0.1, widgetId: "text-month" },
              {
                id: "body",
                type: "section",
                flex: 0.9,
                section: {
                  id: "body-section",
                  direction: "horizontal",
                  children: [
                    { id: "s-month", type: "widget", flex: 3, widgetId: "calendar-month-main" },
                    {
                      id: "sidebar",
                      type: "section",
                      flex: 1,
                      section: {
                        id: "sidebar-section",
                        direction: "vertical",
                        children: [
                          { id: "s-tasks", type: "widget", flex: 0.57, widgetId: "tasks-sidebar" },
                          { id: "s-notes", type: "widget", flex: 0.43, widgetId: "notes-sidebar" },
                        ],
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      } as ColumnLayout,
    },
  },
  blank: {
    id: "blank",
    name: "Blank Canvas",
    description: "Start from scratch with an empty layout",
    thumbnail: "/templates/blank.png",
    config: {
      gridColumns: 12,
      gridRows: 8,
      pageSize: "remarkable2",
      orientation: "portrait",
      backgroundColor: "#ffffff",
      layoutMode: "columns",
      widgets: [],
      columns: {
        sections: [
          {
            id: "main",
            direction: "vertical",
            children: [
              { id: "slot-1", type: "widget", flex: 1, widgetId: undefined },
            ],
          },
        ],
      } as ColumnLayout,
    },
  },
  "adhd-live-planner": {
    id: "adhd-live-planner",
    name: "ADHD Live Planner",
    description: "Interactive 3-column planner with resizable sections - edit directly in the styled view",
    thumbnail: "/templates/adhd-live.png",
    config: {
      gridColumns: 12,
      gridRows: 12,
      pageSize: "remarkable2",
      orientation: "portrait",
      backgroundColor: "#f5f2ed",
      layoutMode: "columns",
      widgets: [
        // Header text widget
        {
          id: "header-text",
          type: "text",
          x: 0,
          y: 0,
          width: 12,
          height: 1,
          config: { text: "{{date:D dddd}}", fontSize: "lg", fontWeight: "bold" },
        },
        // Updates widget (left column)
        {
          id: "updates",
          type: "news-headlines",
          x: 0,
          y: 1,
          width: 4,
          height: 7,
          config: { maxItems: 5, title: "Updates" },
        },
        // Focus/Priorities widget (center column top)
        {
          id: "priorities",
          type: "tasks",
          x: 4,
          y: 1,
          width: 4,
          height: 3,
          config: { maxItems: 3, title: "Focus / Top Priorities" },
        },
        // Reward widget (center column)
        {
          id: "reward",
          type: "notes",
          x: 4,
          y: 4,
          width: 4,
          height: 1,
          config: { title: "My Reward", lineStyle: "ruled" },
        },
        // Less Important tasks (center column)
        {
          id: "less-important",
          type: "tasks",
          x: 4,
          y: 5,
          width: 4,
          height: 3,
          config: { maxItems: 5, title: "Less Important" },
        },
        // Schedule widget (right column)
        {
          id: "schedule",
          type: "calendar-day",
          x: 8,
          y: 1,
          width: 4,
          height: 7,
          config: { showTime: true, startHour: 7, endHour: 21, title: "Schedule" },
        },
        // Brain Dump widget (bottom left)
        {
          id: "brain-dump",
          type: "notes",
          x: 0,
          y: 8,
          width: 6,
          height: 4,
          config: { title: "Brain Dump", lineStyle: "dotted" },
        },
        // Self-Care / Habits widget (bottom right)
        {
          id: "self-care",
          type: "habits",
          x: 6,
          y: 8,
          width: 6,
          height: 4,
          config: { habits: ["Hydration", "Nutrition", "Movement", "Sleep", "Mindfulness"], title: "Self-Care", columns: 2, showLabels: true },
        },
      ],
      columns: {
        sections: [
          {
            id: "main",
            direction: "vertical",
            children: [
              // Header row
              { id: "header", type: "widget", flex: 0.08, widgetId: "header-text" },
              // Body - 3 columns
              {
                id: "body",
                type: "section",
                flex: 0.72,
                section: {
                  id: "body-section",
                  direction: "horizontal",
                  children: [
                    // Left column - Updates
                    { id: "col1", type: "widget", flex: 1, widgetId: "updates" },
                    // Center column - nested vertical section
                    {
                      id: "col2",
                      type: "section",
                      flex: 1,
                      section: {
                        id: "col2-section",
                        direction: "vertical",
                        children: [
                          { id: "col2-top", type: "widget", flex: 1.2, widgetId: "priorities" },
                          { id: "col2-reward", type: "widget", flex: 0.4, widgetId: "reward" },
                          { id: "col2-tasks", type: "widget", flex: 1.2, widgetId: "less-important" },
                        ],
                      },
                    },
                    // Right column - Schedule
                    { id: "col3", type: "widget", flex: 1, widgetId: "schedule" },
                  ],
                },
              },
              // Bottom row - 2 sections
              {
                id: "bottom",
                type: "section",
                flex: 0.2,
                section: {
                  id: "bottom-section",
                  direction: "horizontal",
                  children: [
                    { id: "bottom-left", type: "widget", flex: 1, widgetId: "brain-dump" },
                    { id: "bottom-right", type: "widget", flex: 1, widgetId: "self-care" },
                  ],
                },
              },
            ],
          },
        ],
      } as ColumnLayout,
    },
  },
};

export function getTemplateById(id: string): PlannerTemplate | undefined {
  return PLANNER_TEMPLATES[id];
}

export function getAllTemplates(): PlannerTemplate[] {
  return Object.values(PLANNER_TEMPLATES);
}
