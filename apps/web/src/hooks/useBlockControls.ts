import { useEffect } from "react";
import { useBlockNavStore, type TVBlockControls } from "../stores/block-nav";

/**
 * Hook for widgets to register their TV remote controls.
 * Pass null to unregister controls.
 */
export function useBlockControls(widgetId: string | undefined, controls: TVBlockControls | null) {
  const updateBlockControls = useBlockNavStore((s) => s.updateBlockControls);

  useEffect(() => {
    if (!widgetId) return;
    updateBlockControls(widgetId, controls);
    return () => {
      updateBlockControls(widgetId, null);
    };
    // We serialize the actions array keys to detect structural changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetId, controls?.actions.map((a) => a.key).join(","), updateBlockControls]);
}
