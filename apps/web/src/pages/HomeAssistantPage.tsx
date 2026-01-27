import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Home,
  Plus,
  Settings,
  RefreshCw,
  Trash2,
  GripVertical,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { EntityCard } from "../components/homeassistant/EntityCard";
import { EntityPicker } from "../components/homeassistant/EntityPicker";
import { ConfigModal } from "../components/homeassistant/ConfigModal";
import { api } from "../services/api";
import { cn } from "../lib/utils";
import type { HomeAssistantEntityState } from "@openframe/shared";

export function HomeAssistantPage() {
  const queryClient = useQueryClient();
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isEntityPickerOpen, setIsEntityPickerOpen] = useState(false);
  const [draggedEntity, setDraggedEntity] = useState<string | null>(null);

  // Fetch HA config
  const { data: config, isLoading: isLoadingConfig } = useQuery({
    queryKey: ["homeassistant", "config"],
    queryFn: api.getHomeAssistantConfig.bind(api),
  });

  // Fetch all HA states
  const {
    data: allStates,
    isLoading: isLoadingStates,
    refetch: refetchStates,
  } = useQuery({
    queryKey: ["homeassistant", "states"],
    queryFn: api.getHomeAssistantStates.bind(api),
    enabled: !!config,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Fetch selected entities
  const { data: selectedEntities, isLoading: isLoadingEntities } = useQuery({
    queryKey: ["homeassistant", "entities"],
    queryFn: api.getHomeAssistantEntities.bind(api),
    enabled: !!config,
  });

  // Save config mutation
  const saveConfigMutation = useMutation({
    mutationFn: (data: { url: string; accessToken: string }) =>
      api.saveHomeAssistantConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homeassistant"] });
      setIsConfigModalOpen(false);
    },
  });

  // Delete config mutation
  const deleteConfigMutation = useMutation({
    mutationFn: api.deleteHomeAssistantConfig.bind(api),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homeassistant"] });
    },
  });

  // Add entity mutation
  const addEntityMutation = useMutation({
    mutationFn: (data: { entityId: string }) => api.addHomeAssistantEntity(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homeassistant", "entities"] });
    },
  });

  // Remove entity mutation
  const removeEntityMutation = useMutation({
    mutationFn: (id: string) => api.removeHomeAssistantEntity(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homeassistant", "entities"] });
    },
  });

  // Reorder entities mutation
  const reorderEntitiesMutation = useMutation({
    mutationFn: (data: { entityIds: string[] }) =>
      api.reorderHomeAssistantEntities(data.entityIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homeassistant", "entities"] });
    },
  });

  // Call service
  const callServiceMutation = useMutation({
    mutationFn: ({
      domain,
      service,
      data,
    }: {
      domain: string;
      service: string;
      data?: Record<string, unknown>;
    }) => api.callHomeAssistantService(domain, service, data),
    onSuccess: () => {
      // Refresh states after service call
      setTimeout(() => refetchStates(), 500);
    },
  });

  const handleCallService = async (
    domain: string,
    service: string,
    data?: Record<string, unknown>
  ) => {
    await callServiceMutation.mutateAsync({ domain, service, data });
  };

  const handleAddEntity = async (entityId: string) => {
    await addEntityMutation.mutateAsync({ entityId });
  };

  const handleRemoveEntity = async (entityId: string) => {
    // Find the entity to get its ID
    const entity = selectedEntities?.find((e) => e.entityId === entityId);
    if (entity) {
      await removeEntityMutation.mutateAsync(entity.id);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (entityId: string) => {
    setDraggedEntity(entityId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetEntityId: string) => {
    if (!draggedEntity || draggedEntity === targetEntityId || !selectedEntities) return;

    const entityIds = selectedEntities.map((e) => e.entityId);
    const fromIndex = entityIds.indexOf(draggedEntity);
    const toIndex = entityIds.indexOf(targetEntityId);

    if (fromIndex === -1 || toIndex === -1) return;

    const newOrder = [...entityIds];
    newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, draggedEntity);

    reorderEntitiesMutation.mutate({ entityIds: newOrder });
    setDraggedEntity(null);
  };

  const handleDragEnd = () => {
    setDraggedEntity(null);
  };

  // Get state for an entity
  const getEntityState = useCallback(
    (entityId: string): HomeAssistantEntityState | undefined => {
      return allStates?.find((s) => s.entity_id === entityId);
    },
    [allStates]
  );

  // Selected entity IDs set for the picker
  const selectedEntityIds = new Set(selectedEntities?.map((e) => e.entityId) || []);

  const isLoading = isLoadingConfig || isLoadingStates || isLoadingEntities;

  // Not configured state
  if (!isLoadingConfig && !config) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-500/10 mb-6">
          <Home className="h-10 w-10 text-blue-500" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Connect Home Assistant</h1>
        <p className="text-muted-foreground text-center max-w-md mb-6">
          Control your smart home devices directly from OpenFrame. Connect your Home Assistant
          instance to get started.
        </p>
        <Button onClick={() => setIsConfigModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Connect Home Assistant
        </Button>

        <ConfigModal
          isOpen={isConfigModalOpen}
          onClose={() => setIsConfigModalOpen(false)}
          onSubmit={async (data) => {
            await saveConfigMutation.mutateAsync(data);
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
            <Home className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Home Assistant</h1>
            <p className="text-sm text-muted-foreground">
              {config?.url ? new URL(config.url).hostname : "Not connected"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchStates()}
            disabled={isLoadingStates}
          >
            <RefreshCw
              className={cn("mr-2 h-4 w-4", isLoadingStates && "animate-spin")}
            />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEntityPickerOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Entity
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsConfigModalOpen(true)}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !selectedEntities || selectedEntities.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
              <Home className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-medium mb-2">No entities added</h2>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              Add entities from your Home Assistant instance to control them here.
            </p>
            <Button onClick={() => setIsEntityPickerOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Entity
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {selectedEntities.map((entity) => {
              const state = getEntityState(entity.entityId);

              if (!state) {
                return (
                  <div
                    key={entity.entityId}
                    className="rounded-lg border border-border bg-card p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                        <AlertCircle className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">
                          {entity.displayName || entity.entityId}
                        </h3>
                        <p className="text-xs text-muted-foreground">Entity not found</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveEntity(entity.entityId)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={entity.entityId}
                  draggable
                  onDragStart={() => handleDragStart(entity.entityId)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(entity.entityId)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "relative group",
                    draggedEntity === entity.entityId && "opacity-50"
                  )}
                >
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-6 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
                    <GripVertical className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => handleRemoveEntity(entity.entityId)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                  <EntityCard
                    state={state}
                    displayName={entity.displayName}
                    onCallService={handleCallService}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      <ConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        onSubmit={async (data) => {
          await saveConfigMutation.mutateAsync(data);
        }}
        existingUrl={config?.url}
      />

      <EntityPicker
        isOpen={isEntityPickerOpen}
        onClose={() => setIsEntityPickerOpen(false)}
        allStates={allStates || []}
        selectedEntityIds={selectedEntityIds}
        onAddEntity={handleAddEntity}
        isLoading={isLoadingStates}
      />
    </div>
  );
}
