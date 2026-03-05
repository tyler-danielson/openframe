import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye, Grid3X3, Save, Check } from "lucide-react";
import { Button } from "../components/ui/Button";
import { BuilderCanvas } from "../components/builder/BuilderCanvas";
import { AddBlockModal } from "../components/builder/AddBlockModal";
import { EditBlockModal } from "../components/builder/EditBlockModal";
import { BlockLayersPanel } from "../components/builder/BlockLayersPanel";
import { BuilderProvider, useBuilderContext } from "../contexts/BuilderContext";
import { WIDGET_REGISTRY } from "../lib/widgets/registry";
import { type ScreensaverLayoutConfig, type BuilderWidgetType, DEFAULT_LAYOUT_CONFIG } from "../stores/screensaver";
import { api } from "../services/api";

/** Inner component that can use useBuilderContext (inside BuilderProvider) */
function BuilderInner({
  showGrid,
  liveMode,
  showAddBlockModal,
  setShowAddBlockModal,
  editingWidgetId,
  setEditingWidgetId,
  layoutConfig,
}: {
  showGrid: boolean;
  liveMode: boolean;
  showAddBlockModal: boolean;
  setShowAddBlockModal: (v: boolean) => void;
  editingWidgetId: string | null;
  setEditingWidgetId: (id: string | null) => void;
  layoutConfig: ScreensaverLayoutConfig;
}) {
  const { addWidget } = useBuilderContext();

  const handleAddWidget = useCallback((type: BuilderWidgetType) => {
    const definition = WIDGET_REGISTRY[type];
    const baseColumns = 16;
    const baseRows = 9;
    const scaleX = layoutConfig.gridColumns / baseColumns;
    const scaleY = layoutConfig.gridRows / baseRows;
    const scaledWidth = Math.max(1, Math.round(definition.defaultSize.width * scaleX));
    const scaledHeight = Math.max(1, Math.round(definition.defaultSize.height * scaleY));

    addWidget({
      type,
      x: 0,
      y: 0,
      width: scaledWidth,
      height: scaledHeight,
      config: { ...definition.defaultConfig },
    });
    setShowAddBlockModal(false);
  }, [addWidget, layoutConfig.gridColumns, layoutConfig.gridRows, setShowAddBlockModal]);

  return (
    <>
      <div className="flex h-full">
        <div className="flex-1 overflow-auto">
          <BuilderCanvas
            showGrid={showGrid}
            previewMode={false}
            liveMode={liveMode}
            onWidgetDoubleClick={(id) => setEditingWidgetId(id)}
          />
        </div>
        <BlockLayersPanel
          onEditWidget={(id) => setEditingWidgetId(id)}
          onEnterPreview={() => {}}
        />
      </div>
      <AddBlockModal
        isOpen={showAddBlockModal}
        onClose={() => setShowAddBlockModal(false)}
        onAddWidget={handleAddWidget}
      />
      {editingWidgetId && (
        <EditBlockModal
          isOpen={!!editingWidgetId}
          onClose={() => setEditingWidgetId(null)}
          widgetId={editingWidgetId}
        />
      )}
    </>
  );
}

export function CustomScreenBuilderPage() {
  const { slug, screenId } = useParams<{ slug?: string; screenId?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showGrid, setShowGrid] = useState(true);
  const [liveMode] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);
  const [showAddBlockModal, setShowAddBlockModal] = useState(false);
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  const [localLayoutConfig, setLocalLayoutConfig] = useState<ScreensaverLayoutConfig>(DEFAULT_LAYOUT_CONFIG);
  const localLayoutConfigRef = useRef<ScreensaverLayoutConfig>(DEFAULT_LAYOUT_CONFIG);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const screenIdRef = useRef<string | null>(null);

  // Support loading by screenId (settings route) or slug (direct route)
  const { data: screen, isLoading } = useQuery({
    queryKey: ["custom-screen", screenId || slug],
    queryFn: () => screenId ? api.getCustomScreen(screenId) : api.getCustomScreenBySlug(slug!),
    enabled: !!(screenId || slug),
  });

  // Initialize from screen data
  useEffect(() => {
    if (screen) {
      const config: ScreensaverLayoutConfig = {
        ...DEFAULT_LAYOUT_CONFIG,
        ...(screen.layoutConfig as Partial<ScreensaverLayoutConfig>),
      };
      setLocalLayoutConfig(config);
      localLayoutConfigRef.current = config;
      screenIdRef.current = screen.id;
      dirtyRef.current = false;
    }
  }, [screen]);

  // Debounced auto-save (only when dirty)
  useEffect(() => {
    if (!dirtyRef.current || !screenIdRef.current) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const currentScreenId = screenIdRef.current;
    saveTimeoutRef.current = setTimeout(async () => {
      if (!dirtyRef.current) return;
      try {
        setSaveStatus("saving");
        await api.updateCustomScreen(currentScreenId, {
          layoutConfig: localLayoutConfigRef.current as unknown as Record<string, unknown>,
        });
        dirtyRef.current = false;
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 1500);
      } catch (error) {
        console.error("Failed to auto-save custom screen:", error);
        setSaveStatus("idle");
      }
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [localLayoutConfig]);

  const handleConfigChange = useCallback((newConfig: ScreensaverLayoutConfig) => {
    dirtyRef.current = true;
    setLocalLayoutConfig(newConfig);
    localLayoutConfigRef.current = newConfig;
  }, []);

  // Escape to exit preview
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && previewMode) {
        setPreviewMode(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [previewMode]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!screen) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Screen not found</p>
      </div>
    );
  }

  if (previewMode) {
    return (
      <div className="fixed inset-0 z-[100] bg-black">
        <BuilderProvider initialConfig={localLayoutConfig}>
          <BuilderCanvas showGrid={false} previewMode={true} liveMode={true} />
        </BuilderProvider>
        <button
          onClick={() => setPreviewMode(false)}
          className="fixed top-4 right-4 z-[101] rounded-lg bg-black/70 px-3 py-1.5 text-sm text-white/70 hover:text-white"
        >
          Press ESC to exit
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(screenId ? "/settings/custom-screens" : `/screen/${slug}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <span className="text-sm font-medium">{screen.name}</span>
          {saveStatus === "saving" && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Save className="h-3 w-3 animate-pulse" /> Saving...
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="text-xs text-primary flex items-center gap-1">
              <Check className="h-3 w-3" /> Saved
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowGrid(!showGrid)}
            title="Toggle grid"
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPreviewMode(true)}
            title="Preview"
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Canvas + Panels */}
      <div className="flex-1 overflow-hidden">
        <BuilderProvider
          initialConfig={localLayoutConfig}
          onConfigChange={handleConfigChange}
        >
          <BuilderInner
            showGrid={showGrid}
            liveMode={liveMode}
            showAddBlockModal={showAddBlockModal}
            setShowAddBlockModal={setShowAddBlockModal}
            editingWidgetId={editingWidgetId}
            setEditingWidgetId={setEditingWidgetId}
            layoutConfig={localLayoutConfig}
          />
        </BuilderProvider>
      </div>
    </div>
  );
}
