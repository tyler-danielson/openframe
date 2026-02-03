import { useState, useEffect } from "react";
import { AlertTriangle, X, Clock, Bell, BellOff, Sparkles } from "lucide-react";
import { useDurationAlertStore, type DurationAlert } from "../../stores/duration-alerts";
import { cn } from "../../lib/utils";
import { api } from "../../services/api";
import type { AutomationNotification } from "@openframe/shared";

function formatDuration(stateChangedAt: string): string {
  const now = new Date();
  const changed = new Date(stateChangedAt);
  const diffMs = now.getTime() - changed.getTime();
  const minutes = Math.floor(diffMs / (1000 * 60));

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

function getStateDescription(domain: string): string {
  switch (domain) {
    case "light":
    case "switch":
    case "fan":
    case "input_boolean":
      return "on";
    case "cover":
      return "open";
    case "lock":
      return "unlocked";
    case "binary_sensor":
      return "active";
    default:
      return "on";
  }
}

interface AlertItemProps {
  alert: DurationAlert;
  onSnooze: (minutes: number) => void;
  onDismiss: () => void;
}

function AlertItem({ alert, onSnooze, onDismiss }: AlertItemProps) {
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);

  return (
    <div className="flex items-center gap-3 rounded-lg bg-amber-500/20 border border-amber-500/40 px-3 py-2">
      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-amber-100 truncate block">
          {alert.entityName}
        </span>
        <span className="text-xs text-amber-200/80">
          {getStateDescription(alert.domain)} for {formatDuration(alert.stateChangedAt)}
        </span>
      </div>
      <div className="flex items-center gap-1 shrink-0 relative">
        <button
          onClick={() => setShowSnoozeMenu(!showSnoozeMenu)}
          className="p-1.5 rounded hover:bg-amber-500/30 text-amber-200 transition-colors"
          title="Snooze"
        >
          <Clock className="h-4 w-4" />
        </button>
        {showSnoozeMenu && (
          <div className="absolute top-full right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg py-1 z-50 min-w-[120px]">
            <button
              onClick={() => { onSnooze(15); setShowSnoozeMenu(false); }}
              className="w-full px-3 py-1.5 text-left text-sm text-gray-200 hover:bg-gray-700"
            >
              15 minutes
            </button>
            <button
              onClick={() => { onSnooze(30); setShowSnoozeMenu(false); }}
              className="w-full px-3 py-1.5 text-left text-sm text-gray-200 hover:bg-gray-700"
            >
              30 minutes
            </button>
            <button
              onClick={() => { onSnooze(60); setShowSnoozeMenu(false); }}
              className="w-full px-3 py-1.5 text-left text-sm text-gray-200 hover:bg-gray-700"
            >
              1 hour
            </button>
            <button
              onClick={() => { onSnooze(120); setShowSnoozeMenu(false); }}
              className="w-full px-3 py-1.5 text-left text-sm text-gray-200 hover:bg-gray-700"
            >
              2 hours
            </button>
          </div>
        )}
        <button
          onClick={onDismiss}
          className="p-1.5 rounded hover:bg-amber-500/30 text-amber-200 transition-colors"
          title="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

interface AutomationNotificationItemProps {
  notification: AutomationNotification;
  onDismiss: () => void;
}

function AutomationNotificationItem({ notification, onDismiss }: AutomationNotificationItemProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-purple-500/20 border border-purple-500/40 px-3 py-2">
      <Sparkles className="h-4 w-4 text-purple-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-purple-100 truncate block">
          {notification.title}
        </span>
        <span className="text-xs text-purple-200/80">
          {notification.message}
        </span>
      </div>
      <button
        onClick={onDismiss}
        className="p-1.5 rounded hover:bg-purple-500/30 text-purple-200 transition-colors shrink-0"
        title="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function DurationAlertBanner() {
  const getActiveAlerts = useDurationAlertStore((state) => state.getActiveAlerts);
  const snoozeAlert = useDurationAlertStore((state) => state.snoozeAlert);
  const dismissAlert = useDurationAlertStore((state) => state.dismissAlert);
  const getActiveAutomationNotifications = useDurationAlertStore((state) => state.getActiveAutomationNotifications);
  const setAutomationNotifications = useDurationAlertStore((state) => state.setAutomationNotifications);
  const dismissAutomationNotification = useDurationAlertStore((state) => state.dismissAutomationNotification);

  const activeAlerts = getActiveAlerts();
  const automationNotifications = getActiveAutomationNotifications();

  // Poll for automation notifications
  useEffect(() => {
    const pollNotifications = async () => {
      try {
        const notifications = await api.getAutomationNotifications();
        setAutomationNotifications(notifications);
      } catch {
        // Ignore errors - notifications are optional
      }
    };

    // Initial poll
    pollNotifications();

    // Poll every 10 seconds
    const interval = setInterval(pollNotifications, 10000);

    return () => clearInterval(interval);
  }, [setAutomationNotifications]);

  const handleDismissAutomationNotification = async (id: string) => {
    dismissAutomationNotification(id);
    try {
      await api.dismissAutomationNotification(id);
    } catch {
      // Ignore errors
    }
  };

  const totalAlerts = activeAlerts.length + automationNotifications.length;

  if (totalAlerts === 0) {
    return null;
  }

  return (
    <div className={cn(
      "fixed top-0 left-0 right-0 z-40",
      "bg-gradient-to-r from-amber-900/95 via-amber-800/95 to-amber-900/95",
      "border-b border-amber-500/50 shadow-lg",
      "px-4 py-2"
    )}>
      <div className="max-w-screen-xl mx-auto">
        <div className="flex items-center gap-2 mb-2">
          <Bell className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-medium text-amber-200">
            Alerts ({totalAlerts})
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeAlerts.map((alert) => (
            <AlertItem
              key={alert.entityId}
              alert={alert}
              onSnooze={(minutes) => snoozeAlert(alert.entityId, minutes)}
              onDismiss={() => dismissAlert(alert.entityId)}
            />
          ))}
          {automationNotifications.map((notification) => (
            <AutomationNotificationItem
              key={notification.id}
              notification={notification}
              onDismiss={() => handleDismissAutomationNotification(notification.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
