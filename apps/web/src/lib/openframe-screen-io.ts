/**
 * OpenFrame custom screen export/import
 *
 * Exports a custom screen's layout config as a portable .ofscreen JSON file.
 * Imports .ofscreen files to create new custom screens.
 */

import type { ScreensaverLayoutConfig } from "../stores/screensaver";
import { DEFAULT_LAYOUT_CONFIG } from "../stores/screensaver";

// ── Export format ───────────────────────────────────────────

interface OpenFrameScreenExport {
  format: "openframe-screen";
  version: 1;
  exportedAt: string;
  screen: {
    name: string;
    layoutConfig: ScreensaverLayoutConfig;
  };
}

// ── Export ───────────────────────────────────────────────────

export function exportCustomScreen(
  name: string,
  layoutConfig: ScreensaverLayoutConfig
): string {
  const data: OpenFrameScreenExport = {
    format: "openframe-screen",
    version: 1,
    exportedAt: new Date().toISOString(),
    screen: { name, layoutConfig },
  };
  return JSON.stringify(data, null, 2);
}

export function downloadScreenExport(name: string, layoutConfig: ScreensaverLayoutConfig) {
  const json = exportCustomScreen(name, layoutConfig);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-").toLowerCase()}.ofscreen`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Import ──────────────────────────────────────────────────

export interface OpenFrameImportResult {
  name: string;
  layoutConfig: ScreensaverLayoutConfig;
  stats: {
    widgetCount: number;
    exportedAt: string;
  };
}

export function parseOpenFrameScreen(fileContent: string): OpenFrameImportResult {
  const data: OpenFrameScreenExport = JSON.parse(fileContent);

  if (data.format !== "openframe-screen") {
    throw new Error("Invalid file: not an OpenFrame screen export");
  }

  if (!data.screen?.layoutConfig?.widgets) {
    throw new Error("Invalid file: missing layout configuration");
  }

  const layoutConfig: ScreensaverLayoutConfig = {
    ...DEFAULT_LAYOUT_CONFIG,
    ...data.screen.layoutConfig,
  };

  return {
    name: data.screen.name || "Imported Screen",
    layoutConfig,
    stats: {
      widgetCount: layoutConfig.widgets.length,
      exportedAt: data.exportedAt || "unknown",
    },
  };
}
