import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Zap, Power, Thermometer, Lightbulb, Fan, Lock } from "lucide-react";
import { api } from "../../../services/api";
import { Card } from "../../../components/ui/Card";
import { CompanionPageHeader } from "../components/CompanionPageHeader";

function getEntityIcon(entityId: string) {
  if (entityId.startsWith("light.")) return Lightbulb;
  if (entityId.startsWith("switch.")) return Power;
  if (entityId.startsWith("fan.")) return Fan;
  if (entityId.startsWith("climate.")) return Thermometer;
  if (entityId.startsWith("lock.")) return Lock;
  return Zap;
}

function isToggleable(entityId: string) {
  return (
    entityId.startsWith("light.") ||
    entityId.startsWith("switch.") ||
    entityId.startsWith("fan.") ||
    entityId.startsWith("lock.")
  );
}

export function CompanionHAPage() {
  const queryClient = useQueryClient();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  const { data: rooms } = useQuery({
    queryKey: ["companion-ha-rooms"],
    queryFn: () => api.getHomeAssistantRooms(),
    staleTime: 60_000,
  });

  const { data: entities, isLoading } = useQuery({
    queryKey: ["companion-ha-entities", selectedRoomId],
    queryFn: () => api.getHomeAssistantEntities(selectedRoomId ? { roomId: selectedRoomId } : undefined),
    staleTime: 30_000,
    refetchInterval: 10_000,
  });

  const { data: states } = useQuery({
    queryKey: ["companion-ha-states"],
    queryFn: () => api.getHomeAssistantStates(),
    staleTime: 10_000,
    refetchInterval: 10_000,
  });

  const toggleMutation = useMutation({
    mutationFn: async (entityId: string) => {
      const domain = entityId.split(".")[0];
      const stateMap = new Map((states || []).map((s: any) => [s.entity_id, s]));
      const currentState = stateMap.get(entityId);
      const isOn = currentState?.state === "on" || currentState?.state === "unlocked";

      if (domain === "lock") {
        await api.callHomeAssistantService("lock", isOn ? "lock" : "unlock", { entity_id: entityId });
      } else {
        await api.callHomeAssistantService(domain!, isOn ? "turn_off" : "turn_on", { entity_id: entityId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companion-ha-states"] });
    },
  });

  const stateMap = new Map((states || []).map((s: any) => [s.entity_id, s]));

  return (
    <div className="flex flex-col h-full">
      <CompanionPageHeader title="Home Assistant" backTo="/companion/more" />

      {/* Room filter */}
      <div className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-none shrink-0">
        <button
          onClick={() => setSelectedRoomId(null)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            selectedRoomId === null
              ? "bg-primary text-primary-foreground"
              : "bg-card border border-border text-foreground hover:bg-primary/5"
          }`}
        >
          All
        </button>
        {(rooms || []).map((room: any) => (
          <button
            key={room.id}
            onClick={() => setSelectedRoomId(room.id)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selectedRoomId === room.id
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-foreground hover:bg-primary/5"
            }`}
          >
            {room.name}
          </button>
        ))}
      </div>

      {/* Entity list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !entities || (entities as any[]).length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Zap className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No entities found</p>
          </div>
        ) : (
          (entities as any[]).map((entity: any) => {
            const entityId = entity.entityId || entity.entity_id;
            const Icon = getEntityIcon(entityId);
            const state = stateMap.get(entityId);
            const isOn = state?.state === "on" || state?.state === "unlocked";
            const canToggle = isToggleable(entityId);

            return (
              <Card key={entity.id} className="flex items-center gap-3 px-4 py-3">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                  isOn ? "bg-primary/10" : "bg-muted"
                }`}>
                  <Icon className={`h-5 w-5 ${isOn ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {entity.displayName || state?.attributes?.friendly_name || entityId}
                  </div>
                  <div className="text-xs text-muted-foreground capitalize">
                    {state?.state || "unknown"}
                  </div>
                </div>
                {canToggle && (
                  <button
                    onClick={() => toggleMutation.mutate(entityId)}
                    className={`w-12 h-7 rounded-full transition-colors relative ${
                      isOn ? "bg-primary" : "bg-muted"
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                        isOn ? "translate-x-[22px]" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
