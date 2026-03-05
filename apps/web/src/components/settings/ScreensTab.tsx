import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  GripVertical,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Pin,
  PinOff,
  PanelLeft,
  LayoutDashboard,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { api } from "../../services/api";
import {
  useSidebarStore,
  SIDEBAR_FEATURES,
  type SidebarFeature,
  type FeatureState,
} from "../../stores/sidebar";
import { cn } from "../../lib/utils";
import { Button } from "../ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/Card";
import type { CustomScreen } from "@openframe/shared";

// Built-in feature display info
const BUILTIN_INFO: Record<string, { label: string; iconName: string }> = {
  calendar: { label: "Calendar", iconName: "Calendar" },
  tasks: { label: "Tasks", iconName: "ListTodo" },
  routines: { label: "Routines", iconName: "ListChecks" },
  dashboard: { label: "Dashboard", iconName: "LayoutDashboard" },
  cardview: { label: "Card View", iconName: "Kanban" },
  photos: { label: "Photos", iconName: "Image" },
  spotify: { label: "Spotify", iconName: "Music" },
  iptv: { label: "Live TV", iconName: "Tv" },
  cameras: { label: "Cameras", iconName: "Camera" },
  multiview: { label: "Multi-View", iconName: "LayoutGrid" },
  homeassistant: { label: "Home Assistant", iconName: "Home" },
  matter: { label: "Matter", iconName: "Cpu" },
  map: { label: "Map", iconName: "MapPin" },
  kitchen: { label: "Kitchen", iconName: "ChefHat" },
  chat: { label: "Chat", iconName: "MessageCircle" },
  screensaver: { label: "Custom Screen", iconName: "Monitor" },
};

function resolveLucideIcon(name: string): React.ComponentType<{ className?: string }> {
  const icons = LucideIcons as Record<string, unknown>;
  if (icons[name] && typeof icons[name] === "function") {
    return icons[name] as React.ComponentType<{ className?: string }>;
  }
  return LayoutDashboard;
}

interface ScreenItem {
  id: string; // feature key or custom screen UUID
  label: string;
  iconName: string;
  isCustom: boolean;
  customScreen?: CustomScreen;
}

function SortableScreenItem({
  item,
  isPinned,
  isEnabled,
  onTogglePin,
  onToggleEnable,
  onEdit,
  onDelete,
}: {
  item: ScreenItem;
  isPinned: boolean;
  isEnabled: boolean;
  onTogglePin: () => void;
  onToggleEnable: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Icon = resolveLucideIcon(item.iconName);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border/50 bg-card px-3 py-2.5 transition-colors",
        isDragging && "z-50 shadow-lg border-primary/50",
        !isEnabled && "opacity-50"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground hover:text-foreground touch-none"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>

      <span className="flex-1 text-sm font-medium">{item.label}</span>

      <div className="flex items-center gap-1">
        <button
          onClick={onTogglePin}
          className={cn(
            "rounded-md p-1.5 transition-colors",
            isPinned
              ? "text-primary hover:text-primary/80"
              : "text-muted-foreground hover:text-foreground"
          )}
          title={isPinned ? "Unpin from sidebar" : "Pin to sidebar"}
        >
          {isPinned ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
        </button>

        <button
          onClick={onToggleEnable}
          className={cn(
            "rounded-md p-1.5 transition-colors",
            isEnabled
              ? "text-primary hover:text-primary/80"
              : "text-muted-foreground hover:text-foreground"
          )}
          title={isEnabled ? "Hide screen" : "Show screen"}
        >
          {isEnabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </button>

        {item.isCustom && onEdit && (
          <button
            onClick={onEdit}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            title="Edit screen"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}

        {item.isCustom && onDelete && (
          <button
            onClick={onDelete}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-destructive"
            title="Delete screen"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export function ScreensTab() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newScreenName, setNewScreenName] = useState("");

  const features = useSidebarStore((s) => s.features);
  const order = useSidebarStore((s) => s.order);
  const customScreensState = useSidebarStore((s) => s.customScreens);
  const reorder = useSidebarStore((s) => s.reorder);
  const togglePinned = useSidebarStore((s) => s.togglePinned);
  const toggleEnabled = useSidebarStore((s) => s.toggleEnabled);
  const addCustomScreenToStore = useSidebarStore((s) => s.addCustomScreen);
  const removeCustomScreenFromStore = useSidebarStore((s) => s.removeCustomScreen);
  const setCustomScreenState = useSidebarStore((s) => s.setCustomScreenState);

  const { data: customScreens = [] } = useQuery({
    queryKey: ["custom-screens"],
    queryFn: () => api.getCustomScreens(),
  });

  const createScreen = useMutation({
    mutationFn: (data: { name: string; icon?: string }) => api.createCustomScreen(data),
    onSuccess: (screen) => {
      queryClient.invalidateQueries({ queryKey: ["custom-screens"] });
      addCustomScreenToStore(screen.id);
      setShowAddModal(false);
      setNewScreenName("");
      navigate(`/screen/${screen.slug}/edit`);
    },
  });

  const deleteScreen = useMutation({
    mutationFn: (id: string) => api.deleteCustomScreen(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["custom-screens"] });
      removeCustomScreenFromStore(id);
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Build the combined ordered list of screen items
  const customScreensMap = new Map(customScreens.map((s) => [s.id, s]));

  // Ensure order includes all built-in features (fill gaps)
  const effectiveOrder = [...order];
  for (const f of SIDEBAR_FEATURES) {
    if (!effectiveOrder.includes(f)) effectiveOrder.push(f);
  }
  // Add custom screens not in order
  for (const cs of customScreens) {
    if (!effectiveOrder.includes(cs.id)) effectiveOrder.push(cs.id);
  }

  const screenItems: ScreenItem[] = effectiveOrder
    .map((key): ScreenItem | null => {
      const builtin = BUILTIN_INFO[key];
      if (builtin) {
        return { id: key, label: builtin.label, iconName: builtin.iconName, isCustom: false };
      }
      const cs = customScreensMap.get(key);
      if (cs) {
        return { id: cs.id, label: cs.name, iconName: cs.icon, isCustom: true, customScreen: cs };
      }
      return null;
    })
    .filter((x): x is ScreenItem => x !== null);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = effectiveOrder.indexOf(String(active.id));
    const newIndex = effectiveOrder.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(effectiveOrder, oldIndex, newIndex);
    reorder(newOrder);
  };

  const getState = (item: ScreenItem): { pinned: boolean; enabled: boolean } => {
    if (item.isCustom) {
      const state = customScreensState[item.id];
      return { pinned: state?.pinned ?? true, enabled: state?.enabled ?? true };
    }
    const state = features[item.id as SidebarFeature];
    return { pinned: state?.pinned ?? true, enabled: state?.enabled ?? true };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <PanelLeft className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">Screens</h2>
          <p className="text-sm text-muted-foreground">
            Drag to reorder, pin to sidebar, or add custom screens with the layout builder.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Screen
        </Button>
      </div>

      <Card className="border-primary/40">
        <CardContent className="p-3">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={screenItems.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1.5">
                {screenItems.map((item) => {
                  const state = getState(item);
                  return (
                    <SortableScreenItem
                      key={item.id}
                      item={item}
                      isPinned={state.pinned}
                      isEnabled={state.enabled}
                      onTogglePin={() => {
                        if (item.isCustom) {
                          setCustomScreenState(item.id, { pinned: !state.pinned });
                        } else {
                          togglePinned(item.id as SidebarFeature);
                        }
                      }}
                      onToggleEnable={() => {
                        if (item.isCustom) {
                          setCustomScreenState(item.id, { enabled: !state.enabled });
                        } else {
                          toggleEnabled(item.id as SidebarFeature);
                        }
                      }}
                      onEdit={
                        item.isCustom && item.customScreen
                          ? () => navigate(`/screen/${item.customScreen!.slug}/edit`)
                          : undefined
                      }
                      onDelete={
                        item.isCustom
                          ? () => {
                              if (confirm(`Delete "${item.label}"?`)) {
                                deleteScreen.mutate(item.id);
                              }
                            }
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        </CardContent>
      </Card>

      {/* Add Screen Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold mb-4">New Custom Screen</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Screen Name</label>
                <input
                  type="text"
                  value={newScreenName}
                  onChange={(e) => setNewScreenName(e.target.value)}
                  placeholder="e.g., My Dashboard"
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newScreenName.trim()) {
                      createScreen.mutate({ name: newScreenName.trim() });
                    }
                  }}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowAddModal(false);
                    setNewScreenName("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={!newScreenName.trim() || createScreen.isPending}
                  onClick={() => createScreen.mutate({ name: newScreenName.trim() })}
                >
                  {createScreen.isPending ? "Creating..." : "Create & Edit"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
