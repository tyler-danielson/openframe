import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Map, { Marker, Source, Layer, NavigationControl } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import { MapPin, User, Loader2, AlertCircle, LocateFixed, Sun, Moon } from "lucide-react";
import { api, type HALocation, type HAZone } from "../services/api";
import { useCalendarStore } from "../stores/calendar";

import "maplibre-gl/dist/maplibre-gl.css";

// Weather icon helper
function getWeatherIcon(iconCode: string): string {
  const iconMap: Record<string, string> = {
    "01d": "\u2600\uFE0F", "01n": "\uD83C\uDF19",
    "02d": "\u26C5", "02n": "\u26C5",
    "03d": "\u2601\uFE0F", "03n": "\u2601\uFE0F",
    "04d": "\u2601\uFE0F", "04n": "\u2601\uFE0F",
    "09d": "\uD83C\uDF27\uFE0F", "09n": "\uD83C\uDF27\uFE0F",
    "10d": "\uD83C\uDF26\uFE0F", "10n": "\uD83C\uDF27\uFE0F",
    "11d": "\u26C8\uFE0F", "11n": "\u26C8\uFE0F",
    "13d": "\uD83C\uDF28\uFE0F", "13n": "\uD83C\uDF28\uFE0F",
    "50d": "\uD83C\uDF2B\uFE0F", "50n": "\uD83C\uDF2B\uFE0F",
  };
  return iconMap[iconCode] || "\u2600\uFE0F";
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

// Dark mode style (CARTO Dark Matter - no API key required)
const DARK_STYLE = {
  version: 8 as const,
  sources: {
    "carto-dark": {
      type: "raster" as const,
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    },
  },
  layers: [
    {
      id: "carto-dark",
      type: "raster" as const,
      source: "carto-dark",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

export function MapPage() {
  const navigate = useNavigate();
  const mapRef = useRef<maplibregl.Map | null>(null);
  const wasAnyoneAway = useRef(false);
  const [selectedLocation, setSelectedLocation] = useState<HALocation | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true); // Default to dark mode
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timeFade, setTimeFade] = useState(true);

  const { familyName, timeFormat, cycleTimeFormat } = useCalendarStore();

  // Fetch weather data
  const { data: weather } = useQuery({
    queryKey: ["weather-current"],
    queryFn: () => api.getCurrentWeather(),
    refetchInterval: 10 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Fetch hourly forecast for header
  const { data: hourlyForecast } = useQuery({
    queryKey: ["weather-hourly"],
    queryFn: () => api.getHourlyForecast(),
    refetchInterval: 30 * 60 * 1000,
    staleTime: 15 * 60 * 1000,
    retry: false,
  });

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Handle time format change with fade effect
  const handleTimeFormatChange = () => {
    setTimeFade(false);
    setTimeout(() => {
      cycleTimeFormat();
      setTimeFade(true);
    }, 300);
  };

  // Format the time based on user preference
  const formattedTime = useMemo(() => {
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    const seconds = currentTime.getSeconds();
    switch (timeFormat) {
      case "12h": {
        const h12 = hours % 12 || 12;
        const ampm = hours >= 12 ? "PM" : "AM";
        return `${h12}:${minutes.toString().padStart(2, "0")} ${ampm}`;
      }
      case "12h-seconds": {
        const h12 = hours % 12 || 12;
        const ampm = hours >= 12 ? "PM" : "AM";
        return `${h12}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")} ${ampm}`;
      }
      case "24h":
        return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
      case "24h-seconds":
        return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
      default:
        return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
    }
  }, [currentTime, timeFormat]);

  // Fetch HA config to check if connected
  const { data: config, isLoading: isLoadingConfig } = useQuery({
    queryKey: ["homeassistant", "config"],
    queryFn: () => api.getHomeAssistantConfig(),
  });

  const isConnected = !!(config && config.url);

  // Fetch locations
  const {
    data: locations = [],
    isLoading: isLoadingLocations,
    error: locationsError,
  } = useQuery({
    queryKey: ["homeassistant", "locations"],
    queryFn: () => api.getHomeAssistantLocations(),
    enabled: isConnected,
    refetchInterval: 30000,
  });

  // Fetch zones
  const { data: zones = [] } = useQuery({
    queryKey: ["homeassistant", "zones"],
    queryFn: () => api.getHomeAssistantZones(),
    enabled: isConnected,
  });

  const isLoading = isLoadingConfig || isLoadingLocations;

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
      { padding: 100, maxZoom: 18 }
    );
  }, [locations]);

  useEffect(() => {
    // Delay fitBounds to ensure map is ready
    const timer = setTimeout(fitBounds, 100);
    return () => clearTimeout(timer);
  }, [fitBounds]);

  // Auto-navigate to calendar when all trackers return home
  useEffect(() => {
    if (locations.length === 0) return;

    const allHome = locations.every((loc) => loc.state === "home");
    const anyAway = locations.some((loc) => loc.state !== "home");

    // Track if anyone was away
    if (anyAway) {
      wasAnyoneAway.current = true;
    }

    // Navigate only if all are home AND someone was previously away
    if (allHome && wasAnyoneAway.current) {
      navigate("/calendar");
    }
  }, [locations, navigate]);

  // Not configured state
  if (!isLoadingConfig && !isConnected) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-background">
        <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg text-muted-foreground">Connect Home Assistant to see locations</p>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state
  if (locationsError || mapError) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-background">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-lg text-muted-foreground">{mapError || "Failed to load locations"}</p>
      </div>
    );
  }

  // No locations
  if (locations.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-background">
        <User className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg text-muted-foreground">No device trackers or persons found</p>
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

  // Create GeoJSON for zone circles
  const zonesGeoJSON = {
    type: "FeatureCollection" as const,
    features: zones.map((zone) => ({
      type: "Feature" as const,
      properties: {
        entityId: zone.entityId,
        name: zone.name,
        radius: zone.radius,
        isHome: zone.entityId === "zone.home",
      },
      geometry: {
        type: "Point" as const,
        coordinates: [zone.longitude, zone.latitude],
      },
    })),
  };

  return (
    <div className="flex h-full w-full flex-col">
      {/* Main Navigation Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-1.5 shrink-0 overflow-hidden">
        <div className="flex items-center gap-[clamp(0.5rem,1vw,1rem)] min-w-0 flex-1 whitespace-nowrap">
          <button
            onClick={handleTimeFormatChange}
            className={`text-[clamp(0.875rem,2vw,1.5rem)] font-semibold text-muted-foreground hover:text-foreground transition-opacity duration-300 ${
              timeFade ? "opacity-100" : "opacity-0"
            }`}
            title="Click to change time format"
          >
            {formattedTime}
          </button>
          {weather && (
            <div className="flex items-center gap-[clamp(0.25rem,0.5vw,0.5rem)] text-muted-foreground" title={weather.description}>
              <span className="text-[clamp(1rem,2.5vw,1.75rem)]">{getWeatherIcon(weather.icon)}</span>
              <span className="text-[clamp(0.875rem,2vw,1.5rem)] font-semibold">{weather.temp}°</span>
            </div>
          )}
          {hourlyForecast && hourlyForecast.length > 0 && (
            <div className="flex items-center gap-[clamp(0.5rem,1vw,1rem)] text-muted-foreground">
              {hourlyForecast.slice(0, 4).map((hour, i) => (
                <div key={i} className="flex flex-col items-center text-[clamp(0.5rem,1vw,0.75rem)] leading-tight">
                  <div className="flex items-center gap-0.5">
                    <span className="text-[clamp(0.625rem,1.25vw,1rem)]">{getWeatherIcon(hour.icon)}</span>
                    <span>{hour.temp}°</span>
                  </div>
                  <span className="-mt-0.5">{hour.time}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <h2 className="text-[clamp(0.75rem,1.5vw,1.125rem)] font-semibold">Map</h2>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative flex-1">
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
        onError={(e) => {
          console.error("Map error:", e);
          setMapError("Failed to load map tiles");
        }}
      >
        <NavigationControl position="top-right" />

        {/* Zone circles - disabled due to build compatibility issues */}
        {/* TODO: Fix __publicField error with GeoJSON source */}

        {/* Location markers */}
        {locations.map((location, index) => {
          const isHome = location.state === "home";
          const color = colors[index % colors.length] ?? "#3B82F6";
          const isSelected = selectedLocation?.entityId === location.entityId;

          return (
            <Marker
              key={location.entityId}
              longitude={location.longitude}
              latitude={location.latitude}
              anchor="center"
            >
              <div
                className="relative cursor-pointer"
                onClick={() => setSelectedLocation(isSelected ? null : location)}
              >
                {/* Marker circle */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg border-3 transition-transform ${
                    isSelected ? "scale-125" : "hover:scale-110"
                  }`}
                  style={{
                    backgroundColor: isHome ? "#047857" : color,
                    borderColor: "white",
                    borderWidth: "3px",
                  }}
                >
                  {location.entityPictureUrl ? (
                    <img
                      src={location.entityPictureUrl}
                      alt={location.name}
                      className="w-7 h-7 rounded-full object-cover"
                    />
                  ) : (
                    <User className="h-5 w-5 text-white" />
                  )}
                </div>

                {/* Name label below marker */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 whitespace-nowrap">
                  <span className="text-xs font-medium text-white bg-black/60 px-2 py-0.5 rounded">
                    {location.name}
                  </span>
                </div>
              </div>
            </Marker>
          );
        })}
      </Map>

      {/* Selected location info panel */}
      {selectedLocation && (
        <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-card border border-border rounded-lg shadow-xl p-4">
          <div className="flex items-start gap-3">
            {selectedLocation.entityPictureUrl ? (
              <img
                src={selectedLocation.entityPictureUrl}
                alt={selectedLocation.name}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ backgroundColor: colors[locations.indexOf(selectedLocation) % colors.length] }}
              >
                <User className="h-6 w-6 text-white" />
              </div>
            )}
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{selectedLocation.name}</h3>
              <p className="text-sm text-muted-foreground capitalize">
                {selectedLocation.state.replace(/_/g, " ")}
              </p>
              {selectedLocation.batteryLevel !== undefined && (
                <p className="text-sm text-muted-foreground">
                  Battery: {selectedLocation.batteryLevel}%
                </p>
              )}
              {selectedLocation.gpsAccuracy !== undefined && (
                <p className="text-sm text-muted-foreground">
                  Accuracy: {Math.round(selectedLocation.gpsAccuracy)}m
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Updated: {new Date(selectedLocation.lastUpdated).toLocaleTimeString()}
              </p>
            </div>
            <button
              onClick={() => setSelectedLocation(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Fit bounds button */}
      <button
        onClick={fitBounds}
        className="absolute top-4 left-4 bg-card border border-border rounded-lg p-2 shadow-lg hover:bg-accent transition-colors"
        title="Fit all locations"
      >
        <LocateFixed className="h-5 w-5" />
      </button>

      {/* Dark mode toggle */}
      <button
        onClick={() => setIsDarkMode(!isDarkMode)}
        className="absolute top-4 left-16 bg-card border border-border rounded-lg p-2 shadow-lg hover:bg-accent transition-colors"
        title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
      >
        {isDarkMode ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
      </button>

      {/* Location count indicator */}
      <div className="absolute top-4 left-28 bg-card border border-border rounded-lg px-3 py-2 shadow-lg">
        <span className="text-sm font-medium">{locations.length} {locations.length === 1 ? "person" : "people"}</span>
      </div>
      </div>
    </div>
  );
}
