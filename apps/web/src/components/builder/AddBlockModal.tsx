import { useState, useMemo } from "react";
import {
  X,
  Search,
  Clock,
  Timer,
  Cloud,
  CloudSun,
  Calendar,
  CalendarClock,
  CalendarDays,
  CheckSquare,
  Trophy,
  Music,
  Zap,
  Gauge,
  LineChart,
  Camera,
  Map,
  Type,
  Image,
  Images,
  Shapes,
  Maximize,
  Newspaper,
} from "lucide-react";
import { cn } from "../../lib/utils";
import {
  WIDGET_CATEGORIES,
  WIDGET_REGISTRY,
  getWidgetsByCategory,
} from "../../lib/widgets/registry";
import { type BuilderWidgetType } from "../../stores/screensaver";

interface AddBlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddWidget: (type: BuilderWidgetType) => void;
}

const ICON_MAP: Record<string, React.ElementType> = {
  Clock,
  Timer,
  Cloud,
  CloudSun,
  Calendar,
  CalendarClock,
  CalendarDays,
  CheckSquare,
  Trophy,
  Music,
  Zap,
  Gauge,
  LineChart,
  Camera,
  Map,
  Type,
  Image,
  Images,
  Shapes,
  Maximize,
  Newspaper,
};

export function AddBlockModal({ isOpen, onClose, onAddWidget }: AddBlockModalProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Get all widget types
  const allWidgetTypes = useMemo(
    () => Object.keys(WIDGET_REGISTRY) as BuilderWidgetType[],
    []
  );

  // Filter widgets based on search and category
  const filteredWidgets = useMemo(() => {
    let widgets = selectedCategory
      ? getWidgetsByCategory(selectedCategory)
      : allWidgetTypes;

    if (search) {
      const searchLower = search.toLowerCase();
      widgets = widgets.filter((type) => {
        const def = WIDGET_REGISTRY[type];
        return (
          def.name.toLowerCase().includes(searchLower) ||
          type.toLowerCase().includes(searchLower) ||
          def.category.toLowerCase().includes(searchLower)
        );
      });
    }

    return widgets;
  }, [allWidgetTypes, selectedCategory, search]);

  // Group widgets by category for display
  const groupedWidgets = useMemo(() => {
    const groups: Record<string, BuilderWidgetType[]> = {};
    for (const widget of filteredWidgets) {
      const category = WIDGET_REGISTRY[widget].category;
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(widget);
    }
    return groups;
  }, [filteredWidgets]);

  const handleAddWidget = (type: BuilderWidgetType) => {
    onAddWidget(type);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative flex h-[70vh] w-full max-w-4xl flex-col rounded-lg bg-card border border-border shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h2 className="text-lg font-semibold">Add Block</h2>
            <p className="text-sm text-muted-foreground">
              Select a widget to add to your screensaver
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
              placeholder="Search widgets..."
              className="w-full rounded-md border border-border bg-background pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Category sidebar */}
          <div className="w-48 border-r border-border overflow-y-auto bg-muted/30">
            <div className="p-2 space-y-1">
              <button
                onClick={() => setSelectedCategory(null)}
                className={cn(
                  "w-full rounded-md px-3 py-2 text-left text-sm transition-colors flex items-center gap-2",
                  selectedCategory === null
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-muted"
                )}
              >
                <Shapes className="h-4 w-4" />
                All ({allWidgetTypes.length})
              </button>
              {WIDGET_CATEGORIES.map((category) => {
                const Icon = ICON_MAP[category.icon] || Shapes;
                const count = getWidgetsByCategory(category.id).length;
                return (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={cn(
                      "w-full rounded-md px-3 py-2 text-left text-sm transition-colors flex items-center gap-2",
                      selectedCategory === category.id
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {category.name} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Widget grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {filteredWidgets.length === 0 ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                No widgets found
              </div>
            ) : selectedCategory ? (
              // Single category view - grid
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {filteredWidgets.map((widgetType) => {
                  const def = WIDGET_REGISTRY[widgetType];
                  const Icon = ICON_MAP[def.icon] || Shapes;
                  return (
                    <button
                      key={widgetType}
                      onClick={() => handleAddWidget(widgetType)}
                      className={cn(
                        "flex flex-col items-center gap-2 p-4 rounded-lg border border-border",
                        "bg-muted/30 hover:bg-muted hover:border-primary/50 transition-all",
                        "text-center group"
                      )}
                    >
                      <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <span className="text-sm font-medium">{def.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {def.defaultSize.width}x{def.defaultSize.height}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              // All categories view - grouped
              <div className="space-y-6">
                {WIDGET_CATEGORIES.map((category) => {
                  const widgets = groupedWidgets[category.id];
                  if (!widgets || widgets.length === 0) return null;
                  const CategoryIcon = ICON_MAP[category.icon] || Shapes;

                  return (
                    <div key={category.id}>
                      <div className="flex items-center gap-2 mb-3">
                        <CategoryIcon className="h-4 w-4 text-primary" />
                        <h3 className="font-medium">{category.name}</h3>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {widgets.map((widgetType) => {
                          const def = WIDGET_REGISTRY[widgetType];
                          const Icon = ICON_MAP[def.icon] || Shapes;
                          return (
                            <button
                              key={widgetType}
                              onClick={() => handleAddWidget(widgetType)}
                              className={cn(
                                "flex flex-col items-center gap-2 p-4 rounded-lg border border-border",
                                "bg-muted/30 hover:bg-muted hover:border-primary/50 transition-all",
                                "text-center group"
                              )}
                            >
                              <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                                <Icon className="h-6 w-6 text-primary" />
                              </div>
                              <span className="text-sm font-medium">{def.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {def.defaultSize.width}x{def.defaultSize.height}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border p-4 bg-muted/30 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
