import { useState } from "react";
import { X, Plus, Trash2, GripVertical, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";
import type { HomeAssistantRoom, HomeAssistantEntityState, HomeAssistantEntity } from "@openframe/shared";

interface RoomManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  rooms: HomeAssistantRoom[];
  entities: HomeAssistantEntity[];
  entityStates: HomeAssistantEntityState[];
  onCreateRoom: (data: { name: string; temperatureSensorId?: string; humiditySensorId?: string; windowSensorId?: string }) => Promise<void>;
  onUpdateRoom: (id: string, data: Partial<HomeAssistantRoom>) => Promise<void>;
  onDeleteRoom: (id: string) => Promise<void>;
  onReorderRooms: (roomIds: string[]) => Promise<void>;
  onAssignEntity: (entityId: string, roomId: string | null) => Promise<void>;
}

export function RoomManagementModal({
  isOpen,
  onClose,
  rooms,
  entities,
  entityStates,
  onCreateRoom,
  onUpdateRoom,
  onDeleteRoom,
  onReorderRooms,
  onAssignEntity,
}: RoomManagementModalProps) {
  const [newRoomName, setNewRoomName] = useState("");
  const [editingRoom, setEditingRoom] = useState<HomeAssistantRoom | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;
    setIsCreating(true);
    try {
      await onCreateRoom({ name: newRoomName.trim() });
      setNewRoomName("");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (confirm("Are you sure you want to delete this room? Entities will be moved to 'All Devices'.")) {
      await onDeleteRoom(roomId);
    }
  };

  // Get available sensors from entity states
  const temperatureSensors = entityStates.filter(
    (s) => s.entity_id.startsWith("sensor.") &&
    (s.attributes.device_class === "temperature" ||
     s.attributes.unit_of_measurement === "°C" ||
     s.attributes.unit_of_measurement === "°F")
  );

  const humiditySensors = entityStates.filter(
    (s) => s.entity_id.startsWith("sensor.") &&
    (s.attributes.device_class === "humidity" ||
     s.attributes.unit_of_measurement === "%")
  );

  const binarySensors = entityStates.filter(
    (s) => s.entity_id.startsWith("binary_sensor.") &&
    (s.attributes.device_class === "window" ||
     s.attributes.device_class === "door" ||
     s.attributes.device_class === "opening")
  );

  // Get entities for a room
  const getEntitiesForRoom = (roomId: string | null) => {
    return entities.filter((e) => e.roomId === roomId);
  };

  // Get entity name from state
  const getEntityName = (entityId: string) => {
    const state = entityStates.find(s => s.entity_id === entityId);
    return state?.attributes.friendly_name as string || entityId;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[var(--homio-bg-secondary)] border border-[var(--homio-card-border)] rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--homio-card-border)]">
          <h2 className="text-xl font-medium text-[var(--homio-text-primary)] tracking-wider uppercase">
            Manage Rooms
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="h-5 w-5 text-[var(--homio-text-secondary)]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Create Room */}
          <div className="mb-6">
            <label className="block text-sm uppercase tracking-wider text-[var(--homio-text-secondary)] mb-2">
              Add New Room
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Room name..."
                className="flex-1 bg-white/5 border border-[var(--homio-card-border)] rounded-lg px-4 py-2 text-[var(--homio-text-primary)] placeholder:text-[var(--homio-text-muted)] focus:outline-none focus:border-[var(--homio-accent)]"
                onKeyDown={(e) => e.key === "Enter" && handleCreateRoom()}
              />
              <Button
                onClick={handleCreateRoom}
                disabled={!newRoomName.trim() || isCreating}
                className="bg-[var(--homio-accent)] hover:bg-[var(--homio-accent-light)] text-black"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          </div>

          {/* Room List */}
          <div className="space-y-3">
            {rooms.map((room) => {
              const roomEntities = getEntitiesForRoom(room.id);
              const isExpanded = expandedRoomId === room.id;

              return (
                <div
                  key={room.id}
                  className="bg-white/5 border border-[var(--homio-card-border)] rounded-xl overflow-hidden"
                >
                  {/* Room Header */}
                  <div className="flex items-center gap-3 p-4">
                    <GripVertical className="h-4 w-4 text-[var(--homio-text-muted)] cursor-grab" />

                    {editingRoom?.id === room.id ? (
                      <input
                        type="text"
                        value={editingRoom.name}
                        onChange={(e) => setEditingRoom({ ...editingRoom, name: e.target.value })}
                        onBlur={async () => {
                          if (editingRoom.name.trim() && editingRoom.name !== room.name) {
                            await onUpdateRoom(room.id, { name: editingRoom.name.trim() });
                          }
                          setEditingRoom(null);
                        }}
                        onKeyDown={async (e) => {
                          if (e.key === "Enter") {
                            if (editingRoom.name.trim() && editingRoom.name !== room.name) {
                              await onUpdateRoom(room.id, { name: editingRoom.name.trim() });
                            }
                            setEditingRoom(null);
                          } else if (e.key === "Escape") {
                            setEditingRoom(null);
                          }
                        }}
                        autoFocus
                        className="flex-1 bg-transparent border-b border-[var(--homio-accent)] text-[var(--homio-text-primary)] focus:outline-none"
                      />
                    ) : (
                      <button
                        onClick={() => setEditingRoom(room)}
                        className="flex-1 text-left text-[var(--homio-text-primary)] font-medium hover:text-[var(--homio-accent)] transition-colors"
                      >
                        {room.name}
                      </button>
                    )}

                    <span className="text-sm text-[var(--homio-text-muted)]">
                      {roomEntities.length} devices
                    </span>

                    <button
                      onClick={() => setExpandedRoomId(isExpanded ? null : room.id)}
                      className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-[var(--homio-text-secondary)]" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-[var(--homio-text-secondary)]" />
                      )}
                    </button>

                    <button
                      onClick={() => handleDeleteRoom(room.id)}
                      className="p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </button>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t border-[var(--homio-card-border)] p-4 space-y-4">
                      {/* Sensor Configuration */}
                      <div className="space-y-3">
                        <h4 className="text-xs uppercase tracking-wider text-[var(--homio-text-muted)]">
                          Room Sensors (shown in header)
                        </h4>

                        {/* Temperature Sensor */}
                        <div className="flex items-center gap-3">
                          <label className="text-sm text-[var(--homio-text-secondary)] w-24">Temperature</label>
                          <select
                            value={room.temperatureSensorId || ""}
                            onChange={(e) => onUpdateRoom(room.id, { temperatureSensorId: e.target.value || null })}
                            className="flex-1 bg-white/5 border border-[var(--homio-card-border)] rounded-lg px-3 py-2 text-sm text-[var(--homio-text-primary)] focus:outline-none focus:border-[var(--homio-accent)]"
                          >
                            <option value="">None</option>
                            {temperatureSensors.map((s) => (
                              <option key={s.entity_id} value={s.entity_id}>
                                {s.attributes.friendly_name as string || s.entity_id}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Humidity Sensor */}
                        <div className="flex items-center gap-3">
                          <label className="text-sm text-[var(--homio-text-secondary)] w-24">Humidity</label>
                          <select
                            value={room.humiditySensorId || ""}
                            onChange={(e) => onUpdateRoom(room.id, { humiditySensorId: e.target.value || null })}
                            className="flex-1 bg-white/5 border border-[var(--homio-card-border)] rounded-lg px-3 py-2 text-sm text-[var(--homio-text-primary)] focus:outline-none focus:border-[var(--homio-accent)]"
                          >
                            <option value="">None</option>
                            {humiditySensors.map((s) => (
                              <option key={s.entity_id} value={s.entity_id}>
                                {s.attributes.friendly_name as string || s.entity_id}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Window Sensor */}
                        <div className="flex items-center gap-3">
                          <label className="text-sm text-[var(--homio-text-secondary)] w-24">Window</label>
                          <select
                            value={room.windowSensorId || ""}
                            onChange={(e) => onUpdateRoom(room.id, { windowSensorId: e.target.value || null })}
                            className="flex-1 bg-white/5 border border-[var(--homio-card-border)] rounded-lg px-3 py-2 text-sm text-[var(--homio-text-primary)] focus:outline-none focus:border-[var(--homio-accent)]"
                          >
                            <option value="">None</option>
                            {binarySensors.map((s) => (
                              <option key={s.entity_id} value={s.entity_id}>
                                {s.attributes.friendly_name as string || s.entity_id}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Entities in Room */}
                      {roomEntities.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-xs uppercase tracking-wider text-[var(--homio-text-muted)]">
                            Devices in this room
                          </h4>
                          {roomEntities.map((entity) => (
                            <div
                              key={entity.id}
                              className="flex items-center justify-between py-2 px-3 bg-white/5 rounded-lg"
                            >
                              <span className="text-sm text-[var(--homio-text-primary)]">
                                {entity.displayName || getEntityName(entity.entityId)}
                              </span>
                              <button
                                onClick={() => onAssignEntity(entity.id, null)}
                                className="text-xs text-[var(--homio-text-muted)] hover:text-red-500 transition-colors"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add Entities to Room */}
                      <div className="space-y-2">
                        <h4 className="text-xs uppercase tracking-wider text-[var(--homio-text-muted)]">
                          Add devices to room
                        </h4>
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) {
                              onAssignEntity(e.target.value, room.id);
                            }
                          }}
                          className="w-full bg-white/5 border border-[var(--homio-card-border)] rounded-lg px-3 py-2 text-sm text-[var(--homio-text-primary)] focus:outline-none focus:border-[var(--homio-accent)]"
                        >
                          <option value="">Select a device to add...</option>
                          {entities
                            .filter((e) => e.roomId !== room.id)
                            .map((entity) => (
                              <option key={entity.id} value={entity.id}>
                                {entity.displayName || getEntityName(entity.entityId)}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {rooms.length === 0 && (
            <div className="text-center py-12">
              <p className="text-[var(--homio-text-muted)]">
                No rooms created yet. Add a room above to organize your devices.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
