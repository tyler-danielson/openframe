export interface DevicePreset {
  id: string;
  name: string;
  description: string;
  widthPx: number;
  heightPx: number;
  aspectRatio: number;
  recommendedGridColumns: number;
  recommendedGridRows: number;
  defaultOrientation: "portrait" | "landscape";
}

export const DEVICE_PRESETS: Record<string, DevicePreset> = {
  remarkable2: {
    id: "remarkable2",
    name: "reMarkable 2",
    description: "10.3\" e-ink tablet (1404x1872)",
    widthPx: 1404,
    heightPx: 1872,
    aspectRatio: 0.75,
    recommendedGridColumns: 12,
    recommendedGridRows: 12,
    defaultOrientation: "portrait",
  },
  "kindle-scribe": {
    id: "kindle-scribe",
    name: "Kindle Scribe",
    description: "10.2\" e-ink tablet (1860x2480)",
    widthPx: 1860,
    heightPx: 2480,
    aspectRatio: 0.75,
    recommendedGridColumns: 12,
    recommendedGridRows: 12,
    defaultOrientation: "portrait",
  },
  letter: {
    id: "letter",
    name: "US Letter",
    description: "8.5\" x 11\" paper",
    widthPx: 2550, // 8.5" at 300dpi
    heightPx: 3300, // 11" at 300dpi
    aspectRatio: 0.773,
    recommendedGridColumns: 12,
    recommendedGridRows: 12,
    defaultOrientation: "portrait",
  },
  a4: {
    id: "a4",
    name: "A4 Paper",
    description: "210mm x 297mm",
    widthPx: 2480, // 210mm at 300dpi
    heightPx: 3508, // 297mm at 300dpi
    aspectRatio: 0.707,
    recommendedGridColumns: 12,
    recommendedGridRows: 12,
    defaultOrientation: "portrait",
  },
};

export function getPresetById(id: string): DevicePreset | undefined {
  return DEVICE_PRESETS[id];
}

export function getPresetList(): DevicePreset[] {
  return Object.values(DEVICE_PRESETS);
}
