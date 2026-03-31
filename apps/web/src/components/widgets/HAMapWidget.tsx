import React, { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, User, Loader2, AlertTriangle, Home, Navigation } from "lucide-react";
import { api } from "../../services/api";
import { useHAWebSocket, useHALocations as useHALocationsWS, useHAZones as useHAZonesWS } from "../../stores/homeassistant-ws";
import type { WidgetStyle } from "../../stores/screensaver";
import { cn } from "../../lib/utils";

// Location type for both WS and REST data
interface Location {
  entityId: string;
  name: string;
  state: string;
  latitude: number;
  longitude: number;
  entityPictureUrl?: string;
  lastUpdated?: string;
}

interface Zone {
  entityId: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
}

interface HAMapWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
  widgetId?: string;
}

// Color palette for different people
const COLORS = ["#1E40AF", "#047857", "#B45309", "#B91C1C", "#5B21B6", "#9D174D"];

// Format a lastUpdated timestamp for display
function formatLastUpdated(lastUpdated: string): string {
  const date = new Date(lastUpdated);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

// Format ETA duration in seconds to human-readable
function formatEta(seconds: number): string {
  if (seconds < 60) return "<1 min";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainMin = minutes % 60;
  if (remainMin === 0) return `${hours}h`;
  return `${hours}h ${remainMin}m`;
}

// Fetch driving ETA from OSRM (free, no API key required)
async function fetchEta(
  fromLng: number, fromLat: number,
  toLng: number, toLat: number,
): Promise<{ duration: number; distance: number } | null> {
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=false`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) return null;
    return { duration: route.duration, distance: route.distance };
  } catch {
    return null;
  }
}

// Hook to compute ETAs for away devices to home zone
function useEtas(locations: Location[], zones: Zone[], enabled: boolean) {
  const [etas, setEtas] = useState<Record<string, { duration: number; distance: number }>>({});
  const lastFetchKey = useRef("");

  useEffect(() => {
    if (!enabled) {
      setEtas({});
      return;
    }

    const homeZone = zones.find((z) => z.entityId === "zone.home");
    if (!homeZone) return;

    const awayLocations = locations.filter((loc) => loc.state !== "home");
    if (awayLocations.length === 0) {
      setEtas({});
      return;
    }

    // Build a key from entity positions to avoid redundant fetches
    const key = awayLocations
      .map((l) => `${l.entityId}:${l.latitude.toFixed(4)},${l.longitude.toFixed(4)}`)
      .join("|");
    if (key === lastFetchKey.current) return;
    lastFetchKey.current = key;

    let cancelled = false;

    async function fetchAll() {
      const results: Record<string, { duration: number; distance: number }> = {};
      await Promise.all(
        awayLocations.map(async (loc) => {
          const result = await fetchEta(
            loc.longitude, loc.latitude,
            homeZone!.longitude, homeZone!.latitude,
          );
          if (result && !cancelled) {
            results[loc.entityId] = result;
          }
        }),
      );
      if (!cancelled) setEtas(results);
    }

    fetchAll();
    return () => { cancelled = true; };
  }, [locations, zones, enabled]);

  return etas;
}

// Lazy-loaded map component - lets MapLibre try to render, falls back on actual error
function MapView({
  locations,
  zones,
  darkMode,
  autoFitBounds,
  showDeviceNames,
  showZones,
  etas,
  showEta,
  deviceIcons,
  onError,
}: {
  locations: Location[];
  zones: Zone[];
  darkMode: boolean;
  autoFitBounds: boolean;
  showDeviceNames: boolean;
  showZones: boolean;
  etas: Record<string, { duration: number; distance: number }>;
  showEta: boolean;
  deviceIcons: Record<string, string>;
  onError: () => void;
}) {
  const [Map, setMap] = useState<typeof import("react-map-gl/maplibre").default | null>(null);
  const [Marker, setMarker] = useState<typeof import("react-map-gl/maplibre").Marker | null>(null);
  const [NavigationControl, setNavigationControl] = useState<typeof import("react-map-gl/maplibre").NavigationControl | null>(null);
  const [maplibregl, setMaplibregl] = useState<typeof import("maplibre-gl") | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);

  // Dynamically import MapLibre only when needed
  useEffect(() => {
    let mounted = true;

    async function loadMapLibre() {
      try {
        const [reactMapGl, maplibre] = await Promise.all([
          import("react-map-gl/maplibre"),
          import("maplibre-gl"),
        ]);

        // Import CSS
        await import("maplibre-gl/dist/maplibre-gl.css");

        if (mounted) {
          setMap(() => reactMapGl.default);
          setMarker(() => reactMapGl.Marker);
          setNavigationControl(() => reactMapGl.NavigationControl);
          setMaplibregl(() => maplibre);
        }
      } catch (err) {
        console.warn("Failed to load MapLibre:", err);
        if (mounted) {
          setLoadError(true);
          onError();
        }
      }
    }

    loadMapLibre();
    return () => { mounted = false; };
  }, [onError]);

  // Fit bounds when data changes (include zones if enabled)
  const fitBounds = useCallback(() => {
    if (!mapRef.current || !autoFitBounds) return;

    const points: [number, number][] = locations.map((loc) => [loc.longitude, loc.latitude]);
    if (showZones) {
      for (const zone of zones) {
        points.push([zone.longitude, zone.latitude]);
      }
    }
    if (points.length === 0) return;

    if (points.length === 1 && points[0]) {
      mapRef.current.setCenter(points[0]);
      mapRef.current.setZoom(14);
      return;
    }

    const bounds = points.reduce(
      (acc, point) => ({
        minLng: Math.min(acc.minLng, point[0]),
        maxLng: Math.max(acc.maxLng, point[0]),
        minLat: Math.min(acc.minLat, point[1]),
        maxLat: Math.max(acc.maxLat, point[1]),
      }),
      { minLng: Infinity, maxLng: -Infinity, minLat: Infinity, maxLat: -Infinity }
    );

    mapRef.current.fitBounds(
      [
        [bounds.minLng, bounds.minLat],
        [bounds.maxLng, bounds.maxLat],
      ],
      { padding: 50, maxZoom: 16 }
    );
  }, [locations, zones, showZones, autoFitBounds]);

  useEffect(() => {
    if (mapLoaded) {
      fitBounds();
    }
  }, [fitBounds, mapLoaded]);

  if (loadError) {
    return null; // Parent will show fallback
  }

  if (!Map || !Marker || !NavigationControl) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/60">
        <Loader2 className="h-6 w-6 animate-spin text-white/50" />
      </div>
    );
  }

  // Calculate center from first location or home zone
  const homeZone = zones.find((z) => z.entityId === "zone.home");
  const firstLocation = locations[0];
  const defaultCenter: [number, number] = homeZone
    ? [homeZone.longitude, homeZone.latitude]
    : firstLocation
      ? [firstLocation.longitude, firstLocation.latitude]
      : [0, 0];

  // Map styles
  const OSM_LIGHT_STYLE = {
    version: 8 as const,
    sources: {
      carto: {
        type: "raster" as const,
        tiles: [
          "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
          "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
          "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
        ],
        tileSize: 256,
      },
    },
    layers: [{ id: "carto-light", type: "raster" as const, source: "carto", minzoom: 0, maxzoom: 19 }],
  };

  const OSM_DARK_STYLE = {
    version: 8 as const,
    sources: {
      carto: {
        type: "raster" as const,
        tiles: [
          "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
          "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
          "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        ],
        tileSize: 256,
      },
    },
    layers: [{ id: "carto", type: "raster" as const, source: "carto", minzoom: 0, maxzoom: 19 }],
  };

  const mapStyle = darkMode ? OSM_DARK_STYLE : OSM_LIGHT_STYLE;

  return (
    <>
      {!mapLoaded && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
          <Loader2 className="h-6 w-6 animate-spin text-white/50" />
        </div>
      )}

      <Map
        ref={(ref) => {
          if (ref) mapRef.current = ref.getMap();
        }}
        initialViewState={{
          longitude: defaultCenter[0],
          latitude: defaultCenter[1],
          zoom: 13,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={mapStyle}
        onLoad={() => setMapLoaded(true)}
        onError={() => onError()}
        attributionControl={false}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {/* Zone markers */}
        {showZones && zones.map((zone) => {
          const isHome = zone.entityId === "zone.home";
          return (
            <Marker
              key={zone.entityId}
              longitude={zone.longitude}
              latitude={zone.latitude}
              anchor="center"
            >
              <div className="relative" title={zone.name}>
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center shadow-md border-2"
                  style={{
                    backgroundColor: isHome ? "#047857" : "#6366f1",
                    borderColor: "rgba(255,255,255,0.7)",
                  }}
                >
                  {isHome ? (
                    <Home className="h-3.5 w-3.5 text-white" />
                  ) : (
                    <MapPin className="h-3.5 w-3.5 text-white" />
                  )}
                </div>
                {showDeviceNames && (
                  <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 text-[10px] bg-black/70 text-white/80 px-1.5 py-0.5 rounded whitespace-nowrap">
                    {zone.name}
                  </div>
                )}
              </div>
            </Marker>
          );
        })}

        {/* Device markers */}
        {locations.map((location, index) => {
          const isHome = location.state === "home";
          const color = COLORS[index % COLORS.length] ?? "#3B82F6";
          const eta = etas[location.entityId];
          const customIcon = deviceIcons[location.entityId];

          return (
            <Marker
              key={location.entityId}
              longitude={location.longitude}
              latitude={location.latitude}
              anchor="center"
            >
              <div className="relative group" title={`${location.name} - ${location.state}`}>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 border-white"
                  style={{ backgroundColor: isHome ? "#047857" : color }}
                >
                  {customIcon ? (
                    <span className="text-base leading-none">{customIcon}</span>
                  ) : location.entityPictureUrl ? (
                    <img
                      src={location.entityPictureUrl}
                      alt={location.name}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                  ) : (
                    <User className="h-4 w-4 text-white" />
                  )}
                </div>
                {(showDeviceNames || (showEta && eta)) && (
                  <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 flex flex-col items-center gap-0.5">
                    {showDeviceNames && (
                      <div className="text-xs bg-black/70 text-white px-1.5 py-0.5 rounded whitespace-nowrap">
                        {location.name}
                      </div>
                    )}
                    {showEta && eta && !isHome && (
                      <div className="text-[10px] bg-blue-600/90 text-white px-1.5 py-0.5 rounded whitespace-nowrap flex items-center gap-1">
                        <Navigation className="h-2.5 w-2.5" />
                        {formatEta(eta.duration)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Marker>
          );
        })}
      </Map>
    </>
  );
}

// Custom HTML marker for Leaflet (replaces CircleMarker with styled divs)
function LeafletHtmlMarker({ position, html }: { position: [number, number]; html: string }) {
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const [L, setL] = useState<typeof import("leaflet") | null>(null);
  const [RLMarker, setRLMarker] = useState<typeof import("react-leaflet").Marker | null>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([import("leaflet"), import("react-leaflet")]).then(([leaflet, rl]) => {
      if (mounted) {
        setL(() => leaflet);
        setRLMarker(() => rl.Marker);
      }
    });
    return () => { mounted = false; };
  }, []);

  if (!L || !RLMarker) return null;

  const icon = L.divIcon({
    html: `<div style="position:relative;display:flex;align-items:center;justify-content:center">${html}</div>`,
    className: "",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

  return <RLMarker ref={markerRef} position={position} icon={icon} />;
}

// Leaflet fallback map - uses raster tiles, no WebGL required
function LeafletMapView({
  locations,
  zones,
  darkMode,
  showDeviceNames,
  showZones,
  deviceIcons,
  onError,
}: {
  locations: Location[];
  zones: Zone[];
  darkMode: boolean;
  showDeviceNames: boolean;
  showZones: boolean;
  deviceIcons: Record<string, string>;
  onError: () => void;
}) {
  const [leafletReady, setLeafletReady] = useState(false);
  const [LeafletComponents, setLeafletComponents] = useState<{
    MapContainer: typeof import("react-leaflet").MapContainer;
    TileLayer: typeof import("react-leaflet").TileLayer;
    CircleMarker: typeof import("react-leaflet").CircleMarker;
    Circle: typeof import("react-leaflet").Circle;
    Tooltip: typeof import("react-leaflet").Tooltip;
    useMap: typeof import("react-leaflet").useMap;
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadLeaflet() {
      try {
        const [rl, L] = await Promise.all([
          import("react-leaflet"),
          import("leaflet"),
        ]);
        await import("leaflet/dist/leaflet.css");
        // Fix default icon paths for bundlers
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "",
          iconUrl: "",
          shadowUrl: "",
        });
        if (mounted) {
          setLeafletComponents({
            MapContainer: rl.MapContainer,
            TileLayer: rl.TileLayer,
            CircleMarker: rl.CircleMarker,
            Circle: rl.Circle,
            Tooltip: rl.Tooltip,
            useMap: rl.useMap,
          });
          setLeafletReady(true);
        }
      } catch (err) {
        console.warn("Failed to load Leaflet:", err);
        if (mounted) onError();
      }
    }
    loadLeaflet();
    return () => { mounted = false; };
  }, [onError]);

  if (!leafletReady || !LeafletComponents) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  const { MapContainer, TileLayer, CircleMarker, Circle, Tooltip, useMap } = LeafletComponents;

  const tileUrl = darkMode
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  // Component to fit bounds inside MapContainer
  function FitBounds() {
    const map = useMap();
    useEffect(() => {
      const points: [number, number][] = locations.map(l => [l.latitude, l.longitude]);
      if (showZones) {
        for (const zone of zones) {
          points.push([zone.latitude, zone.longitude]);
        }
      }
      if (points.length === 0) return;
      if (points.length === 1) {
        map.setView(points[0]!, 14);
      } else {
        const lats = points.map(p => p[0]);
        const lngs = points.map(p => p[1]);
        map.fitBounds(
          [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
          { padding: [40, 40], maxZoom: 15 }
        );
      }
    }, [map, locations.length]);
    return null;
  }

  return (
    <MapContainer
      center={[39.8, -98.5]}
      zoom={4}
      style={{ width: "100%", height: "100%", background: darkMode ? "#1a1a2e" : "#f0f0f0" }}
      zoomControl={false}
      attributionControl={false}
    >
      <TileLayer url={tileUrl} />
      <FitBounds />
      {/* Zone markers */}
      {showZones && zones.map((zone) => {
        const isHome = zone.entityId === "zone.home";
        return (
          <React.Fragment key={zone.entityId}>
            <Circle
              center={[zone.latitude, zone.longitude]}
              radius={zone.radius}
              pathOptions={{
                color: isHome ? "#047857" : "#6366f1",
                fillColor: isHome ? "#047857" : "#6366f1",
                fillOpacity: 0.1,
                weight: 2,
              }}
            />
            <LeafletHtmlMarker
              position={[zone.latitude, zone.longitude]}
              html={`<div style="width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:${isHome ? "#047857" : "#6366f1"};border:2px solid rgba(255,255,255,0.7);box-shadow:0 2px 8px rgba(0,0,0,0.3)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  ${isHome ? '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>' : '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>'}
                </svg>
              </div>${showDeviceNames ? `<div style="position:absolute;left:50%;transform:translateX(-50%);top:100%;margin-top:4px;font-size:10px;background:rgba(0,0,0,0.7);color:rgba(255,255,255,0.8);padding:2px 6px;border-radius:4px;white-space:nowrap">${zone.name}</div>` : ""}`}
            />
          </React.Fragment>
        );
      })}
      {/* Device markers */}
      {locations.map((location, index) => {
        const isHome = location.state === "home";
        const color = isHome ? "#047857" : (COLORS[index % COLORS.length] ?? "#3B82F6");
        const customIcon = deviceIcons[location.entityId];
        const innerContent = customIcon
          ? `<span style="font-size:16px;line-height:1">${customIcon}</span>`
          : location.entityPictureUrl
            ? `<img src="${location.entityPictureUrl}" style="width:24px;height:24px;border-radius:50%;object-fit:cover" />`
            : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
        const label = showDeviceNames
          ? `<div style="position:absolute;left:50%;transform:translateX(-50%);top:100%;margin-top:4px;display:flex;flex-direction:column;align-items:center;gap:2px">
              <div style="font-size:12px;background:rgba(0,0,0,0.7);color:white;padding:2px 6px;border-radius:4px;white-space:nowrap">${location.name}</div>
            </div>`
          : "";
        return (
          <LeafletHtmlMarker
            key={location.entityId}
            position={[location.latitude, location.longitude]}
            html={`<div style="width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${color};border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)">${innerContent}</div>${label}`}
          />
        );
      })}
    </MapContainer>
  );
}


// Fallback list view when map can't load
function LocationListView({
  locations,
  etas,
  showEta,
  deviceIcons,
  style,
  showReason,
}: {
  locations: Location[];
  etas: Record<string, { duration: number; distance: number }>;
  showEta: boolean;
  deviceIcons: Record<string, string>;
  style?: WidgetStyle;
  showReason?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col p-4 rounded-lg overflow-hidden",
        "bg-black/40 backdrop-blur-sm"
      )}
      style={{ color: style?.textColor || "#ffffff" }}
    >
      <div className="flex items-center gap-2 mb-3 opacity-70">
        <MapPin className="h-4 w-4" />
        <span className="text-sm font-medium">Locations</span>
      </div>
      <div className="flex-1 overflow-auto space-y-2">
        {locations.map((location, index) => {
          const isHome = location.state === "home";
          const color = COLORS[index % COLORS.length] ?? "#3B82F6";
          const eta = etas[location.entityId];
          const customIcon = deviceIcons[location.entityId];

          return (
            <div
              key={location.entityId}
              className="flex items-center gap-3 p-2 rounded-lg bg-white/10"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center border-2 border-white/50 flex-shrink-0"
                style={{ backgroundColor: isHome ? "#047857" : color }}
              >
                {customIcon ? (
                  <span className="text-base leading-none">{customIcon}</span>
                ) : location.entityPictureUrl ? (
                  <img
                    src={location.entityPictureUrl}
                    alt={location.name}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <User className="h-4 w-4 text-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{location.name}</div>
                <div className="text-xs opacity-60 flex items-center gap-1">
                  {isHome && <Home className="h-3 w-3" />}
                  <span className="truncate">{isHome ? "Home" : location.state || "Unknown"}</span>
                </div>
              </div>
              {showEta && eta && !isHome && (
                <div className="text-xs text-blue-400 flex items-center gap-1 shrink-0">
                  <Navigation className="h-3 w-3" />
                  {formatEta(eta.duration)}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {showReason && (
        <div className="mt-2 text-xs opacity-40 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Map unavailable on this device
        </div>
      )}
    </div>
  );
}

export function HAMapWidget({ config, style, isBuilder }: HAMapWidgetProps) {
  const [mapFailed, setMapFailed] = useState(false);
  const [leafletFailed, setLeafletFailed] = useState(false);

  const showDeviceNames = (config.showDeviceNames as boolean) ?? true;
  const darkMode = (config.darkMode as boolean) ?? true;
  const autoFitBounds = (config.autoFitBounds as boolean) ?? true;
  const showLastUpdated = (config.showLastUpdated as boolean) ?? false;
  const showEta = (config.showEta as boolean) ?? false;
  const selectedDevices = (config.selectedDevices as string[]) ?? [];
  const selectedZones = (config.selectedZones as string[]) ?? [];
  const deviceIcons = (config.deviceIcons as Record<string, string>) ?? {};
  const showZones = selectedZones.length > 0;

  // Get real-time locations from WebSocket
  const { locations: wsLocations, connected: wsConnected } = useHALocationsWS();
  const wsZones = useHAZonesWS();
  const wsError = useHAWebSocket((state) => state.error);
  const wsConnecting = useHAWebSocket((state) => state.connecting);

  // Fallback to REST API when WebSocket fails (works on Samsung TV)
  const useRestFallback = !isBuilder && (!!wsError || (!wsConnected && !wsConnecting));

  const { data: restLocations = [] } = useQuery<Location[]>({
    queryKey: ["ha-locations-rest"],
    queryFn: () => api.getHomeAssistantLocations() as Promise<Location[]>,
    enabled: useRestFallback,
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000, // Poll every 30 seconds
  });

  const { data: restZones = [] } = useQuery<Zone[]>({
    queryKey: ["ha-zones-rest"],
    queryFn: () => api.getHomeAssistantZones() as Promise<Zone[]>,
    enabled: useRestFallback,
    staleTime: 5 * 60 * 1000,
  });

  // Use WebSocket data if available, otherwise fall back to REST
  const allLocations: Location[] = wsConnected && wsLocations.length > 0
    ? wsLocations
    : restLocations;

  const allZones: Zone[] = wsConnected && wsZones.length > 0
    ? wsZones
    : restZones;

  // Filter by selected devices (empty = show all)
  const locations = useMemo(() => {
    if (selectedDevices.length === 0) return allLocations;
    return allLocations.filter((loc) => selectedDevices.includes(loc.entityId));
  }, [allLocations, selectedDevices]);

  // Filter by selected zones (empty = none shown)
  const zones = useMemo(() => {
    if (selectedZones.length === 0) return [];
    return allZones.filter((z) => selectedZones.includes(z.entityId));
  }, [allZones, selectedZones]);

  // Compute ETAs for away devices
  // ETA needs home zone from allZones (even if zones aren't displayed on map)
  const etas = useEtas(locations, allZones, showEta);

  // Fetch HA config to check if configured
  const { data: haConfig, isLoading: isLoadingConfig } = useQuery({
    queryKey: ["homeassistant", "config"],
    queryFn: () => api.getHomeAssistantConfig(),
    enabled: !isBuilder,
  });

  const isConfigured = !!(haConfig && haConfig.url);
  const isLoading = isLoadingConfig || wsConnecting;

  const handleMapError = useCallback(() => {
    setMapFailed(true);
  }, []);

  // Builder preview
  if (isBuilder) {
    return (
      <div
        className={cn(
          "flex h-full flex-col items-center justify-center p-4 rounded-lg",
          "bg-black/40 backdrop-blur-sm"
        )}
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <MapPin className="h-10 w-10 opacity-50 mb-2" />
        <span className="text-sm opacity-70">HA Map</span>
        <span className="text-xs opacity-40 mt-1">Live location tracking</span>
      </div>
    );
  }

  // Not configured state
  if (!isLoadingConfig && !isConfigured) {
    return (
      <div
        className={cn(
          "flex h-full flex-col items-center justify-center p-4 rounded-lg",
          "bg-black/40 backdrop-blur-sm"
        )}
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <MapPin className="h-8 w-8 opacity-30 mb-2" />
        <span className="text-sm opacity-50">Home Assistant not configured</span>
      </div>
    );
  }

  // Loading state
  if (isLoading && locations.length === 0) {
    return (
      <div
        className={cn(
          "flex h-full items-center justify-center p-4 rounded-lg",
          "bg-black/40 backdrop-blur-sm"
        )}
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <Loader2 className="h-6 w-6 animate-spin opacity-50" />
      </div>
    );
  }

  // No locations and no zones to show
  if (locations.length === 0 && !(showZones && zones.length > 0)) {
    return (
      <div
        className={cn(
          "flex h-full flex-col items-center justify-center p-4 rounded-lg",
          "bg-black/40 backdrop-blur-sm"
        )}
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <User className="h-8 w-8 opacity-30 mb-2" />
        <span className="text-sm opacity-50">No device trackers found</span>
      </div>
    );
  }

  // MapLibre failed — try Leaflet (raster tiles, no WebGL)
  if (mapFailed && !leafletFailed) {
    return (
      <div className="h-full w-full rounded-lg overflow-hidden relative">
        <LeafletMapView
          locations={locations}
          zones={zones}
          darkMode={darkMode}
          showDeviceNames={showDeviceNames}
          showZones={showZones}
          deviceIcons={deviceIcons}
          onError={() => setLeafletFailed(true)}
        />
        {/* ETA panel overlay */}
        {showEta && Object.keys(etas).length > 0 && (
          <div className="absolute top-2 left-2 z-[1000] bg-black/80 backdrop-blur-sm rounded-lg px-2.5 py-2 shadow-lg border border-blue-500/30">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Navigation className="h-3 w-3 text-blue-400" />
              <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wide">ETA Home</span>
            </div>
            <div className="space-y-1">
              {locations
                .filter((loc) => loc.state !== "home" && etas[loc.entityId])
                .map((loc) => (
                  <div key={loc.entityId} className="flex items-center gap-2 text-[11px] text-white">
                    <span className="font-medium truncate max-w-[80px]">{loc.name}</span>
                    <span className="text-blue-300 ml-auto">{formatEta(etas[loc.entityId]!.duration)}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
        {/* Last Updated overlay */}
        {(() => {
          const visible = locations.filter((loc) => {
            if (loc.state === "home" && loc.lastUpdated &&
              (Date.now() - new Date(loc.lastUpdated).getTime()) < 60 * 60 * 1000) return false;
            return true;
          });
          if (visible.length === 0) return null;
          return (
            <div className="absolute bottom-2 right-2 z-[1000] bg-primary/80 backdrop-blur-sm rounded-lg px-2.5 py-1.5 shadow-lg border border-primary/30">
              <div className="space-y-0.5">
                {visible.map((location) => (
                  <div key={location.entityId} className="flex items-center gap-2 text-[11px] text-primary-foreground">
                    <span className="font-medium truncate max-w-[80px]">{location.name}</span>
                    <span className="opacity-70">
                      {location.lastUpdated ? formatLastUpdated(location.lastUpdated) : "\u2014"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  // Both map engines failed — show list view
  if (mapFailed && leafletFailed) {
    return <LocationListView locations={locations} etas={etas} showEta={showEta} deviceIcons={deviceIcons} style={style} showReason />;
  }

  // Try to render the map
  return (
    <div className="h-full w-full rounded-lg overflow-hidden relative">
      <MapView
        locations={locations}
        zones={zones}
        darkMode={darkMode}
        autoFitBounds={autoFitBounds}
        showDeviceNames={showDeviceNames}
        showZones={showZones}
        etas={etas}
        showEta={showEta}
        deviceIcons={deviceIcons}
        onError={handleMapError}
      />
      {/* ETA panel overlay */}
      {showEta && Object.keys(etas).length > 0 && (
        <div className="absolute top-2 left-2 z-10 bg-black/80 backdrop-blur-sm rounded-lg px-2.5 py-2 shadow-lg border border-blue-500/30">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Navigation className="h-3 w-3 text-blue-400" />
            <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wide">ETA Home</span>
          </div>
          <div className="space-y-1">
            {locations
              .filter((loc) => loc.state !== "home" && etas[loc.entityId])
              .map((loc) => (
                <div key={loc.entityId} className="flex items-center gap-2 text-[11px] text-white">
                  <span className="font-medium truncate max-w-[80px]">{loc.name}</span>
                  <span className="text-blue-300 ml-auto">{formatEta(etas[loc.entityId]!.duration)}</span>
                </div>
              ))}
          </div>
        </div>
      )}
      {showLastUpdated && (() => {
        const visible = locations.filter((loc) => {
          if (loc.state === "home" && loc.lastUpdated &&
            (Date.now() - new Date(loc.lastUpdated).getTime()) < 60 * 60 * 1000) return false;
          return true;
        });
        if (visible.length === 0) return null;
        return (
          <div className="absolute bottom-2 right-2 z-10 bg-primary/80 backdrop-blur-sm rounded-lg px-2.5 py-1.5 shadow-lg border border-primary/30">
            <div className="space-y-0.5">
              {visible.map((location) => (
                <div key={location.entityId} className="flex items-center gap-2 text-[11px] text-primary-foreground">
                  <span className="font-medium truncate max-w-[80px]">{location.name}</span>
                  <span className="opacity-70">
                    {location.lastUpdated ? formatLastUpdated(location.lastUpdated) : "\u2014"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
