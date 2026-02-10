/**
 * Template Engine for reMarkable
 * Provides a factory for generating different types of PDF templates.
 */

import type { RemarkableTemplateConfig, RemarkableMergeField } from "@openframe/database/schema";

/**
 * Event data for template generation
 */
export interface TemplateEvent {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  isAllDay: boolean;
  location?: string | null;
  description?: string | null;
  calendarName?: string;
  calendarColor?: string;
}

/**
 * Common options for all template generators
 */
export interface TemplateOptions {
  date: Date;
  dateRange?: { start: Date; end: Date };
  events: TemplateEvent[];
  config: RemarkableTemplateConfig;
  mergeFields?: RemarkableMergeField[];
  pdfTemplate?: Buffer; // For user-designed templates
  weather?: {
    temp: number;
    description: string;
    icon: string;
  };
}

/**
 * Result from template generation
 */
export interface TemplateResult {
  buffer: Buffer;
  filename: string;
  pageCount: number;
}

/**
 * Base interface for all template generators
 */
export interface TemplateGenerator {
  /**
   * Generate the PDF template
   */
  generate(options: TemplateOptions): Promise<TemplateResult>;

  /**
   * Get the default config for this template type
   */
  getDefaultConfig(): RemarkableTemplateConfig;

  /**
   * Validate the config for this template type
   */
  validateConfig(config: RemarkableTemplateConfig): { valid: boolean; errors: string[] };
}

/**
 * Template type identifiers
 */
export type TemplateType = "weekly_planner" | "habit_tracker" | "custom_agenda" | "user_designed" | "daily_agenda";

/**
 * Factory function to get the appropriate template generator
 */
export async function getTemplateGenerator(type: TemplateType): Promise<TemplateGenerator> {
  switch (type) {
    case "weekly_planner": {
      const { WeeklyPlannerGenerator } = await import("./generators/weekly-planner.js");
      return new WeeklyPlannerGenerator();
    }
    case "habit_tracker": {
      const { HabitTrackerGenerator } = await import("./generators/habit-tracker.js");
      return new HabitTrackerGenerator();
    }
    case "custom_agenda": {
      const { CustomAgendaGenerator } = await import("./generators/custom-agenda.js");
      return new CustomAgendaGenerator();
    }
    case "user_designed": {
      const { UserTemplateGenerator } = await import("./generators/user-template.js");
      return new UserTemplateGenerator();
    }
    case "daily_agenda": {
      const { DailyAgendaGenerator } = await import("./generators/daily-agenda.js");
      return new DailyAgendaGenerator();
    }
    default:
      throw new Error(`Unknown template type: ${type}`);
  }
}

/**
 * Generate a template by type with the given options
 */
export async function generateTemplate(
  type: TemplateType,
  options: TemplateOptions
): Promise<TemplateResult> {
  const generator = await getTemplateGenerator(type);
  return generator.generate(options);
}

/**
 * Get default config for a template type
 */
export async function getDefaultTemplateConfig(
  type: TemplateType
): Promise<RemarkableTemplateConfig> {
  const generator = await getTemplateGenerator(type);
  return generator.getDefaultConfig();
}

/**
 * Validate config for a template type
 */
export async function validateTemplateConfig(
  type: TemplateType,
  config: RemarkableTemplateConfig
): Promise<{ valid: boolean; errors: string[] }> {
  const generator = await getTemplateGenerator(type);
  return generator.validateConfig(config);
}
