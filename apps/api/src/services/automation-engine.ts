/**
 * Automation Engine Service
 * Handles execution and monitoring of AI-powered smart home automations
 */

import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import {
  haAutomations,
  homeAssistantConfig,
  systemSettings,
  type HAAutomation,
  type TimeTriggerConfig,
  type StateTriggerConfig,
  type DurationTriggerConfig,
  type ServiceCallActionConfig,
  type NotificationActionConfig,
} from "@openframe/database/schema";
import type {
  AutomationTriggerType,
  AutomationActionType,
  AutomationTriggerConfig,
  AutomationActionConfig,
  AutomationNotification,
} from "@openframe/shared";

// Track entity states for duration-based triggers
interface EntityStateTracker {
  entityId: string;
  state: string;
  stateChangedAt: Date;
}

// Track pending notifications to be sent to clients
const pendingNotifications: Map<string, AutomationNotification[]> = new Map();

// Track entity states for duration triggers
const entityStateTrackers: Map<string, EntityStateTracker> = new Map();

export class AutomationEngine {
  private fastify: FastifyInstance;
  private stateChangeQueue: Array<{
    entityId: string;
    oldState: string;
    newState: string;
    userId: string;
  }> = [];

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  /**
   * Process time-based triggers
   * Called every 30 seconds by the scheduler
   */
  async processTimeTriggers(): Promise<void> {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const currentDay = now.getDay(); // 0-6

    try {
      // Get all enabled automations with time triggers
      const automations = await this.fastify.db
        .select()
        .from(haAutomations)
        .where(
          and(
            eq(haAutomations.enabled, true),
            eq(haAutomations.triggerType, "time")
          )
        );

      for (const automation of automations) {
        const config = automation.triggerConfig as TimeTriggerConfig;

        // Check if this is a sun-based trigger
        if (config.time === "sunset" || config.time === "sunrise") {
          // Sun-based triggers would need location data and sun calculation
          // For now, skip these as they require additional setup
          continue;
        }

        // Check if current time matches (within 30 second window)
        if (config.time !== currentTime) {
          continue;
        }

        // Check day of week if specified
        if (config.days && config.days.length > 0 && !config.days.includes(currentDay)) {
          continue;
        }

        // Prevent duplicate executions within the same minute
        if (automation.lastTriggeredAt) {
          const lastTriggered = new Date(automation.lastTriggeredAt);
          const diffMinutes = (now.getTime() - lastTriggered.getTime()) / (1000 * 60);
          if (diffMinutes < 1) {
            continue;
          }
        }

        // Execute the automation
        await this.executeAutomation(automation);
      }
    } catch (error) {
      this.fastify.log.error({ err: error }, "Error processing time triggers");
    }
  }

  /**
   * Process state change from Home Assistant
   * Called when HA WebSocket receives a state_changed event
   */
  async processStateChange(
    userId: string,
    entityId: string,
    oldState: string,
    newState: string
  ): Promise<void> {
    // Update state tracker for duration triggers
    const trackerKey = `${userId}:${entityId}`;
    entityStateTrackers.set(trackerKey, {
      entityId,
      state: newState,
      stateChangedAt: new Date(),
    });

    try {
      // Get automations that match this state change
      const automations = await this.fastify.db
        .select()
        .from(haAutomations)
        .where(
          and(
            eq(haAutomations.userId, userId),
            eq(haAutomations.enabled, true),
            eq(haAutomations.triggerType, "state")
          )
        );

      for (const automation of automations) {
        const config = automation.triggerConfig as StateTriggerConfig;

        // Check if this automation matches the state change
        if (config.entityId !== entityId) {
          continue;
        }

        // Check fromState if specified
        if (config.fromState && config.fromState !== oldState) {
          continue;
        }

        // Check toState
        if (config.toState !== newState) {
          continue;
        }

        // Execute the automation
        await this.executeAutomation(automation);
      }
    } catch (error) {
      this.fastify.log.error({ err: error }, "Error processing state change");
    }
  }

  /**
   * Process duration-based triggers
   * Called every 30 seconds by the scheduler
   */
  async processDurationTriggers(): Promise<void> {
    const now = new Date();

    try {
      // Get all enabled automations with duration triggers
      const automations = await this.fastify.db
        .select()
        .from(haAutomations)
        .where(
          and(
            eq(haAutomations.enabled, true),
            eq(haAutomations.triggerType, "duration")
          )
        );

      for (const automation of automations) {
        const config = automation.triggerConfig as DurationTriggerConfig;
        const trackerKey = `${automation.userId}:${config.entityId}`;
        const tracker = entityStateTrackers.get(trackerKey);

        if (!tracker) {
          continue;
        }

        // Check if entity is in target state
        if (tracker.state !== config.targetState) {
          continue;
        }

        // Check if duration threshold has been exceeded
        const durationMs = now.getTime() - tracker.stateChangedAt.getTime();
        const thresholdMs = config.durationMinutes * 60 * 1000;

        if (durationMs < thresholdMs) {
          continue;
        }

        // Prevent re-triggering for the same duration period
        if (automation.lastTriggeredAt) {
          const lastTriggered = new Date(automation.lastTriggeredAt);
          if (lastTriggered > tracker.stateChangedAt) {
            continue;
          }
        }

        // Execute the automation
        await this.executeAutomation(automation);
      }
    } catch (error) {
      this.fastify.log.error({ err: error }, "Error processing duration triggers");
    }
  }

  /**
   * Execute an automation's action
   */
  async executeAutomation(automation: HAAutomation): Promise<boolean> {
    const actionType = automation.actionType as AutomationActionType;

    try {
      if (actionType === "service_call") {
        await this.executeServiceCall(automation);
      } else if (actionType === "notification") {
        await this.executeNotification(automation);
      }

      // Update automation stats
      await this.fastify.db
        .update(haAutomations)
        .set({
          lastTriggeredAt: new Date(),
          triggerCount: automation.triggerCount + 1,
          updatedAt: new Date(),
        })
        .where(eq(haAutomations.id, automation.id));

      this.fastify.log.info(
        { automationId: automation.id, name: automation.name },
        "Automation executed successfully"
      );

      return true;
    } catch (error) {
      this.fastify.log.error(
        { err: error, automationId: automation.id },
        "Failed to execute automation"
      );
      return false;
    }
  }

  /**
   * Execute a Home Assistant service call
   */
  private async executeServiceCall(automation: HAAutomation): Promise<void> {
    const config = automation.actionConfig as ServiceCallActionConfig;

    // Get user's HA config
    const [haConfig] = await this.fastify.db
      .select()
      .from(homeAssistantConfig)
      .where(eq(homeAssistantConfig.userId, automation.userId))
      .limit(1);

    if (!haConfig) {
      throw new Error("Home Assistant not configured");
    }

    const baseUrl = haConfig.url.replace(/\/+$/, "");
    const serviceData = {
      entity_id: config.entityId,
      ...config.serviceData,
    };

    const response = await fetch(
      `${baseUrl}/api/services/${config.domain}/${config.service}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${haConfig.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(serviceData),
      }
    );

    if (!response.ok) {
      throw new Error(`HA service call failed: ${response.status}`);
    }
  }

  /**
   * Execute a notification action
   */
  private async executeNotification(automation: HAAutomation): Promise<void> {
    const config = automation.actionConfig as NotificationActionConfig;

    const notification: AutomationNotification = {
      id: crypto.randomUUID(),
      automationId: automation.id,
      automationName: automation.name,
      title: config.title,
      message: config.message,
      triggeredAt: new Date().toISOString(),
      dismissed: false,
    };

    // Add to pending notifications for this user
    const userNotifications = pendingNotifications.get(automation.userId) || [];
    userNotifications.push(notification);
    pendingNotifications.set(automation.userId, userNotifications);

    this.fastify.log.info(
      { automationId: automation.id, title: config.title },
      "Notification queued"
    );
  }

  /**
   * Get pending notifications for a user
   */
  getNotifications(userId: string): AutomationNotification[] {
    return pendingNotifications.get(userId) || [];
  }

  /**
   * Dismiss a notification
   */
  dismissNotification(userId: string, notificationId: string): boolean {
    const notifications = pendingNotifications.get(userId);
    if (!notifications) return false;

    const index = notifications.findIndex((n) => n.id === notificationId);
    if (index === -1) return false;

    notifications.splice(index, 1);
    pendingNotifications.set(userId, notifications);
    return true;
  }

  /**
   * Clear all notifications for a user
   */
  clearNotifications(userId: string): void {
    pendingNotifications.delete(userId);
  }

  /**
   * Update entity state tracker (called when receiving HA state updates)
   */
  updateEntityState(userId: string, entityId: string, state: string): void {
    const trackerKey = `${userId}:${entityId}`;
    const existing = entityStateTrackers.get(trackerKey);

    // Only update if state actually changed
    if (!existing || existing.state !== state) {
      entityStateTrackers.set(trackerKey, {
        entityId,
        state,
        stateChangedAt: new Date(),
      });
    }
  }

  /**
   * Test execute an automation action (without updating stats)
   */
  async testExecute(automation: HAAutomation): Promise<{ success: boolean; error?: string }> {
    const actionType = automation.actionType as AutomationActionType;

    try {
      if (actionType === "service_call") {
        await this.executeServiceCall(automation);
      } else if (actionType === "notification") {
        await this.executeNotification(automation);
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { success: false, error: message };
    }
  }
}

// Singleton instance
let engineInstance: AutomationEngine | null = null;

export function getAutomationEngine(fastify: FastifyInstance): AutomationEngine {
  if (!engineInstance) {
    engineInstance = new AutomationEngine(fastify);
  }
  return engineInstance;
}
