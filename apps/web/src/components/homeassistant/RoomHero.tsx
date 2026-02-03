import { Thermometer, Droplets, LayoutGrid } from "lucide-react";
import type { HomeAssistantRoom, HomeAssistantEntityState } from "@openframe/shared";

interface RoomHeroProps {
  room: HomeAssistantRoom | null;
  entityStates: HomeAssistantEntityState[];
  totalEntities: number;
}

export function RoomHero({ room, entityStates, totalEntities }: RoomHeroProps) {
  const roomName = room?.name || "All Devices";

  // Get sensor values from entity states
  const getStateValue = (entityId: string | null | undefined): string | null => {
    if (!entityId) return null;
    const state = entityStates.find(s => s.entity_id === entityId);
    if (!state || state.state === "unavailable" || state.state === "unknown") return null;

    const unit = state.attributes.unit_of_measurement as string | undefined;
    return unit ? `${state.state}${unit}` : state.state;
  };

  const getWindowState = (entityId: string | null | undefined): string | null => {
    if (!entityId) return null;
    const state = entityStates.find(s => s.entity_id === entityId);
    if (!state || state.state === "unavailable" || state.state === "unknown") return null;

    // Binary sensor: "on" typically means open/detected
    return state.state === "on" ? "Open" : "Closed";
  };

  const temperature = room ? getStateValue(room.temperatureSensorId) : null;
  const humidity = room ? getStateValue(room.humiditySensorId) : null;
  const windowStatus = room ? getWindowState(room.windowSensorId) : null;

  return (
    <div className="mb-8">
      {/* Room Name */}
      <h1 className="homio-room-title mb-6">
        {roomName}
      </h1>

      {/* Status Bar */}
      <div className="homio-status-bar">
        {temperature && (
          <div className="homio-status-item">
            <Thermometer className="h-4 w-4 text-[var(--homio-accent)]" />
            <span>Temperature</span>
            <span className="homio-status-value">{temperature}</span>
          </div>
        )}

        {humidity && (
          <div className="homio-status-item">
            <Droplets className="h-4 w-4 text-[var(--homio-accent)]" />
            <span>Humidity</span>
            <span className="homio-status-value">{humidity}</span>
          </div>
        )}

        {windowStatus && (
          <div className="homio-status-item">
            <LayoutGrid className="h-4 w-4 text-[var(--homio-accent)]" />
            <span>Windows</span>
            <span className="homio-status-value">{windowStatus}</span>
          </div>
        )}

        {/* If no sensors configured, show entity count */}
        {!temperature && !humidity && !windowStatus && (
          <div className="homio-status-item">
            <LayoutGrid className="h-4 w-4 text-[var(--homio-accent)]" />
            <span>Devices</span>
            <span className="homio-status-value">{totalEntities}</span>
          </div>
        )}
      </div>
    </div>
  );
}
