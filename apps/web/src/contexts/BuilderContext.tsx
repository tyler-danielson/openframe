import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import {
  type ScreensaverLayoutConfig,
  type WidgetInstance,
  DEFAULT_LAYOUT_CONFIG,
} from "../stores/screensaver";

interface BuilderContextValue {
  layoutConfig: ScreensaverLayoutConfig;
  selectedWidgetId: string | null;
  gridSnap: boolean;
  setLayoutConfig: (config: Partial<ScreensaverLayoutConfig>) => void;
  addWidget: (widget: Omit<WidgetInstance, "id">) => string;
  updateBuilderWidget: (id: string, updates: Partial<Omit<WidgetInstance, "id">>) => void;
  removeWidget: (id: string) => void;
  moveWidget: (id: string, x: number, y: number) => void;
  resizeWidget: (id: string, width: number, height: number) => void;
  selectWidget: (id: string | null) => void;
  duplicateWidget: (id: string) => string | null;
  bringWidgetForward: (id: string) => void;
  sendWidgetBackward: (id: string) => void;
  bringWidgetToFront: (id: string) => void;
  sendWidgetToBack: (id: string) => void;
  toggleWidgetVisibility: (id: string) => void;
  setGridSnap: (snap: boolean) => void;
}

const BuilderContext = createContext<BuilderContextValue | null>(null);

interface BuilderProviderProps {
  children: ReactNode;
  initialConfig?: ScreensaverLayoutConfig;
  onConfigChange?: (config: ScreensaverLayoutConfig) => void;
}

export function BuilderProvider({
  children,
  initialConfig = DEFAULT_LAYOUT_CONFIG,
  onConfigChange,
}: BuilderProviderProps) {
  const [layoutConfig, setLayoutConfigInternal] = useState<ScreensaverLayoutConfig>(initialConfig);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [gridSnap, setGridSnapInternal] = useState(true);

  // Sync internal state when initialConfig changes (e.g., from footer controls)
  useEffect(() => {
    setLayoutConfigInternal(initialConfig);
  }, [initialConfig]);

  const setLayoutConfig = useCallback(
    (config: Partial<ScreensaverLayoutConfig>) => {
      setLayoutConfigInternal((prev) => {
        const next = { ...prev, ...config };
        onConfigChange?.(next);
        return next;
      });
    },
    [onConfigChange]
  );

  const addWidget = useCallback(
    (widget: Omit<WidgetInstance, "id">) => {
      const id = `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newWidget: WidgetInstance = { ...widget, id };
      setLayoutConfigInternal((prev) => {
        const next = {
          ...prev,
          widgets: [...(prev.widgets || []), newWidget],
        };
        onConfigChange?.(next);
        return next;
      });
      setSelectedWidgetId(id);
      return id;
    },
    [onConfigChange]
  );

  const updateBuilderWidget = useCallback(
    (id: string, updates: Partial<Omit<WidgetInstance, "id">>) => {
      setLayoutConfigInternal((prev) => {
        const widgets = (prev.widgets || []).map((w) =>
          w.id === id ? { ...w, ...updates } : w
        );
        const next = { ...prev, widgets };
        onConfigChange?.(next);
        return next;
      });
    },
    [onConfigChange]
  );

  const removeWidget = useCallback(
    (id: string) => {
      setLayoutConfigInternal((prev) => {
        const widgets = (prev.widgets || []).filter((w) => w.id !== id);
        const next = { ...prev, widgets };
        onConfigChange?.(next);
        return next;
      });
      setSelectedWidgetId((prev) => (prev === id ? null : prev));
    },
    [onConfigChange]
  );

  const moveWidget = useCallback(
    (id: string, x: number, y: number) => {
      setLayoutConfigInternal((prev) => {
        const widgets = (prev.widgets || []).map((w) =>
          w.id === id ? { ...w, x, y } : w
        );
        const next = { ...prev, widgets };
        onConfigChange?.(next);
        return next;
      });
    },
    [onConfigChange]
  );

  const resizeWidget = useCallback(
    (id: string, width: number, height: number) => {
      setLayoutConfigInternal((prev) => {
        const widgets = (prev.widgets || []).map((w) =>
          w.id === id ? { ...w, width, height } : w
        );
        const next = { ...prev, widgets };
        onConfigChange?.(next);
        return next;
      });
    },
    [onConfigChange]
  );

  const selectWidget = useCallback((id: string | null) => {
    setSelectedWidgetId(id);
  }, []);

  const duplicateWidget = useCallback(
    (id: string) => {
      let newId: string | null = null;
      setLayoutConfigInternal((prev) => {
        const widgets = prev.widgets || [];
        const widget = widgets.find((w) => w.id === id);
        if (!widget) return prev;
        newId = `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const gridColumns = prev.gridColumns || 12;
        const gridRows = prev.gridRows || 8;
        const newWidget: WidgetInstance = {
          ...widget,
          id: newId,
          x: Math.min(widget.x + 1, gridColumns - widget.width),
          y: Math.min(widget.y + 1, gridRows - widget.height),
        };
        const next = { ...prev, widgets: [...widgets, newWidget] };
        onConfigChange?.(next);
        return next;
      });
      if (newId) setSelectedWidgetId(newId);
      return newId;
    },
    [onConfigChange]
  );

  const bringWidgetForward = useCallback(
    (id: string) => {
      setLayoutConfigInternal((prev) => {
        const widgets = [...(prev.widgets || [])];
        const index = widgets.findIndex((w) => w.id === id);
        if (index === -1 || index === widgets.length - 1) return prev;
        const current = widgets[index];
        const next = widgets[index + 1];
        if (current && next) {
          widgets[index] = next;
          widgets[index + 1] = current;
        }
        const result = { ...prev, widgets };
        onConfigChange?.(result);
        return result;
      });
    },
    [onConfigChange]
  );

  const sendWidgetBackward = useCallback(
    (id: string) => {
      setLayoutConfigInternal((prev) => {
        const widgets = [...(prev.widgets || [])];
        const index = widgets.findIndex((w) => w.id === id);
        if (index <= 0) return prev;
        const current = widgets[index];
        const prevWidget = widgets[index - 1];
        if (current && prevWidget) {
          widgets[index] = prevWidget;
          widgets[index - 1] = current;
        }
        const result = { ...prev, widgets };
        onConfigChange?.(result);
        return result;
      });
    },
    [onConfigChange]
  );

  const bringWidgetToFront = useCallback(
    (id: string) => {
      setLayoutConfigInternal((prev) => {
        const widgets = (prev.widgets || []).filter((w) => w.id !== id);
        const widget = (prev.widgets || []).find((w) => w.id === id);
        if (!widget) return prev;
        const result = { ...prev, widgets: [...widgets, widget] };
        onConfigChange?.(result);
        return result;
      });
    },
    [onConfigChange]
  );

  const sendWidgetToBack = useCallback(
    (id: string) => {
      setLayoutConfigInternal((prev) => {
        const widgets = (prev.widgets || []).filter((w) => w.id !== id);
        const widget = (prev.widgets || []).find((w) => w.id === id);
        if (!widget) return prev;
        const result = { ...prev, widgets: [widget, ...widgets] };
        onConfigChange?.(result);
        return result;
      });
    },
    [onConfigChange]
  );

  const toggleWidgetVisibility = useCallback(
    (id: string) => {
      setLayoutConfigInternal((prev) => {
        const widgets = (prev.widgets || []).map((w) =>
          w.id === id ? { ...w, hidden: !w.hidden } : w
        );
        const result = { ...prev, widgets };
        onConfigChange?.(result);
        return result;
      });
    },
    [onConfigChange]
  );

  const setGridSnap = useCallback((snap: boolean) => {
    setGridSnapInternal(snap);
  }, []);

  const value: BuilderContextValue = {
    layoutConfig,
    selectedWidgetId,
    gridSnap,
    setLayoutConfig,
    addWidget,
    updateBuilderWidget,
    removeWidget,
    moveWidget,
    resizeWidget,
    selectWidget,
    duplicateWidget,
    bringWidgetForward,
    sendWidgetBackward,
    bringWidgetToFront,
    sendWidgetToBack,
    toggleWidgetVisibility,
    setGridSnap,
  };

  return (
    <BuilderContext.Provider value={value}>{children}</BuilderContext.Provider>
  );
}

export function useBuilderContext() {
  const context = useContext(BuilderContext);
  if (!context) {
    throw new Error("useBuilderContext must be used within a BuilderProvider");
  }
  return context;
}

export function useOptionalBuilderContext() {
  return useContext(BuilderContext);
}
