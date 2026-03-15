import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from "react";
import {
  type ScreensaverLayoutConfig,
  type WidgetInstance,
  DEFAULT_LAYOUT_CONFIG,
} from "../stores/screensaver";

const MAX_HISTORY = 50;

export interface BuilderContextValue {
  layoutConfig: ScreensaverLayoutConfig;
  selectedWidgetId: string | null;
  gridSnap: boolean;
  canUndo: boolean;
  canRedo: boolean;
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
  undo: () => void;
  redo: () => void;
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

  // Undo/redo history
  const historyRef = useRef<ScreensaverLayoutConfig[]>([initialConfig]);
  const historyIndexRef = useRef(0);
  const isUndoRedoRef = useRef(false);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const pushHistory = useCallback((config: ScreensaverLayoutConfig) => {
    if (isUndoRedoRef.current) return;
    const history = historyRef.current;
    const index = historyIndexRef.current;
    // Truncate any redo states
    historyRef.current = history.slice(0, index + 1);
    historyRef.current.push(config);
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current = historyRef.current.slice(-MAX_HISTORY);
    }
    historyIndexRef.current = historyRef.current.length - 1;
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(false);
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    isUndoRedoRef.current = true;
    historyIndexRef.current--;
    const config = historyRef.current[historyIndexRef.current]!;
    setLayoutConfigInternal(config);
    onConfigChange?.(config);
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(true);
    isUndoRedoRef.current = false;
  }, [onConfigChange]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    isUndoRedoRef.current = true;
    historyIndexRef.current++;
    const config = historyRef.current[historyIndexRef.current]!;
    setLayoutConfigInternal(config);
    onConfigChange?.(config);
    setCanUndo(true);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
    isUndoRedoRef.current = false;
  }, [onConfigChange]);

  // Sync internal state when initialConfig changes (e.g., from footer controls)
  useEffect(() => {
    setLayoutConfigInternal(initialConfig);
  }, [initialConfig]);

  const setLayoutConfig = useCallback(
    (config: Partial<ScreensaverLayoutConfig>) => {
      setLayoutConfigInternal((prev) => {
        const next = { ...prev, ...config };
        pushHistory(next);
        onConfigChange?.(next);
        return next;
      });
    },
    [onConfigChange, pushHistory]
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
        pushHistory(next);
        onConfigChange?.(next);
        return next;
      });
      setSelectedWidgetId(id);
      return id;
    },
    [onConfigChange, pushHistory]
  );

  const updateBuilderWidget = useCallback(
    (id: string, updates: Partial<Omit<WidgetInstance, "id">>) => {
      setLayoutConfigInternal((prev) => {
        const widgets = (prev.widgets || []).map((w) =>
          w.id === id ? { ...w, ...updates } : w
        );
        const next = { ...prev, widgets };
        pushHistory(next);
        onConfigChange?.(next);
        return next;
      });
    },
    [onConfigChange, pushHistory]
  );

  const removeWidget = useCallback(
    (id: string) => {
      setLayoutConfigInternal((prev) => {
        const widgets = (prev.widgets || []).filter((w) => w.id !== id);
        const next = { ...prev, widgets };
        pushHistory(next);
        onConfigChange?.(next);
        return next;
      });
      setSelectedWidgetId((prev) => (prev === id ? null : prev));
    },
    [onConfigChange, pushHistory]
  );

  const moveWidget = useCallback(
    (id: string, x: number, y: number) => {
      setLayoutConfigInternal((prev) => {
        const widgets = (prev.widgets || []).map((w) =>
          w.id === id ? { ...w, x, y } : w
        );
        const next = { ...prev, widgets };
        pushHistory(next);
        onConfigChange?.(next);
        return next;
      });
    },
    [onConfigChange, pushHistory]
  );

  const resizeWidget = useCallback(
    (id: string, width: number, height: number) => {
      setLayoutConfigInternal((prev) => {
        const widgets = (prev.widgets || []).map((w) =>
          w.id === id ? { ...w, width, height } : w
        );
        const next = { ...prev, widgets };
        pushHistory(next);
        onConfigChange?.(next);
        return next;
      });
    },
    [onConfigChange, pushHistory]
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
        pushHistory(next);
        onConfigChange?.(next);
        return next;
      });
      if (newId) setSelectedWidgetId(newId);
      return newId;
    },
    [onConfigChange, pushHistory]
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
        pushHistory(result);
        onConfigChange?.(result);
        return result;
      });
    },
    [onConfigChange, pushHistory]
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
        pushHistory(result);
        onConfigChange?.(result);
        return result;
      });
    },
    [onConfigChange, pushHistory]
  );

  const bringWidgetToFront = useCallback(
    (id: string) => {
      setLayoutConfigInternal((prev) => {
        const widgets = (prev.widgets || []).filter((w) => w.id !== id);
        const widget = (prev.widgets || []).find((w) => w.id === id);
        if (!widget) return prev;
        const result = { ...prev, widgets: [...widgets, widget] };
        pushHistory(result);
        onConfigChange?.(result);
        return result;
      });
    },
    [onConfigChange, pushHistory]
  );

  const sendWidgetToBack = useCallback(
    (id: string) => {
      setLayoutConfigInternal((prev) => {
        const widgets = (prev.widgets || []).filter((w) => w.id !== id);
        const widget = (prev.widgets || []).find((w) => w.id === id);
        if (!widget) return prev;
        const result = { ...prev, widgets: [widget, ...widgets] };
        pushHistory(result);
        onConfigChange?.(result);
        return result;
      });
    },
    [onConfigChange, pushHistory]
  );

  const toggleWidgetVisibility = useCallback(
    (id: string) => {
      setLayoutConfigInternal((prev) => {
        const widgets = (prev.widgets || []).map((w) =>
          w.id === id ? { ...w, hidden: !w.hidden } : w
        );
        const result = { ...prev, widgets };
        pushHistory(result);
        onConfigChange?.(result);
        return result;
      });
    },
    [onConfigChange, pushHistory]
  );

  const setGridSnap = useCallback((snap: boolean) => {
    setGridSnapInternal(snap);
  }, []);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  const value: BuilderContextValue = {
    layoutConfig,
    selectedWidgetId,
    gridSnap,
    canUndo,
    canRedo,
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
    undo,
    redo,
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
