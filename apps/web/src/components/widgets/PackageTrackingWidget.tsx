import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Package, Truck, PackageCheck, AlertTriangle, Clock, MapPin } from "lucide-react";
import { api } from "../../services/api";
import type { WidgetStyle, FontSizePreset } from "../../stores/screensaver";
import { getFontSizeConfig } from "../../lib/font-size";
import { cn } from "../../lib/utils";

interface PackageTrackingWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
  widgetId?: string;
}

type PackageStatus = "pre_transit" | "in_transit" | "out_for_delivery" | "delivered" | "exception" | "unknown";

interface TrackedPackage {
  id: string;
  label: string;
  carrier: string;
  trackingNumber: string;
  status: PackageStatus;
  eta?: string;
  lastUpdate?: string;
}

const FONT_SIZE_CLASSES: Record<Exclude<FontSizePreset, "custom">, { title: string; meta: string; badge: string }> = {
  xs: { title: "text-[10px]", meta: "text-[8px]", badge: "text-[7px]" },
  sm: { title: "text-xs", meta: "text-[9px]", badge: "text-[8px]" },
  md: { title: "text-sm", meta: "text-[10px]", badge: "text-[9px]" },
  lg: { title: "text-base", meta: "text-xs", badge: "text-[10px]" },
  xl: { title: "text-lg", meta: "text-sm", badge: "text-xs" },
};

const CUSTOM_SCALE = {
  title: 1,
  meta: 0.7,
  badge: 0.65,
};

const STATUS_CONFIG: Record<PackageStatus, { label: string; color: string; bgColor: string; icon: typeof Package }> = {
  pre_transit: { label: "Pre-Transit", color: "text-gray-400", bgColor: "bg-gray-500/20", icon: Clock },
  in_transit: { label: "In Transit", color: "text-blue-400", bgColor: "bg-blue-500/20", icon: Truck },
  out_for_delivery: { label: "Out for Delivery", color: "text-amber-400", bgColor: "bg-amber-500/20", icon: MapPin },
  delivered: { label: "Delivered", color: "text-green-400", bgColor: "bg-green-500/20", icon: PackageCheck },
  exception: { label: "Exception", color: "text-red-400", bgColor: "bg-red-500/20", icon: AlertTriangle },
  unknown: { label: "Unknown", color: "text-gray-400", bgColor: "bg-gray-500/20", icon: Package },
};

export function PackageTrackingWidget({ config, style, isBuilder }: PackageTrackingWidgetProps) {
  const maxItems = (config.maxItems as number) ?? 5;
  const showDelivered = (config.showDelivered as boolean) ?? false;
  const showCarrierIcon = (config.showCarrierIcon as boolean) ?? true;
  const showETA = (config.showETA as boolean) ?? true;
  const displayMode = (config.displayMode as string) ?? "list";

  const { preset, isCustom, customValue } = getFontSizeConfig(style);
  const sizeClasses = isCustom ? null : FONT_SIZE_CLASSES[preset as Exclude<FontSizePreset, "custom">];

  const getCustomFontSize = (scale: number) => {
    if (!customValue) return undefined;
    const value = parseFloat(customValue);
    const unit = customValue.replace(/[\d.]/g, "") || "px";
    return `${value * scale}${unit}`;
  };

  const { data, isLoading } = useQuery({
    queryKey: ["tracked-packages"],
    queryFn: () => api.getPackages() as Promise<{ packages: TrackedPackage[] }>,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    enabled: !isBuilder,
  });

  const packages = data?.packages ?? [];

  const filteredPackages = useMemo(() => {
    let result = packages;
    if (!showDelivered) {
      result = result.filter((p) => p.status !== "delivered");
    }
    return result.slice(0, maxItems);
  }, [packages, showDelivered, maxItems]);

  // Mock data for builder preview
  const mockPackages: TrackedPackage[] = [
    { id: "1", label: "New headphones", carrier: "UPS", trackingNumber: "1Z999AA10123456784", status: "out_for_delivery", eta: new Date().toISOString() },
    { id: "2", label: "Birthday gift", carrier: "FedEx", trackingNumber: "794644790132", status: "in_transit", eta: new Date(Date.now() + 2 * 86400000).toISOString() },
    { id: "3", label: "Kitchen supplies", carrier: "USPS", trackingNumber: "9400111899223100007", status: "pre_transit" },
    { id: "4", label: "Books order", carrier: "Amazon", trackingNumber: "TBA123456789", status: "delivered" },
  ];

  const displayPackages = isBuilder
    ? mockPackages.filter(p => showDelivered || p.status !== "delivered").slice(0, maxItems)
    : filteredPackages;

  if (!isBuilder && isLoading) {
    return (
      <div
        className="flex h-full items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <span className="text-sm opacity-50">Loading packages...</span>
      </div>
    );
  }

  if (!isBuilder && displayPackages.length === 0) {
    return (
      <div
        className="flex h-full flex-col items-center justify-center p-4 rounded-lg bg-black/40 backdrop-blur-sm"
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <Package className="h-8 w-8 opacity-30 mb-2" />
        <span className="text-sm opacity-50">No packages to track</span>
      </div>
    );
  }

  // Summary view
  if (displayMode === "summary") {
    const statusCounts: Partial<Record<PackageStatus, number>> = {};
    for (const pkg of displayPackages) {
      statusCounts[pkg.status] = (statusCounts[pkg.status] || 0) + 1;
    }

    return (
      <div
        className={cn(
          "relative flex h-full flex-col items-center justify-center p-4 rounded-lg gap-3",
          "bg-black/40 backdrop-blur-sm"
        )}
        style={{ color: style?.textColor || "#ffffff" }}
      >
        <Package className="h-8 w-8 opacity-60" />
        <div className="flex flex-col items-center gap-1">
          {Object.entries(statusCounts).map(([status, count]) => {
            const cfg = STATUS_CONFIG[status as PackageStatus];
            const StatusIcon = cfg.icon;
            return (
              <div key={status} className="flex items-center gap-2">
                <StatusIcon className={cn("w-4 h-4", cfg.color)} />
                <span
                  className={cn(sizeClasses?.title)}
                  style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.title) } : undefined}
                >
                  {count} {cfg.label.toLowerCase()}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // List view
  return (
    <div
      className={cn(
        "relative flex h-full flex-col p-4 rounded-lg overflow-hidden",
        "bg-black/40 backdrop-blur-sm"
      )}
      style={{ color: style?.textColor || "#ffffff" }}
    >
      <div className="flex-1 space-y-2 overflow-hidden">
        {displayPackages.map((pkg) => {
          const statusCfg = STATUS_CONFIG[pkg.status];
          const StatusIcon = statusCfg.icon;
          const etaDate = pkg.eta ? new Date(pkg.eta) : null;
          const isToday = etaDate && new Date().toDateString() === etaDate.toDateString();
          const etaLabel = etaDate
            ? isToday
              ? "Today"
              : etaDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })
            : null;

          return (
            <div key={pkg.id} className="flex items-center gap-2 min-h-[28px]">
              {/* Carrier icon */}
              {showCarrierIcon && (
                <div className="w-6 h-6 rounded flex items-center justify-center bg-white/10 flex-shrink-0">
                  <StatusIcon className={cn("w-3.5 h-3.5", statusCfg.color)} />
                </div>
              )}

              {/* Package info */}
              <div className="flex-1 min-w-0">
                <div
                  className={cn(sizeClasses?.title, "truncate")}
                  style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.title) } : undefined}
                >
                  {pkg.label || pkg.carrier}
                </div>
                {showCarrierIcon && (
                  <div
                    className={cn(sizeClasses?.meta, "opacity-50 truncate")}
                    style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.meta) } : undefined}
                  >
                    {pkg.carrier}
                  </div>
                )}
              </div>

              {/* Status badge */}
              <span
                className={cn(
                  sizeClasses?.badge,
                  "flex-shrink-0 px-1.5 py-0.5 rounded-full",
                  statusCfg.bgColor, statusCfg.color
                )}
                style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.badge) } : undefined}
              >
                {statusCfg.label}
              </span>

              {/* ETA */}
              {showETA && etaLabel && (
                <span
                  className={cn(sizeClasses?.meta, "flex-shrink-0 opacity-60")}
                  style={isCustom ? { fontSize: getCustomFontSize(CUSTOM_SCALE.meta) } : undefined}
                >
                  {etaLabel}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
