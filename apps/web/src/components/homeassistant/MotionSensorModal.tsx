import { X, Eye, EyeOff } from "lucide-react";
import { cn } from "../../lib/utils";
import type { HomeAssistantEntityState } from "@openframe/shared";
import { formatTimeAgo } from "./sensorDetection";

interface MotionSensorModalProps {
  isOpen: boolean;
  onClose: () => void;
  state: HomeAssistantEntityState;
  displayName?: string | null;
  allEntities?: HomeAssistantEntityState[];
}

export function MotionSensorModal({ isOpen, onClose, state, displayName, allEntities }: MotionSensorModalProps) {
  if (!isOpen) return null;

  const friendlyName = state.attributes.friendly_name;
  const entityName = displayName || (typeof friendlyName === "string" ? friendlyName : null) || state.entity_id;
  const isDetected = state.state === "on";

  // Find other motion sensors
  const relatedMotionSensors = (allEntities || []).filter(
    (e) =>
      e.entity_id !== state.entity_id &&
      e.entity_id.startsWith("binary_sensor.") &&
      e.attributes.device_class === "motion"
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex items-center justify-center w-10 h-10 rounded-full",
              isDetected ? "bg-primary/20" : "bg-muted"
            )}>
              {isDetected ? (
                <Eye className="h-5 w-5 text-primary" />
              ) : (
                <EyeOff className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <h2 className="font-semibold">{entityName}</h2>
              <div className={cn(
                "text-sm",
                isDetected ? "text-primary" : "text-muted-foreground"
              )}>
                {isDetected ? "Motion Detected" : "Clear"}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Status Section */}
          <div className="flex flex-col items-center py-4">
            <div className={cn(
              "relative flex items-center justify-center w-20 h-20 rounded-full mb-4",
              isDetected
                ? "bg-primary/20"
                : "bg-muted"
            )}>
              {isDetected && (
                <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
              )}
              {isDetected ? (
                <Eye className="relative h-10 w-10 text-primary" />
              ) : (
                <EyeOff className="relative h-10 w-10 text-muted-foreground" />
              )}
            </div>
            <div className={cn(
              "text-lg font-semibold",
              isDetected ? "text-primary" : "text-muted-foreground"
            )}>
              {isDetected ? "Motion Detected" : "Clear"}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              Last change: {formatTimeAgo(state.last_changed)}
            </div>
          </div>

          {/* Related Motion Sensors */}
          {relatedMotionSensors.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-primary mb-3">
                All Motion Sensors
              </label>
              <div className="space-y-2">
                {relatedMotionSensors.map((sensor) => {
                  const sensorName = typeof sensor.attributes.friendly_name === "string"
                    ? sensor.attributes.friendly_name
                    : sensor.entity_id;
                  const sensorDetected = sensor.state === "on";

                  return (
                    <div
                      key={sensor.entity_id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "flex items-center justify-center w-8 h-8 rounded-full",
                          sensorDetected ? "bg-primary/20" : "bg-muted"
                        )}>
                          {sensorDetected ? (
                            <Eye className="h-4 w-4 text-primary" />
                          ) : (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <span className="text-sm font-medium">{sensorName}</span>
                      </div>
                      <div className="text-right">
                        <div className={cn(
                          "text-xs font-medium uppercase",
                          sensorDetected ? "text-primary" : "text-muted-foreground"
                        )}>
                          {sensorDetected ? "Detected" : "Clear"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatTimeAgo(sensor.last_changed)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <button
            onClick={onClose}
            className="w-full py-2 px-4 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
