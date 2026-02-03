import { useEffect, useRef, useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Map, { Marker, NavigationControl } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import { MapPin, User, Loader2, AlertCircle, Wifi, WifiOff, Sun, Moon } from "lucide-react";
import { api } from "../../services/api";
import { useHAWebSocket, useHALocations, useHAZones } from "../../stores/homeassistant-ws";
import { cn } from "../../lib/utils";

import "maplibre-gl/dist/maplibre-gl.css";

interface LocationMapProps {
  className?: string;
  height?: string;
  showZones?: boolean;
}

// Light mode style (Carto Voyager)
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
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    },
  },
  layers: [
    {
      id: "carto",
      type: "raster" as const,
      source: "carto",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

// Dark mode style (Stadia Alidade Smooth Dark - better road contrast)
const DARK_STYLE = {
  version: 8 as const,
  sources: {
    stadia: {
      type: "raster" as const,
      tiles: [
        "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://stadiamaps.com/">Stadia Maps</a>',
    },
  },
  layers: [
    {
      id: "stadia",
      type: "raster" as const,
      source: "stadia",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

export function LocationMap({
  className,
  height = "300px",
  showZones = true,
}: LocationMapProps) {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true); // Default to dark mode

  // Get real-time locations from WebSocket
  const { locations, connected: wsConnected } = useHALocations();
  const zones = useHAZones();
  const wsError = useHAWebSocket((state) => state.error);
  const wsConnecting = useHAWebSocket((state) => state.connecting);

  // Fetch HA config to check if configured
  const { data: config, isLoading: isLoadingConfig } = useQuery({
    queryKey: ["homeassistant", "config"],
    queryFn: () => api.getHomeAssistantConfig(),
  });

  const isConfigured = !!(config && config.url);
  const isLoading = isLoadingConfig || wsConnecting;

  // Fit bounds when data changes
  const fitBounds = useCallback(() => {
    if (!mapRef.current || locations.length === 0) return;

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
      { padding: 80, maxZoom: 18 }
    );
  }, [locations]);

  useEffect(() => {
    if (mapLoaded) {
      fitBounds();
    }
  }, [fitBounds, mapLoaded]);

  // Not configured state
  if (!isLoadingConfig && !isConfigured) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-lg border border-border bg-card p-4",
          className
        )}
        style={{ height }}
      >
        <MapPin className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground text-center">
          Connect Home Assistant to see locations
        </p>
      </div>
    );
  }

  // Loading state
  if (isLoading && locations.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border border-border bg-card",
          className
        )}
        style={{ height }}
      >
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Error state (only show if we have no data)
  if ((wsError || mapError) && locations.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-lg border border-border bg-card p-4",
          className
        )}
        style={{ height }}
      >
        <AlertCircle className="h-8 w-8 text-destructive mb-2" />
        <p className="text-sm text-muted-foreground text-center">
          {mapError || wsError || "Failed to load locations"}
        </p>
      </div>
    );
  }

  // No locations
  if (locations.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-lg border border-border bg-card p-4",
          className
        )}
        style={{ height }}
      >
        <User className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground text-center">
          No device trackers or persons found
        </p>
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

  // Color palette for different people (darker/muted tones)
  const colors = ["#1E40AF", "#047857", "#B45309", "#B91C1C", "#5B21B6", "#9D174D"];

  return (
    <div className={cn("rounded-lg overflow-hidden border border-border relative", className)} style={{ height }}>
      {/* Real-time connection indicator */}
      <div className="absolute top-2 left-2 z-20 flex items-center gap-2">
        <div
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium",
            wsConnected
              ? "bg-green-500/20 text-green-600"
              : "bg-yellow-500/20 text-yellow-600"
          )}
          title={wsConnected ? "Real-time updates active" : "Connecting..."}
        >
          {wsConnected ? (
            <Wifi className="h-3 w-3" />
          ) : (
            <WifiOff className="h-3 w-3" />
          )}
          <span>{wsConnected ? "Live" : "..."}</span>
        </div>

        {/* Dark mode toggle */}
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors",
            isDarkMode
              ? "bg-slate-700/80 text-slate-200 hover:bg-slate-600/80"
              : "bg-white/80 text-slate-700 hover:bg-white/90"
          )}
          title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDarkMode ? (
            <Moon className="h-3 w-3" />
          ) : (
            <Sun className="h-3 w-3" />
          )}
        </button>
      </div>

      {/* Loading overlay */}
      {!mapLoaded && !mapError && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-card">
          <div className="flex flex-col items-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
            <span className="text-sm text-muted-foreground">Loading map...</span>
          </div>
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
        mapStyle={isDarkMode ? DARK_STYLE : LIGHT_STYLE}
        onLoad={() => {
          console.log("LocationMap: Map loaded successfully");
          setMapLoaded(true);
        }}
        onError={(e) => {
          console.error("LocationMap: Map error:", e);
          setMapError("Failed to load map tiles");
        }}
      >
        <NavigationControl position="top-right" />

        {/* Location markers */}
        {locations.map((location, index) => {
          const isHome = location.state === "home";
          const color = colors[index % colors.length] ?? "#3B82F6";

          return (
            <Marker
              key={location.entityId}
              longitude={location.longitude}
              latitude={location.latitude}
              anchor="center"
            >
              <div
                className="relative cursor-pointer group"
                title={`${location.name} - ${location.state}`}
              >
                {/* Marker circle */}
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

                {/* Tooltip on hover */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                  <div className="bg-card border border-border rounded-lg shadow-lg p-2 text-sm whitespace-nowrap">
                    <p className="font-medium">{location.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {location.state.replace(/_/g, " ")}
                    </p>
                    {location.batteryLevel !== undefined && (
                      <p className="text-xs text-muted-foreground">
                        Battery: {location.batteryLevel}%
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </Marker>
          );
        })}
      </Map>
    </div>
  );
}
