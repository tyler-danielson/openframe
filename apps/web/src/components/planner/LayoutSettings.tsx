import { Monitor, Smartphone } from "lucide-react";
import type { PlannerLayoutConfig } from "@openframe/shared";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/Select";
import { Button } from "../ui/Button";
import { DEVICE_PRESETS, getPresetById } from "../../lib/planner/device-presets";

interface LayoutSettingsProps {
  layoutConfig: PlannerLayoutConfig;
  onUpdateConfig: (updates: Partial<PlannerLayoutConfig>) => void;
}

export function LayoutSettings({ layoutConfig, onUpdateConfig }: LayoutSettingsProps) {
  const currentPreset = getPresetById(layoutConfig.pageSize);

  const handleDeviceChange = (presetId: string) => {
    const preset = getPresetById(presetId);
    if (preset) {
      onUpdateConfig({
        pageSize: presetId,
        gridColumns: preset.recommendedGridColumns,
        gridRows: preset.recommendedGridRows,
        orientation: preset.defaultOrientation,
      });
    }
  };

  const handleOrientationChange = (orientation: "portrait" | "landscape") => {
    onUpdateConfig({ orientation });
  };

  const handleGridChange = (field: "gridColumns" | "gridRows", value: number) => {
    onUpdateConfig({ [field]: Math.max(1, Math.min(24, value)) });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium mb-4">Page Settings</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Configure the target device and layout for your planner pages.
        </p>
      </div>

      {/* Device Preset */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Target Device</label>
        <Select value={layoutConfig.pageSize} onValueChange={handleDeviceChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a device" />
          </SelectTrigger>
          <SelectContent>
            {Object.values(DEVICE_PRESETS).map((preset) => (
              <SelectItem key={preset.id} value={preset.id}>
                <div className="flex flex-col">
                  <span>{preset.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {currentPreset && (
          <p className="text-xs text-muted-foreground">{currentPreset.description}</p>
        )}
      </div>

      {/* Orientation */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Orientation</label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={layoutConfig.orientation === "portrait" ? "default" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => handleOrientationChange("portrait")}
          >
            <Smartphone className="h-4 w-4 mr-2" />
            Portrait
          </Button>
          <Button
            type="button"
            variant={layoutConfig.orientation === "landscape" ? "default" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => handleOrientationChange("landscape")}
          >
            <Monitor className="h-4 w-4 mr-2" />
            Landscape
          </Button>
        </div>
      </div>

      {/* Grid Size */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Grid Size</label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Columns</label>
            <input
              type="number"
              value={layoutConfig.gridColumns}
              onChange={(e) => handleGridChange("gridColumns", parseInt(e.target.value) || 12)}
              min={1}
              max={24}
              className="w-full px-2 py-1.5 border border-border rounded-md bg-background text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Rows</label>
            <input
              type="number"
              value={layoutConfig.gridRows}
              onChange={(e) => handleGridChange("gridRows", parseInt(e.target.value) || 12)}
              min={1}
              max={24}
              className="w-full px-2 py-1.5 border border-border rounded-md bg-background text-sm"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Adjusting grid size affects widget placement precision.
        </p>
      </div>

      {/* Quick info */}
      <div className="pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground">
          Select a widget on the canvas to configure its properties, or drag widgets from the palette to add them.
        </p>
      </div>
    </div>
  );
}
