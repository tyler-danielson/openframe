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
      <div className="relative flex h-[80vh] w-full max-w-4xl flex-col rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 p-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Add Entities</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search entities..."
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Domain sidebar */}
          <div className="w-48 border-r border-gray-200 dark:border-gray-700 overflow-y-auto bg-gray-50 dark:bg-gray-800/50">
            <div className="p-2">
              <button
                onClick={() => setSelectedDomain(null)}
                className={cn(
                  "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                  selectedDomain === null
                    ? "bg-primary text-primary-foreground"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
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
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                  )}
                >
                  {DOMAIN_LABELS[domain] || domain} ({groupedEntities[domain]?.length || 0})
                </button>
              ))}
            </div>
          </div>

          {/* Entity list */}
          <div className="flex-1 overflow-y-auto p-4 bg-white dark:bg-gray-900">
            {isLoading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400 dark:text-gray-500" />
              </div>
            ) : filteredEntities.length === 0 ? (
              <div className="flex h-full items-center justify-center text-gray-500 dark:text-gray-400">
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
                        isSelected
                          ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950"
                          : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium truncate text-gray-900 dark:text-gray-100">{name}</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {entity.entity_id}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          State: {entity.state}
                        </p>
                      </div>

                      {isSelected ? (
                        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                          <Check className="h-4 w-4" />
                          Added
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600"
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
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/50">
          <Button onClick={onClose} className="w-full">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
