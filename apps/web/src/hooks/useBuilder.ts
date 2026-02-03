import { useOptionalBuilderContext } from "../contexts/BuilderContext";
import { useScreensaverStore } from "../stores/screensaver";

/**
 * Hook that provides builder state and actions.
 * Uses BuilderContext if available (for kiosk-specific editing),
 * otherwise falls back to the global screensaver store.
 */
export function useBuilder() {
  const context = useOptionalBuilderContext();
  const store = useScreensaverStore();

  // If context is available, use it; otherwise use the store
  if (context) {
    return context;
  }

  // Return store values in the same shape as context
  return {
    layoutConfig: store.layoutConfig,
    selectedWidgetId: store.selectedWidgetId,
    gridSnap: store.gridSnap,
    setLayoutConfig: store.setLayoutConfig,
    addWidget: store.addWidget,
    updateBuilderWidget: store.updateBuilderWidget,
    removeWidget: store.removeWidget,
    moveWidget: store.moveWidget,
    resizeWidget: store.resizeWidget,
    selectWidget: store.selectWidget,
    duplicateWidget: store.duplicateWidget,
    bringWidgetForward: store.bringWidgetForward,
    sendWidgetBackward: store.sendWidgetBackward,
    bringWidgetToFront: store.bringWidgetToFront,
    sendWidgetToBack: store.sendWidgetToBack,
    toggleWidgetVisibility: store.toggleWidgetVisibility,
    setGridSnap: store.setGridSnap,
  };
}
