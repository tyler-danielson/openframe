import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, User, Loader2, AlertTriangle, Home } from "lucide-react";
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
}

// Color palette for different people
const COLORS = ["#1E40AF", "#047857", "#B45309", "#B91C1C", "#5B21B6", "#9D174D"];

// Check if MapLibre is supported - must be done carefully to avoid crashes
function checkMapSupport(): boolean {
  try {
    // Check basic WebGL support first
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return false;

    // Check if we're in a known problematic browser
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("tizen") || ua.includes("webos") || ua.includes("smarttv")) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

// Lazy-loaded map component to avoid loading MapLibre on unsupported browsers
function MapView({
  locations,
  zones,
  darkMode,
  autoFitBounds,
  showDeviceNames,
  onError,
}: {
  locations: Location[];
  zones: Zone[];
  darkMode: boolean;
  autoFitBounds: boolean;
  showDeviceNames: boolean;
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

        // Check if maplibre reports it's supported
        if (!(maplibre.default as unknown as { supported: () => boolean }).supported()) {
          throw new Error("MapLibre not supported");
        }

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

  // Fit bounds when data changes
  const fitBounds = useCallback(() => {
    if (!mapRef.current || locations.length === 0 || !autoFitBounds) return;

    const points = locations.map((loc) => [loc.longitude, loc.latitude] as [number, number]);
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
  }, [locations, autoFitBounds]);

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
  const LIGHT_STYLE = {
    version: 8 as const,
    sources: {
      carto: {
        type: "raster" as const,
        tiles: [
          "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
          "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
          "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
        ],
        tileSize: 256,
      },
    },
    layers: [{ id: "carto", type: "raster" as const, source: "carto", minzoom: 0, maxzoom: 19 }],
  };

  const DARK_STYLE = {
    version: 8 as const,
    sources: {
      stadia: {
        type: "raster" as const,
        tiles: ["https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png"],
        tileSize: 256,
      },
    },
    layers: [{ id: "stadia", type: "raster" as const, source: "stadia", minzoom: 0, maxzoom: 19 }],
  };

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
        mapStyle={darkMode ? DARK_STYLE : LIGHT_STYLE}
        onLoad={() => setMapLoaded(true)}
        onError={() => onError()}
        attributionControl={false}
      >
        <NavigationControl position="top-right" showCompass={false} />

        {locations.map((location, index) => {
          const isHome = location.state === "home";
          const color = COLORS[index % COLORS.length] ?? "#3B82F6";

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
                  {location.entityPictureUrl ? (
                    <img
                      src={location.entityPictureUrl}
                      alt={location.name}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                  ) : (
                    <User className="h-4 w-4 text-white" />
                  )}
                </div>
                {showDeviceNames && (
                  <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 text-xs bg-black/70 text-white px-1.5 py-0.5 rounded whitespace-nowrap">
                    {location.name}
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

// Fallback list view when map can't load
function LocationListView({
  locations,
  style,
  showReason,
}: {
  locations: Location[];
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

          return (
            <div
              key={location.entityId}
              className="flex items-center gap-3 p-2 rounded-lg bg-white/10"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center border-2 border-white/50 flex-shrink-0"
                style={{ backgroundColor: isHome ? "#047857" : color }}
              >
                {location.entityPictureUrl ? (
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

  // Check map support once on mount
  const mapSupported = useMemo(() => checkMapSupport(), []);

  const showZones = (config.showZones as boolean) ?? true;
  const showDeviceNames = (config.showDeviceNames as boolean) ?? true;
  const darkMode = (config.darkMode as boolean) ?? true;
  const autoFitBounds = (config.autoFitBounds as boolean) ?? true;

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
  const locations: Location[] = wsConnected && wsLocations.length > 0
    ? wsLocations
    : restLocations;

  const zones: Zone[] = wsConnected && wsZones.length > 0
    ? wsZones
    : restZones;

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

  // Only show error if we have no data from either source
  // (REST fallback should work even when WebSocket fails)

  // No locations
  if (locations.length === 0) {
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

  // Show list view if map is not supported or failed to load
  if (!mapSupported || mapFailed) {
    return <LocationListView locations={locations} style={style} showReason />;
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
        onError={handleMapError}
      />
    </div>
  );
}
