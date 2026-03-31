import { useState, useMemo } from "react";
import {
  X,
  Search,
  Star,
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
  Heart,
  Tv,
  Youtube,
  Play,
  BookOpen,
  LayoutGrid,
  StickyNote,
  Mountain,
  Building2,
  Orbit,
  Landmark,
  Sofa,
  Waves,
  Flower2,
  TrendingUp,
  ArrowRightLeft,
  AlertTriangle,
  Wind,
} from "lucide-react";
import { cn } from "../../lib/utils";
import {
  WIDGET_CATEGORIES,
  WIDGET_REGISTRY,
  WIDGET_PRESETS,
  getWidgetsByCategory,
} from "../../lib/widgets/registry";
import type { WidgetPreset } from "../../lib/widgets/registry";
import { type BuilderWidgetType } from "../../stores/screensaver";
import { useModuleStore } from "../../stores/modules";

interface AddBlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddWidget: (type: BuilderWidgetType, configOverrides?: Record<string, unknown>) => void;
}

const ICON_MAP: Record<string, React.ElementType> = {
  Clock, Timer, Cloud, CloudSun, Calendar, CalendarClock, CalendarDays,
  CheckSquare, Trophy, Music, Zap, Gauge, LineChart, Camera, Map,
  Type, Image, Images, Shapes, Maximize, Newspaper, Heart, Tv,
  Youtube, Play, BookOpen, LayoutGrid, StickyNote, Star,
  Mountain, Building2, Orbit, Landmark, Sofa, Waves, Flower2,
  TrendingUp, ArrowRightLeft, AlertTriangle, Wind,
};

// Popular widget types shown first
const POPULAR_TYPES: BuilderWidgetType[] = [
  "clock", "weather", "calendar", "up-next", "photo-album", "forecast",
  "week-schedule", "tasks", "text",
];

export function AddBlockModal({ isOpen, onClose, onAddWidget }: AddBlockModalProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>("popular");
  const isModuleEnabled = useModuleStore((s) => s.isEnabled);

  const allWidgetTypes = useMemo(
    () => (Object.keys(WIDGET_REGISTRY) as BuilderWidgetType[]).filter((type) => {
      const def = WIDGET_REGISTRY[type];
      return !def.moduleId || isModuleEnabled(def.moduleId);
    }),
    [isModuleEnabled]
  );

  // Get presets for a category
  const getPresetsForCategory = (categoryId: string) =>
    WIDGET_PRESETS.filter((p) => p.category === categoryId);

  // Filter widgets and presets by search
  const { filteredWidgets, filteredPresets } = useMemo(() => {
    let widgets: BuilderWidgetType[];
    let presets: WidgetPreset[] = [];

    if (selectedCategory === "popular") {
      widgets = POPULAR_TYPES.filter((t) => allWidgetTypes.includes(t));
    } else if (selectedCategory) {
      widgets = getWidgetsByCategory(selectedCategory, isModuleEnabled);
      presets = getPresetsForCategory(selectedCategory);
    } else {
      widgets = allWidgetTypes;
      presets = WIDGET_PRESETS;
    }

    if (search) {
      const s = search.toLowerCase();
      widgets = widgets.filter((type) => {
        const def = WIDGET_REGISTRY[type];
        return (
          def.name.toLowerCase().includes(s) ||
          (def.description || "").toLowerCase().includes(s) ||
          type.toLowerCase().includes(s)
        );
      });
      presets = presets.filter((p) =>
        p.name.toLowerCase().includes(s) || p.description.toLowerCase().includes(s)
      );
    }

    return { filteredWidgets: widgets, filteredPresets: presets };
  }, [allWidgetTypes, selectedCategory, search, isModuleEnabled]);

  // Group for "all" view
  const groupedWidgets = useMemo(() => {
    const groups: Record<string, BuilderWidgetType[]> = {};
    for (const widget of filteredWidgets) {
      const category = WIDGET_REGISTRY[widget].category;
      if (!groups[category]) groups[category] = [];
      groups[category].push(widget);
    }
    return groups;
  }, [filteredWidgets]);

  const handleAddWidget = (type: BuilderWidgetType, configOverrides?: Record<string, unknown>) => {
    onAddWidget(type, configOverrides);
    onClose();
  };

  const handleAddPreset = (preset: WidgetPreset) => {
    onAddWidget(preset.widgetType, preset.configOverrides);
    onClose();
  };

  if (!isOpen) return null;

  const renderWidgetCard = (widgetType: BuilderWidgetType) => {
    const def = WIDGET_REGISTRY[widgetType];
    const Icon = ICON_MAP[def.icon] || Shapes;
    return (
      <button
        key={widgetType}
        onClick={() => handleAddWidget(widgetType)}
        className={cn(
          "flex items-start gap-3 p-3 rounded-lg border border-border",
          "bg-card hover:bg-muted hover:border-primary/50 transition-all",
          "text-left group w-full"
        )}
      >
        <div className="p-2.5 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium">{def.name}</div>
          {def.description && (
            <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{def.description}</div>
          )}
        </div>
      </button>
    );
  };

  const renderPresetCard = (preset: WidgetPreset) => {
    const Icon = ICON_MAP[preset.icon] || Shapes;
    return (
      <button
        key={preset.id}
        onClick={() => handleAddPreset(preset)}
        className={cn(
          "flex items-start gap-3 p-3 rounded-lg border border-border",
          "bg-card hover:bg-muted hover:border-primary/50 transition-all",
          "text-left group w-full"
        )}
      >
        <div className="p-2.5 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium">{preset.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{preset.description}</div>
        </div>
      </button>
    );
  };

  const photosCount = getWidgetsByCategory("photos", isModuleEnabled).length + getPresetsForCategory("photos").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative flex h-[75vh] w-full max-w-4xl flex-col rounded-xl bg-card border border-border shadow-xl overflow-hidden">
        {/* Header with search */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <h2 className="text-lg font-semibold whitespace-nowrap">Add a Block</h2>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelectedCategory(null); }}
              placeholder="Search blocks ..."
              className="w-full rounded-md border border-border bg-background pl-9 pr-8 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-muted transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Category sidebar */}
          <div className="w-52 border-r border-border overflow-y-auto bg-muted/20">
            <div className="p-2 space-y-0.5">
              {/* Popular */}
              <button
                onClick={() => { setSelectedCategory("popular"); setSearch(""); }}
                className={cn(
                  "w-full rounded-md px-3 py-2 text-left text-sm transition-colors flex items-center gap-2",
                  selectedCategory === "popular"
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-foreground hover:bg-muted"
                )}
              >
                <Star className="h-4 w-4" />
                Popular
              </button>

              {/* All categories */}
              {WIDGET_CATEGORIES.map((category) => {
                const Icon = ICON_MAP[category.icon] || Shapes;
                const widgetCount = getWidgetsByCategory(category.id, isModuleEnabled).length;
                const presetCount = getPresetsForCategory(category.id).length;
                const total = widgetCount + presetCount;
                if (total === 0) return null;
                return (
                  <button
                    key={category.id}
                    onClick={() => { setSelectedCategory(category.id); setSearch(""); }}
                    className={cn(
                      "w-full rounded-md px-3 py-2 text-left text-sm transition-colors flex items-center gap-2",
                      selectedCategory === category.id
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {category.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Widget grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {filteredWidgets.length === 0 && filteredPresets.length === 0 ? (
              <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                No blocks found{search ? ` for "${search}"` : ""}
              </div>
            ) : selectedCategory === "popular" ? (
              /* Popular view */
              <div className="grid grid-cols-2 gap-2">
                {filteredWidgets.map(renderWidgetCard)}
              </div>
            ) : selectedCategory ? (
              /* Single category view */
              <div className="grid grid-cols-2 gap-2">
                {filteredWidgets.map(renderWidgetCard)}
                {filteredPresets.map(renderPresetCard)}
              </div>
            ) : (
              /* All / search results grouped */
              <div className="space-y-5">
                {/* Presets first if searching */}
                {filteredPresets.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Image className="h-4 w-4 text-primary" />
                      <h3 className="font-medium text-sm">Photo Presets</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {filteredPresets.map(renderPresetCard)}
                    </div>
                  </div>
                )}
                {WIDGET_CATEGORIES.map((category) => {
                  const widgets = groupedWidgets[category.id];
                  if (!widgets || widgets.length === 0) return null;
                  const CategoryIcon = ICON_MAP[category.icon] || Shapes;
                  return (
                    <div key={category.id}>
                      <div className="flex items-center gap-2 mb-2">
                        <CategoryIcon className="h-4 w-4 text-primary" />
                        <h3 className="font-medium text-sm">{category.name}</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {widgets.map(renderWidgetCard)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
