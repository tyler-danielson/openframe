import { useState, useMemo } from "react";
import { X, Search, Loader2 } from "lucide-react";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";
import { useHAWebSocket } from "../../stores/homeassistant-ws";

interface HAEntityBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (entityId: string) => void;
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
  person: "People",
  device_tracker: "Device Trackers",
  weather: "Weather",
  sun: "Sun",
  zone: "Zones",
  number: "Numbers",
  select: "Selects",
  button: "Buttons",
  update: "Updates",
};

export function HAEntityBrowser({ isOpen, onClose, onSelect }: HAEntityBrowserProps) {
  const [search, setSearch] = useState("");
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const { entityStates, connected, connecting } = useHAWebSocket();

  const entities = useMemo(() => {
    return Array.from(entityStates.values()).map((entity) => ({
      entityId: entity.entity_id,
      name: (entity.attributes.friendly_name as string) || entity.entity_id,
      state: entity.state,
      domain: entity.entity_id.split(".")[0] || "",
      icon: entity.attributes.icon as string | undefined,
      unitOfMeasurement: entity.attributes.unit_of_measurement as string | undefined,
    }));
  }, [entityStates]);

  // Group entities by domain
  const groupedEntities = useMemo(() => {
    const groups: Record<string, typeof entities> = {};
    for (const entity of entities) {
      if (!groups[entity.domain]) {
        groups[entity.domain] = [];
      }
      groups[entity.domain]!.push(entity);
    }
    // Sort entities within each group
    for (const domain of Object.keys(groups)) {
      groups[domain]!.sort((a, b) => a.name.localeCompare(b.name));
    }
    return groups;
  }, [entities]);

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
    let result = selectedDomain ? groupedEntities[selectedDomain] || [] : entities;

    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.name.toLowerCase().includes(searchLower) ||
          e.entityId.toLowerCase().includes(searchLower)
      );
    }

    return result;
  }, [groupedEntities, selectedDomain, entities, search]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative flex h-[80vh] w-full max-w-4xl flex-col rounded-lg bg-card border border-border shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h2 className="text-lg font-semibold">Select Entity</h2>
            <p className="text-sm text-muted-foreground">
              {connected
                ? `${entities.length} entities available`
                : connecting
                ? "Connecting to Home Assistant..."
                : "Not connected to Home Assistant"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-border p-4 bg-muted/30">
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
          <div className="w-48 border-r border-border overflow-y-auto bg-muted/30">
            <div className="p-2 space-y-1">
              <button
                onClick={() => setSelectedDomain(null)}
                className={cn(
                  "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                  selectedDomain === null
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted"
                )}
              >
                All ({entities.length})
              </button>
              {domains.map((domain) => (
                <button
                  key={domain}
                  onClick={() => setSelectedDomain(domain)}
                  className={cn(
                    "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                    selectedDomain === domain
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  {DOMAIN_LABELS[domain] || domain} ({groupedEntities[domain]?.length || 0})
                </button>
              ))}
            </div>
          </div>

          {/* Entity list */}
          <div className="flex-1 overflow-y-auto p-4">
            {!connected && !connecting ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <p className="font-medium">Not connected to Home Assistant</p>
                  <p className="text-sm mt-1">Configure Home Assistant in settings to browse entities</p>
                </div>
              </div>
            ) : connecting ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredEntities.length === 0 ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                No entities found
              </div>
            ) : (
              <div className="space-y-2">
                {filteredEntities.map((entity) => (
                  <button
                    key={entity.entityId}
                    onClick={() => onSelect(entity.entityId)}
                    className={cn(
                      "w-full flex items-center justify-between rounded-md border border-border p-3 transition-colors",
                      "bg-muted/30 hover:bg-muted text-left"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium truncate">{entity.name}</h4>
                      <p className="text-xs text-muted-foreground truncate">
                        {entity.entityId}
                      </p>
                    </div>
                    <div className="ml-4 text-right flex-shrink-0">
                      <p className="text-sm font-medium">
                        {entity.state}
                        {entity.unitOfMeasurement && (
                          <span className="text-muted-foreground ml-1">
                            {entity.unitOfMeasurement}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {entity.domain}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border p-4 bg-muted/30">
          <Button onClick={onClose} variant="outline" className="w-full">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
