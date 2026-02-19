/** Max data age (in ms) before a widget shows the stale-data overlay while offline. */
export const STALE_THRESHOLDS = {
  weather: 30 * 60 * 1000,       // 30 min - changes slowly
  forecast: 30 * 60 * 1000,      // 30 min
  sports: 2 * 60 * 1000,         // 2 min  - live scores need currency
  news: 15 * 60 * 1000,          // 15 min - headlines are OK for a while
  calendar: 10 * 60 * 1000,      // 10 min - schedule is relatively stable
  upNext: 10 * 60 * 1000,        // 10 min
  tasks: 10 * 60 * 1000,         // 10 min
  haEntity: 5 * 60 * 1000,       // 5 min  - device state needs moderate freshness
  haGauge: 5 * 60 * 1000,        // 5 min
  haGraph: 5 * 60 * 1000,        // 5 min
  haCamera: 2 * 60 * 1000,       // 2 min  - visual feed is time-sensitive
  daySchedule: 10 * 60 * 1000,   // 10 min
  weekSchedule: 10 * 60 * 1000,  // 10 min
  headlines: 15 * 60 * 1000,     // 15 min
  dashboardTasks: 10 * 60 * 1000,// 10 min
  sportsTicker: 2 * 60 * 1000,   // 2 min
} as const;
