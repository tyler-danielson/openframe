import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Eye, Grid3X3, Settings, Monitor, X, Play, Square, Send, Check, Plus, Link2, Copy, CheckCircle } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../components/ui/Button";
import { BuilderCanvas } from "../components/builder/BuilderCanvas";
import { AddBlockModal } from "../components/builder/AddBlockModal";
import { EditBlockModal } from "../components/builder/EditBlockModal";
import { BlockLayersPanel } from "../components/builder/BlockLayersPanel";
import { BuilderProvider } from "../contexts/BuilderContext";
import { useScreensaverStore, ASPECT_RATIO_PRESETS, GRID_PRESETS, DEFAULT_LAYOUT_CONFIG, type CanvasSizeMode, type AspectRatioPreset, type ScreensaverLayoutConfig, type BuilderWidgetType } from "../stores/screensaver";
import { WIDGET_REGISTRY } from "../lib/widgets/registry";
import { api } from "../services/api";

export function ScreensaverBuilderPage() {
  const [searchParams] = useSearchParams();
  const kioskId = searchParams.get("kioskId");
  const isKioskMode = !!kioskId;
  const queryClient = useQueryClient();

  const [showGrid, setShowGrid] = useState(true);
  const [liveMode, setLiveMode] = useState(true); // Live data in editor canvas
  const [previewMode, setPreviewMode] = useState(false); // Full-screen preview
  const [showExitHint, setShowExitHint] = useState(true);
  const [pushStatus, setPushStatus] = useState<"idle" | "pushing" | "success">("idle");
  const [showAddBlockModal, setShowAddBlockModal] = useState(false);
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  const [showKioskUrlModal, setShowKioskUrlModal] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  // Local state for kiosk mode
  const [localLayoutConfig, setLocalLayoutConfig] = useState<ScreensaverLayoutConfig>(DEFAULT_LAYOUT_CONFIG);
  const localLayoutConfigRef = useRef<ScreensaverLayoutConfig>(DEFAULT_LAYOUT_CONFIG);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Global store for user-global mode
  const { layoutConfig: storeLayoutConfig, setLayoutConfig: setStoreLayoutConfig, saveToServer } = useScreensaverStore();

  // Fetch kiosk data when in kiosk mode
  const { data: kiosk, isLoading: isLoadingKiosk } = useQuery({
    queryKey: ["kiosk", kioskId],
    queryFn: () => api.getKiosk(kioskId!),
    enabled: isKioskMode,
  });

  // Fetch server info for kiosk URL (to get server IP)
  const { data: serverInfo } = useQuery({
    queryKey: ["server-info"],
    queryFn: () => api.getServerInfo(),
    enabled: showKioskUrlModal && isKioskMode,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Generate kiosk URL using server IP if available
  const getKioskUrl = () => {
    if (!kiosk?.token) return "";
    const serverIp = serverInfo?.addresses?.[0];
    if (serverIp) {
      const port = window.location.port || (window.location.protocol === "https:" ? "443" : "80");
      const protocol = window.location.protocol;
      return `${protocol}//${serverIp}:${port}/kiosk/${kiosk.token}`;
    }
    return `${window.location.origin}/kiosk/${kiosk.token}`;
  };

  // Initialize local state from kiosk data
  useEffect(() => {
    if (isKioskMode && kiosk) {
      const kioskLayoutConfig = kiosk.screensaverLayoutConfig as ScreensaverLayoutConfig | null;
      const config = kioskLayoutConfig && Array.isArray(kioskLayoutConfig.widgets)
        ? { ...DEFAULT_LAYOUT_CONFIG, ...kioskLayoutConfig }
        : { ...DEFAULT_LAYOUT_CONFIG };
      setLocalLayoutConfig(config);
      localLayoutConfigRef.current = config;
    }
  }, [isKioskMode, kiosk]);

  // Auto-save kiosk config with debounce
  useEffect(() => {
    if (!isKioskMode || !kioskId || isLoadingKiosk) return;

    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce save by 1 second
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await api.updateKiosk(kioskId, {
          screensaverLayoutConfig: localLayoutConfigRef.current as unknown as Record<string, unknown>,
        });
        console.log("[KioskBuilder] Auto-saved config");
      } catch (error) {
        console.error("[KioskBuilder] Failed to auto-save:", error);
      }
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [isKioskMode, kioskId, isLoadingKiosk, localLayoutConfig]);

  // Use local state in kiosk mode, store in global mode
  const layoutConfig = isKioskMode ? localLayoutConfig : storeLayoutConfig;

  // Unified setLayoutConfig that works in both modes (for footer controls)
  const setLayoutConfig = (config: Partial<ScreensaverLayoutConfig>) => {
    if (isKioskMode) {
      const newConfig = { ...localLayoutConfig, ...config };
      setLocalLayoutConfig(newConfig);
      localLayoutConfigRef.current = newConfig;
    } else {
      setStoreLayoutConfig(config);
    }
  };

  // Callback for BuilderProvider (kiosk mode)
  const handleKioskConfigChange = useCallback((newConfig: ScreensaverLayoutConfig) => {
    setLocalLayoutConfig(newConfig);
    localLayoutConfigRef.current = newConfig;
  }, []);

  // Save handler that works in both modes
  const handleSave = async () => {
    if (isKioskMode && kioskId) {
      await api.updateKiosk(kioskId, {
        screensaverLayoutConfig: localLayoutConfigRef.current as unknown as Record<string, unknown>,
      });
      queryClient.invalidateQueries({ queryKey: ["kiosk", kioskId] });
    } else {
      await saveToServer();
    }
  };

  const handlePushToKiosk = async () => {
    setPushStatus("pushing");
    try {
      // Ensure latest config is saved first
      await handleSave();
      // Then trigger kiosk refresh
      if (isKioskMode && kioskId) {
        await api.refreshKioskById(kioskId);
      } else {
        await api.refreshKiosk();
      }
      setPushStatus("success");
      setTimeout(() => setPushStatus("idle"), 2000);
    } catch (error) {
      console.error("Failed to push to kiosk:", error);
      setPushStatus("idle");
    }
  };

  // Handle escape key to exit preview mode
  useEffect(() => {
    if (!previewMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPreviewMode(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewMode]);

  // Hide exit hint after a few seconds
  useEffect(() => {
    if (!previewMode) {
      setShowExitHint(true);
      return;
    }

    const timer = setTimeout(() => setShowExitHint(false), 3000);
    return () => clearTimeout(timer);
  }, [previewMode]);

  // Render the preview overlay
  const renderPreviewOverlay = () => (
    <div
      className="fixed inset-0 z-50 bg-black"
      onMouseMove={() => setShowExitHint(true)}
    >
      {/* Live preview canvas */}
      <BuilderCanvas showGrid={false} previewMode={true} />

      {/* Exit button - shows on hover/mouse move */}
      <div
        className={`absolute top-4 right-4 transition-opacity duration-300 ${
          showExitHint ? "opacity-100" : "opacity-0"
        }`}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPreviewMode(false)}
          className="bg-black/50 border-white/20 text-white hover:bg-black/70 hover:text-white"
        >
          <X className="mr-2 h-4 w-4" />
          Exit Preview
        </Button>
      </div>

      {/* Exit hint */}
      <div
        className={`absolute bottom-4 left-1/2 -translate-x-1/2 transition-opacity duration-300 ${
          showExitHint ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="px-4 py-2 bg-black/60 rounded-lg text-white/70 text-sm">
          Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white">Esc</kbd> or click Exit to return to editor
        </div>
      </div>
    </div>
  );

  // Handler for adding widgets from modal
  const handleAddWidgetFromModal = useCallback((type: BuilderWidgetType) => {
    const definition = WIDGET_REGISTRY[type];

    // Scale widget size based on current grid density relative to base 16x9 grid
    // This ensures widgets maintain a reasonable visual size regardless of grid fineness
    const baseColumns = 16;
    const baseRows = 9;
    const scaleX = layoutConfig.gridColumns / baseColumns;
    const scaleY = layoutConfig.gridRows / baseRows;

    const scaledWidth = Math.max(1, Math.round(definition.defaultSize.width * scaleX));
    const scaledHeight = Math.max(1, Math.round(definition.defaultSize.height * scaleY));

    if (isKioskMode) {
      // In kiosk mode, we need to update local state directly
      const newWidget = {
        id: `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        x: 0,
        y: 0,
        width: scaledWidth,
        height: scaledHeight,
        config: { ...definition.defaultConfig },
      };
      const newConfig = {
        ...localLayoutConfig,
        widgets: [...(localLayoutConfig.widgets || []), newWidget],
      };
      setLocalLayoutConfig(newConfig);
      localLayoutConfigRef.current = newConfig;
    } else {
      // In global mode, use the store's addWidget action
      useScreensaverStore.getState().addWidget({
        type,
        x: 0,
        y: 0,
        width: scaledWidth,
        height: scaledHeight,
        config: { ...definition.defaultConfig },
      });
    }
  }, [isKioskMode, localLayoutConfig, layoutConfig.gridColumns, layoutConfig.gridRows]);

  // Render the main builder UI
  const renderBuilderUI = () => (
    <div className="flex h-screen flex-col bg-background">
      {/* Header - compact */}
      <header className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <div className="flex items-center gap-3">
          <Link to={isKioskMode ? "/settings?tab=kiosks" : "/settings"} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-sm font-medium">
            {isKioskMode ? (isLoadingKiosk ? "Loading..." : kiosk?.name || "Screensaver") : "Screensaver Builder"}
          </h1>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Add Block button */}
          <Button
            variant="default"
            size="sm"
            onClick={() => setShowAddBlockModal(true)}
            className="h-7 px-2.5 text-xs"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Block
          </Button>
          {/* Get Kiosk URL button - only in kiosk mode */}
          {isKioskMode && kiosk?.token && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowKioskUrlModal(true)}
              className="h-7 px-2.5 text-xs"
            >
              <Link2 className="mr-1.5 h-3.5 w-3.5" />
              Get URL
            </Button>
          )}
          <div className="w-px h-5 bg-border" />
          <Button
            variant={showGrid ? "default" : "outline"}
            size="sm"
            onClick={() => setShowGrid(!showGrid)}
            className="h-7 w-7 p-0"
            title="Toggle Grid"
          >
            <Grid3X3 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={liveMode ? "default" : "outline"}
            size="sm"
            onClick={() => setLiveMode(!liveMode)}
            className="h-7 w-7 p-0"
            title={liveMode ? "Show placeholders" : "Show live widget data"}
          >
            {liveMode ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </Button>
          <div className="w-px h-5 bg-border" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPreviewMode(true)}
            className="h-7 w-7 p-0"
            title="Fullscreen Preview"
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <div className="w-px h-5 bg-border" />
          <Button
            variant={pushStatus === "success" ? "default" : "outline"}
            size="sm"
            onClick={handlePushToKiosk}
            disabled={pushStatus === "pushing"}
            className={`h-7 px-2.5 text-xs ${pushStatus === "success" ? "bg-green-600 hover:bg-green-700" : ""}`}
          >
            {pushStatus === "pushing" ? (
              <>
                <Send className="mr-1.5 h-3.5 w-3.5 animate-pulse" />
                Pushing...
              </>
            ) : pushStatus === "success" ? (
              <>
                <Check className="mr-1.5 h-3.5 w-3.5" />
                Pushed!
              </>
            ) : (
              <>
                <Send className="mr-1.5 h-3.5 w-3.5" />
                Push
              </>
            )}
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Center - Builder Canvas (now takes more space) */}
        <main className="flex-1 overflow-hidden p-2">
          <BuilderCanvas
            showGrid={showGrid}
            previewMode={false}
            liveMode={liveMode}
            onWidgetDoubleClick={(widgetId) => setEditingWidgetId(widgetId)}
          />
        </main>

        {/* Right sidebar - Block Layers Panel */}
        <BlockLayersPanel
          onEditWidget={(widgetId) => setEditingWidgetId(widgetId)}
          onEnterPreview={() => setPreviewMode(true)}
        />
      </div>

      {/* Footer - Layout settings (compact) */}
      <footer className="border-t border-border px-3 py-1.5 bg-muted/30">
          <div className="flex items-center gap-4 text-xs flex-wrap">
            {/* Canvas Size */}
            <div className="flex items-center gap-1.5">
              <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={layoutConfig.canvasSizeMode}
                onChange={(e) => setLayoutConfig({ canvasSizeMode: e.target.value as CanvasSizeMode })}
                className="rounded border border-border bg-background px-1.5 py-0.5 text-xs"
              >
                <option value="fill">Fill</option>
                <option value="aspectRatio">Ratio</option>
                <option value="pixels">Pixels</option>
              </select>
              {layoutConfig.canvasSizeMode === "aspectRatio" && (
                <select
                  value={layoutConfig.aspectRatio}
                  onChange={(e) => {
                    const preset = ASPECT_RATIO_PRESETS.find(p => p.id === e.target.value);
                    if (preset && preset.id !== "custom") {
                      const width = 1920;
                      const height = Math.round(width / preset.ratio);
                      setLayoutConfig({
                        aspectRatio: e.target.value as AspectRatioPreset,
                        canvasWidth: width,
                        canvasHeight: height
                      });
                    } else {
                      setLayoutConfig({ aspectRatio: e.target.value as AspectRatioPreset });
                    }
                  }}
                  className="rounded border border-border bg-background px-1.5 py-0.5 text-xs"
                >
                  {ASPECT_RATIO_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              )}
              {(layoutConfig.canvasSizeMode === "pixels" ||
                (layoutConfig.canvasSizeMode === "aspectRatio" && layoutConfig.aspectRatio === "custom")) && (
                <>
                  <select
                    value={`${layoutConfig.canvasWidth}x${layoutConfig.canvasHeight}`}
                    onChange={(e) => {
                      if (e.target.value === "custom") return;
                      const [w, h] = e.target.value.split("x").map(Number);
                      setLayoutConfig({ canvasWidth: w, canvasHeight: h });
                    }}
                    className="rounded border border-border bg-background px-1.5 py-0.5 text-xs"
                  >
                    <option value="1920x1080">1080p (1920×1080)</option>
                    <option value="2560x1440">1440p (2560×1440)</option>
                    <option value="3840x2160">4K (3840×2160)</option>
                    <option value="1280x720">720p (1280×720)</option>
                    <option value="1024x768">XGA (1024×768)</option>
                    <option value="1280x800">WXGA (1280×800)</option>
                    <option value="1366x768">HD (1366×768)</option>
                    <option value="2560x1080">UW 1080p (2560×1080)</option>
                    <option value="3440x1440">UW 1440p (3440×1440)</option>
                    <option value="1080x1920">Portrait 1080p</option>
                    <option value="1440x2560">Portrait 1440p</option>
                    {![
                      "1920x1080", "2560x1440", "3840x2160", "1280x720", "1024x768",
                      "1280x800", "1366x768", "2560x1080", "3440x1440", "1080x1920", "1440x2560"
                    ].includes(`${layoutConfig.canvasWidth}x${layoutConfig.canvasHeight}`) && (
                      <option value={`${layoutConfig.canvasWidth}x${layoutConfig.canvasHeight}`}>
                        Custom ({layoutConfig.canvasWidth}×{layoutConfig.canvasHeight})
                      </option>
                    )}
                  </select>
                  <input
                    type="number"
                    value={layoutConfig.canvasWidth}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setLayoutConfig({ canvasWidth: isNaN(val) ? 0 : val });
                    }}
                    onBlur={(e) => {
                      const val = parseInt(e.target.value) || 1920;
                      setLayoutConfig({ canvasWidth: Math.max(320, Math.min(7680, val)) });
                    }}
                    className="w-14 rounded border border-border bg-background px-1.5 py-0.5 text-center text-xs"
                    min={320}
                    max={7680}
                  />
                  <span className="text-muted-foreground">×</span>
                  <input
                    type="number"
                    value={layoutConfig.canvasHeight}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setLayoutConfig({ canvasHeight: isNaN(val) ? 0 : val });
                    }}
                    onBlur={(e) => {
                      const val = parseInt(e.target.value) || 1080;
                      setLayoutConfig({ canvasHeight: Math.max(240, Math.min(4320, val)) });
                    }}
                    className="w-14 rounded border border-border bg-background px-1.5 py-0.5 text-center text-xs"
                    min={240}
                    max={4320}
                  />
                </>
              )}
            </div>

            <div className="h-3.5 border-l border-border" />

            {/* Grid Settings */}
            <div className="flex items-center gap-1.5">
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Grid:</span>
              <select
                value={`${layoutConfig.gridColumns}x${layoutConfig.gridRows}`}
                onChange={(e) => {
                  const preset = GRID_PRESETS.find(p => `${p.columns}x${p.rows}` === e.target.value);
                  if (preset) {
                    const oldColumns = layoutConfig.gridColumns;
                    const oldRows = layoutConfig.gridRows;
                    const newColumns = preset.columns;
                    const newRows = preset.rows;

                    // Scale widget positions proportionally to maintain visual locations
                    const scaleX = newColumns / oldColumns;
                    const scaleY = newRows / oldRows;

                    const scaledWidgets = (layoutConfig.widgets || []).map(widget => ({
                      ...widget,
                      x: Math.round(widget.x * scaleX),
                      y: Math.round(widget.y * scaleY),
                      width: Math.max(1, Math.round(widget.width * scaleX)),
                      height: Math.max(1, Math.round(widget.height * scaleY)),
                    }));

                    setLayoutConfig({
                      gridColumns: newColumns,
                      gridRows: newRows,
                      widgets: scaledWidgets,
                    });
                  }
                }}
                className="rounded border border-border bg-background px-1.5 py-0.5 text-xs"
              >
                {GRID_PRESETS.map((preset) => (
                  <option key={preset.id} value={`${preset.columns}x${preset.rows}`}>
                    {preset.label} ({preset.description})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Gap:</span>
              <input
                type="number"
                value={layoutConfig.gridGap}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setLayoutConfig({ gridGap: Math.max(0, Math.min(32, isNaN(val) ? 0 : val)) });
                }}
                className="w-11 rounded border border-border bg-background px-1.5 py-0.5 text-center text-xs"
                min={0}
                max={32}
              />
              <span className="text-xs text-muted-foreground">px</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Background:</span>
              <input
                type="color"
                value={layoutConfig.backgroundColor}
                onChange={(e) => setLayoutConfig({ backgroundColor: e.target.value })}
                className="h-5 w-8 cursor-pointer rounded border border-border"
              />
            </div>
          </div>
        </footer>

      {/* Add Block Modal */}
      <AddBlockModal
        isOpen={showAddBlockModal}
        onClose={() => setShowAddBlockModal(false)}
        onAddWidget={handleAddWidgetFromModal}
      />

      {/* Edit Block Modal */}
      {editingWidgetId && (
        <EditBlockModal
          isOpen={!!editingWidgetId}
          onClose={() => setEditingWidgetId(null)}
          widgetId={editingWidgetId}
        />
      )}

      {/* Kiosk URL Modal */}
      {showKioskUrlModal && kiosk?.token && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="relative w-full max-w-lg rounded-lg bg-card border border-border shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border p-4">
              <h2 className="text-lg font-semibold">Kiosk URL</h2>
              <button
                onClick={() => {
                  setShowKioskUrlModal(false);
                  setUrlCopied(false);
                }}
                className="rounded-md p-1 hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4">
              <p className="text-sm text-muted-foreground mb-3">
                Use this URL to access the kiosk on any device:
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={getKioskUrl()}
                  className="flex-1 rounded-md border border-border bg-muted px-3 py-2 text-sm font-mono"
                  onFocus={(e) => e.target.select()}
                />
                <Button
                  variant={urlCopied ? "default" : "outline"}
                  size="sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(getKioskUrl());
                    setUrlCopied(true);
                    setTimeout(() => setUrlCopied(false), 2000);
                  }}
                  className={`px-3 ${urlCopied ? "bg-green-600 hover:bg-green-700" : ""}`}
                >
                  {urlCopied ? (
                    <>
                      <CheckCircle className="mr-1.5 h-4 w-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1.5 h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              {serverInfo?.addresses && serverInfo.addresses.length > 1 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Other available IPs: {serverInfo.addresses.slice(1).join(", ")}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end border-t border-border p-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowKioskUrlModal(false);
                  setUrlCopied(false);
                }}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // In kiosk mode, wrap with BuilderProvider
  // In global mode, the components use the store directly
  if (isKioskMode) {
    // Show loading state while fetching kiosk data
    if (isLoadingKiosk) {
      return (
        <div className="flex h-screen items-center justify-center bg-background">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading kiosk...</p>
          </div>
        </div>
      );
    }

    return (
      <BuilderProvider
        initialConfig={localLayoutConfig}
        onConfigChange={handleKioskConfigChange}
      >
        {previewMode ? renderPreviewOverlay() : renderBuilderUI()}
      </BuilderProvider>
    );
  }

  // Global mode - use store directly (no provider needed)
  return previewMode ? renderPreviewOverlay() : renderBuilderUI();
}
