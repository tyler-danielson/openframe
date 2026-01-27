import { useState, useMemo } from "react";
import { X, Search, Plus, Check, Loader2 } from "lucide-react";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";
import type { HomeAssistantEntityState } from "@openframe/shared";

interface EntityPickerProps {
  isOpen: boolean;
  onClose: () => void;
  allStates: HomeAssistantEntityState[];
  selectedEntityIds: Set<string>;
  onAddEntity: (entityId: string) => Promise<void>;
  isLoading?: boolean;
}

const DOMAIN_LABELS: Record<string, string> = {
  light: "Lights",
  switch: "Switches",
  sensor: "Sensors",
  binary_sensor: "Binary Sensors",
  climate: "Climate",
  cover: "Covers",
  fan: "Fans",
  media_player: "Media Players",
  lock: "Locks",
  scene: "Scenes",
  script: "Scripts",
  automation: "Automations",
  input_boolean: "Input Booleans",
  input_number: "Input Numbers",
  input_select: "Input Selects",
  vacuum: "Vacuums",
  camera: "Cameras",
};

export function EntityPicker({
  isOpen,
  onClose,
  allStates,
  selectedEntityIds,
  onAddEntity,
  isLoading,
}: EntityPickerProps) {
  const [search, setSearch] = useState("");
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [addingEntityId, setAddingEntityId] = useState<string | null>(null);

  // Group entities by domain
  const groupedEntities = useMemo(() => {
    const groups: Record<string, HomeAssistantEntityState[]> = {};

    for (const entity of allStates) {
      const domain = entity.entity_id.split(".")[0]!;
      if (!groups[domain]) {
        groups[domain] = [];
      }
      groups[domain].push(entity);
    }

    // Sort entities within each group
    for (const domain of Object.keys(groups)) {
      groups[domain]!.sort((a, b) => {
        const nameA = (a.attributes.friendly_name as string) || a.entity_id;
        const nameB = (b.attributes.friendly_name as string) || b.entity_id;
        return nameA.localeCompare(nameB);
      });
    }

    return groups;
  }, [allStates]);

  // Get available domains
  const domains = useMemo(() => {
    return Object.keys(groupedEntities).sort((a, b) => {
      const labelA = DOMAIN_LABELS[a] || a;
      const labelB = DOMAIN_LABELS[b] || b;
      return labelA.localeCompare(labelB);
    });
  }, [groupedEntities]);

  // Filter entities
  const filteredEntities = useMemo(() => {
    let entities = selectedDomain
      ? groupedEntities[selectedDomain] || []
      : allStates;

    if (search) {
      const searchLower = search.toLowerCase();
      entities = entities.filter((e) => {
        const name = (e.attributes.friendly_name as string) || e.entity_id;
        return (
          name.toLowerCase().includes(searchLower) ||
          e.entity_id.toLowerCase().includes(searchLower)
        );
      });
    }

    return entities;
  }, [groupedEntities, selectedDomain, allStates, search]);

  const handleAddEntity = async (entityId: string) => {
    setAddingEntityId(entityId);
    try {
      await onAddEntity(entityId);
    } finally {
      setAddingEntityId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative flex h-[80vh] w-full max-w-4xl flex-col rounded-lg bg-card border border-border shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-lg font-semibold">Add Entities</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-border p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search entities..."
              className="w-full rounded-md border border-border bg-background pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Domain sidebar */}
          <div className="w-48 border-r border-border overflow-y-auto">
            <div className="p-2">
              <button
                onClick={() => setSelectedDomain(null)}
                className={cn(
                  "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                  selectedDomain === null
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                )}
              >
                All ({allStates.length})
              </button>
              {domains.map((domain) => (
                <button
                  key={domain}
                  onClick={() => setSelectedDomain(domain)}
                  className={cn(
                    "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                    selectedDomain === domain
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  )}
                >
                  {DOMAIN_LABELS[domain] || domain} ({groupedEntities[domain]?.length || 0})
                </button>
              ))}
            </div>
          </div>

          {/* Entity list */}
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredEntities.length === 0 ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                No entities found
              </div>
            ) : (
              <div className="space-y-2">
                {filteredEntities.map((entity) => {
                  const isSelected = selectedEntityIds.has(entity.entity_id);
                  const isAdding = addingEntityId === entity.entity_id;
                  const name = (entity.attributes.friendly_name as string) || entity.entity_id;

                  return (
                    <div
                      key={entity.entity_id}
                      className={cn(
                        "flex items-center justify-between rounded-md border p-3 transition-colors",
                        isSelected ? "border-primary/30 bg-primary/5" : "border-border"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium truncate">{name}</h4>
                        <p className="text-xs text-muted-foreground truncate">
                          {entity.entity_id}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          State: {entity.state}
                        </p>
                      </div>

                      {isSelected ? (
                        <div className="flex items-center gap-2 text-sm text-primary">
                          <Check className="h-4 w-4" />
                          Added
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAddEntity(entity.entity_id)}
                          disabled={isAdding}
                        >
                          {isAdding ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Plus className="mr-1 h-4 w-4" />
                              Add
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border p-4">
          <Button onClick={onClose} className="w-full">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
