import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../services/api";
import { cn } from "../../../lib/utils";
import { useHAWebSocket, useHALocations as useHALocationsWS, useHAZones as useHAZonesWS } from "../../../stores/homeassistant-ws";
import {
  Search,
  MapPin,
  Home,
  User,
  X,
  ChevronRight,
  Loader2,
} from "lucide-react";
import type { WidgetConfigProps } from "./types";

export function HAMapConfig({
  config,
  onChange,
}: WidgetConfigProps) {
  const selectedDevices = (config.selectedDevices as string[]) ?? [];
  const selectedZones = (config.selectedZones as string[]) ?? [];
  const deviceIcons = (config.deviceIcons as Record<string, string>) ?? {};
  const [showDevicePicker, setShowDevicePicker] = useState(false);
  const [showZonePicker, setShowZonePicker] = useState(false);
  const [zoneSearch, setZoneSearch] = useState("");
  const [deviceSearch, setDeviceSearch] = useState("");
  const [iconPickerFor, setIconPickerFor] = useState<string | null>(null);

  // Fetch available location entities
  const { locations: wsLocations, connected: wsConnected } = useHALocationsWS();
  const wsZones = useHAZonesWS();
  const wsConnecting = useHAWebSocket((s) => s.connecting);

  const { data: restLocations = [] } = useQuery({
    queryKey: ["ha-locations-rest-config"],
    queryFn: () => api.getHomeAssistantLocations(),
    enabled: !wsConnected && !wsConnecting,
    staleTime: 60 * 1000,
  });

  const { data: restZones = [] } = useQuery({
    queryKey: ["ha-zones-rest-config"],
    queryFn: () => api.getHomeAssistantZones(),
    enabled: !wsConnected && !wsConnecting,
    staleTime: 60 * 1000,
  });

  const availableDevices = wsConnected && wsLocations.length > 0
    ? wsLocations
    : restLocations;

  const availableZones = wsConnected && wsZones.length > 0
    ? wsZones
    : restZones;

  const filteredDevices = useMemo(() => {
    if (!deviceSearch.trim()) return availableDevices;
    const q = deviceSearch.toLowerCase();
    return availableDevices.filter(
      (d) => d.name.toLowerCase().includes(q) || d.entityId.toLowerCase().includes(q),
    );
  }, [availableDevices, deviceSearch]);

  const filteredZones = useMemo(() => {
    if (!zoneSearch.trim()) return availableZones;
    const q = zoneSearch.toLowerCase();
    return availableZones.filter(
      (z) => z.name.toLowerCase().includes(q) || z.entityId.toLowerCase().includes(q),
    );
  }, [availableZones, zoneSearch]);

  const toggleDevice = useCallback((entityId: string) => {
    const current = (config.selectedDevices as string[]) ?? [];
    if (current.includes(entityId)) {
      onChange("selectedDevices", current.filter((id: string) => id !== entityId));
    } else {
      onChange("selectedDevices", [...current, entityId]);
    }
  }, [config.selectedDevices, onChange]);

  const toggleZone = useCallback((entityId: string) => {
    const current = (config.selectedZones as string[]) ?? [];
    if (current.includes(entityId)) {
      onChange("selectedZones", current.filter((id: string) => id !== entityId));
    } else {
      onChange("selectedZones", [...current, entityId]);
    }
  }, [config.selectedZones, onChange]);

  const PERSON_EMOJIS = [
    "\u{1F468}", "\u{1F469}", "\u{1F9D1}", "\u{1F466}", "\u{1F467}", "\u{1F476}", "\u{1F9D3}",
    "\u{1F697}", "\u{1F699}", "\u{1F3CD}", "\u{1F6B2}", "\u{1F6F4}", "\u{1F68E}", "\u2708\uFE0F",
    "\u{1F3C3}", "\u{1F6B6}", "\u{1F415}", "\u{1F408}", "\u2B50", "\u2764\uFE0F", "\u{1F4BC}",
    "\u{1F3EB}", "\u{1F3E2}", "\u{1F3AF}", "\u{1F4CD}", "\u{1F535}", "\u{1F7E2}", "\u{1F7E1}",
  ];

  const setDeviceIcon = useCallback((entityId: string, emoji: string | null) => {
    const current = { ...deviceIcons };
    if (emoji) {
      current[entityId] = emoji;
    } else {
      delete current[entityId];
    }
    onChange("deviceIcons", current);
  }, [deviceIcons, onChange]);

  // Device names summary
  const deviceSummary = selectedDevices.length === 0
    ? "All devices"
    : selectedDevices.length === 1
      ? availableDevices.find((d) => d.entityId === selectedDevices[0])?.name ?? "1 device"
      : `${selectedDevices.length} devices`;

  // Zone names summary
  const zoneSummary = selectedZones.length === 0
    ? "None"
    : selectedZones.length === 1
      ? availableZones.find((z) => z.entityId === selectedZones[0])?.name ?? "1 zone"
      : `${selectedZones.length} zones`;

  return (
    <>
      <label className="flex items-center justify-between">
        <span className="text-sm">Show Device Names</span>
        <input
          type="checkbox"
          checked={config.showDeviceNames as boolean ?? true}
          onChange={(e) => onChange("showDeviceNames", e.target.checked)}
          className="rounded"
        />
      </label>
      <label className="flex items-center justify-between">
        <span className="text-sm">Dark Mode</span>
        <input
          type="checkbox"
          checked={config.darkMode as boolean ?? true}
          onChange={(e) => onChange("darkMode", e.target.checked)}
          className="rounded"
        />
      </label>
      <label className="flex items-center justify-between">
        <span className="text-sm">Auto Fit Bounds</span>
        <input
          type="checkbox"
          checked={config.autoFitBounds as boolean ?? true}
          onChange={(e) => onChange("autoFitBounds", e.target.checked)}
          className="rounded"
        />
      </label>
      <label className="flex items-center justify-between">
        <span className="text-sm">Show Last Updated</span>
        <input
          type="checkbox"
          checked={config.showLastUpdated as boolean ?? false}
          onChange={(e) => onChange("showLastUpdated", e.target.checked)}
          className="rounded"
        />
      </label>
      <label className="flex items-center justify-between">
        <div>
          <span className="text-sm">Show ETA to Home</span>
          <p className="text-xs text-muted-foreground">Driving time for away devices</p>
        </div>
        <input
          type="checkbox"
          checked={config.showEta as boolean ?? false}
          onChange={(e) => onChange("showEta", e.target.checked)}
          className="rounded"
        />
      </label>

      {/* People on Map - trigger button */}
      <div className="pt-2 border-t border-border">
        <button
          type="button"
          onClick={() => { setShowDevicePicker(true); setDeviceSearch(""); }}
          className="w-full flex items-center justify-between p-2.5 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <User className="h-4 w-4 text-primary" />
            <div className="text-left">
              <span className="text-sm font-medium block">People on Map</span>
              <span className="text-xs text-muted-foreground">{deviceSummary}</span>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Zones on Map - trigger button */}
      <div>
        <button
          type="button"
          onClick={() => { setShowZonePicker(true); setZoneSearch(""); }}
          className="w-full flex items-center justify-between p-2.5 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <MapPin className="h-4 w-4 text-primary" />
            <div className="text-left">
              <span className="text-sm font-medium block">Zones on Map</span>
              <span className="text-xs text-muted-foreground">{zoneSummary}</span>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Device picker popup */}
      {showDevicePicker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={() => setShowDevicePicker(false)}>
          <div
            className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm mx-4 max-h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-sm font-semibold">People on Map</h3>
              <div className="flex items-center gap-2">
                {selectedDevices.length > 0 && (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => onChange("selectedDevices", [])}
                  >
                    Show all
                  </button>
                )}
                <button type="button" onClick={() => setShowDevicePicker(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            {availableDevices.length > 4 && (
              <div className="px-4 pt-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={deviceSearch}
                    onChange={(e) => setDeviceSearch(e.target.value)}
                    placeholder="Search people..."
                    className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
                    autoFocus
                  />
                </div>
              </div>
            )}
            <div className="p-3 flex-1 overflow-y-auto">
              <p className="text-xs text-muted-foreground mb-2 px-1">
                {selectedDevices.length === 0
                  ? "All people visible. Uncheck to hide."
                  : `${selectedDevices.length} of ${availableDevices.length} selected`}
              </p>
              {wsConnecting && availableDevices.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Connecting...</span>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {filteredDevices.map((device) => {
                    const isSelected = selectedDevices.length === 0 || selectedDevices.includes(device.entityId);
                    const currentIcon = deviceIcons[device.entityId];
                    const showingIconPicker = iconPickerFor === device.entityId;
                    return (
                      <div key={device.entityId}>
                        <label
                          className={cn(
                            "flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors",
                            isSelected ? "bg-primary/10" : "hover:bg-muted/50 opacity-50",
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              if (selectedDevices.length === 0) {
                                const allExcept = availableDevices
                                  .map((d) => d.entityId)
                                  .filter((id) => id !== device.entityId);
                                onChange("selectedDevices", allExcept);
                              } else {
                                toggleDevice(device.entityId);
                              }
                            }}
                            className="rounded"
                          />
                          {currentIcon ? (
                            <span className="text-lg leading-none w-6 h-6 flex items-center justify-center shrink-0">{currentIcon}</span>
                          ) : device.entityPictureUrl ? (
                            <img src={device.entityPictureUrl} alt={device.name} className="w-6 h-6 rounded-full object-cover shrink-0" />
                          ) : (
                            <User className="h-5 w-5 text-muted-foreground shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <span className="text-sm block truncate">{device.name}</span>
                            <span className="text-[10px] text-muted-foreground block truncate">{device.entityId}</span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setIconPickerFor(showingIconPicker ? null : device.entityId);
                            }}
                            className={cn(
                              "shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-xs transition-colors",
                              currentIcon
                                ? "bg-primary/10 hover:bg-primary/20"
                                : "bg-muted/50 hover:bg-muted text-muted-foreground",
                            )}
                            title="Change icon"
                          >
                            {currentIcon || "\u{1F600}"}
                          </button>
                        </label>
                        {showingIconPicker && (
                          <div className="ml-8 mr-2 mb-1 p-2 rounded-lg bg-muted/30 border border-border">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Map Icon</span>
                              {currentIcon && (
                                <button
                                  type="button"
                                  className="text-[10px] text-destructive hover:underline"
                                  onClick={() => { setDeviceIcon(device.entityId, null); setIconPickerFor(null); }}
                                >
                                  Reset
                                </button>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {PERSON_EMOJIS.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => { setDeviceIcon(device.entityId, emoji); setIconPickerFor(null); }}
                                  className={cn(
                                    "w-8 h-8 rounded-md flex items-center justify-center text-base hover:bg-primary/10 transition-colors",
                                    currentIcon === emoji && "bg-primary/20 ring-1 ring-primary/50",
                                  )}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {filteredDevices.length === 0 && deviceSearch && (
                    <p className="text-xs text-muted-foreground py-3 text-center">No match for &quot;{deviceSearch}&quot;</p>
                  )}
                </div>
              )}
            </div>
            <div className="p-3 border-t border-border">
              <button
                type="button"
                onClick={() => setShowDevicePicker(false)}
                className="w-full py-1.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zone picker popup */}
      {showZonePicker && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={() => setShowZonePicker(false)}>
          <div
            className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-sm mx-4 max-h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-sm font-semibold">Zones on Map</h3>
              <div className="flex items-center gap-2">
                {selectedZones.length > 0 && (
                  <button
                    type="button"
                    className="text-xs text-destructive hover:underline"
                    onClick={() => onChange("selectedZones", [])}
                  >
                    Clear all
                  </button>
                )}
                <button type="button" onClick={() => setShowZonePicker(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="px-4 pt-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={zoneSearch}
                  onChange={(e) => setZoneSearch(e.target.value)}
                  placeholder="Search zones..."
                  className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
                  autoFocus
                />
              </div>
            </div>
            <div className="p-3 flex-1 overflow-y-auto">
              <p className="text-xs text-muted-foreground mb-2 px-1">
                {selectedZones.length === 0
                  ? "No zones shown. Check zones to add them."
                  : `${selectedZones.length} zone${selectedZones.length === 1 ? "" : "s"} on map`}
              </p>
              {wsConnecting && availableZones.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Connecting...</span>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {filteredZones.map((zone) => {
                    const isHome = zone.entityId === "zone.home";
                    const isSelected = selectedZones.includes(zone.entityId);
                    return (
                      <label
                        key={zone.entityId}
                        className={cn(
                          "flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors",
                          isSelected ? "bg-primary/10" : "hover:bg-muted/50",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleZone(zone.entityId)}
                          className="rounded"
                        />
                        <div className={cn(
                          "w-6 h-6 rounded-md flex items-center justify-center shrink-0",
                          isHome ? "bg-green-500/20" : "bg-indigo-500/20",
                        )}>
                          {isHome ? (
                            <Home className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <MapPin className="h-3.5 w-3.5 text-indigo-400" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-sm block truncate">{zone.name}</span>
                          <span className="text-[10px] text-muted-foreground block truncate">{zone.entityId}</span>
                        </div>
                      </label>
                    );
                  })}
                  {filteredZones.length === 0 && zoneSearch && (
                    <p className="text-xs text-muted-foreground py-3 text-center">No match for &quot;{zoneSearch}&quot;</p>
                  )}
                  {availableZones.length === 0 && !wsConnecting && (
                    <p className="text-xs text-muted-foreground py-3 text-center">No zones found in Home Assistant</p>
                  )}
                </div>
              )}
            </div>
            <div className="p-3 border-t border-border">
              <button
                type="button"
                onClick={() => setShowZonePicker(false)}
                className="w-full py-1.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
