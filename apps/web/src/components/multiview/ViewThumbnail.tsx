import {
  Camera,
  MapPin,
  Music,
  Calendar,
  Image,
  Cloud,
  Tv,
  Zap,
  Gauge,
  LineChart,
  Video,
  Clock,
  CloudSun,
  ArrowRight,
  CheckSquare,
  Trophy,
  Newspaper,
  CalendarDays,
  CalendarRange,
  Timer,
  Type,
  Images,
  Youtube,
} from "lucide-react";
import { cn } from "../../lib/utils";
import type { AvailableItem, ViewType } from "./types";

interface ViewThumbnailProps {
  item: AvailableItem;
  isSelected: boolean;
  onClick: () => void;
  badge?: string;
  disabled?: boolean;
}

const TYPE_ICONS: Record<ViewType, React.ElementType> = {
  camera: Camera,
  map: MapPin,
  media: Music,
  calendar: Calendar,
  image: Image,
  weather: Cloud,
  iptv: Tv,
  youtube: Youtube,
  "ha-entity": Zap,
  "ha-gauge": Gauge,
  "ha-graph": LineChart,
  "ha-camera": Video,
  clock: Clock,
  forecast: CloudSun,
  "up-next": ArrowRight,
  tasks: CheckSquare,
  sports: Trophy,
  news: Newspaper,
  "day-schedule": CalendarDays,
  "week-schedule": CalendarRange,
  countdown: Timer,
  text: Type,
  "photo-feed": Images,
};

const TYPE_COLORS: Record<ViewType, string> = {
  camera: "bg-blue-500/20 text-blue-400",
  map: "bg-green-500/20 text-green-400",
  media: "bg-emerald-500/20 text-emerald-400",
  calendar: "bg-purple-500/20 text-purple-400",
  image: "bg-pink-500/20 text-pink-400",
  weather: "bg-orange-500/20 text-orange-400",
  iptv: "bg-red-500/20 text-red-400",
  youtube: "bg-red-500/20 text-red-400",
  "ha-entity": "bg-cyan-500/20 text-cyan-400",
  "ha-gauge": "bg-amber-500/20 text-amber-400",
  "ha-graph": "bg-indigo-500/20 text-indigo-400",
  "ha-camera": "bg-sky-500/20 text-sky-400",
  clock: "bg-slate-500/20 text-slate-400",
  forecast: "bg-orange-500/20 text-orange-400",
  "up-next": "bg-violet-500/20 text-violet-400",
  tasks: "bg-teal-500/20 text-teal-400",
  sports: "bg-yellow-500/20 text-yellow-400",
  news: "bg-rose-500/20 text-rose-400",
  "day-schedule": "bg-purple-500/20 text-purple-400",
  "week-schedule": "bg-fuchsia-500/20 text-fuchsia-400",
  countdown: "bg-red-500/20 text-red-400",
  text: "bg-gray-500/20 text-gray-400",
  "photo-feed": "bg-pink-500/20 text-pink-400",
};

export function ViewThumbnail({
  item,
  isSelected,
  onClick,
  badge,
  disabled,
}: ViewThumbnailProps) {
  const Icon = TYPE_ICONS[item.type];
  const colorClass = TYPE_COLORS[item.type];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all duration-200",
        "flex flex-col items-center justify-center gap-1 p-2",
        disabled
          ? "opacity-50 cursor-not-allowed border-border bg-card"
          : "hover:ring-2 hover:ring-primary/50 hover:scale-105",
        !disabled &&
          (isSelected
            ? "border-primary ring-2 ring-primary/30 bg-primary/10"
            : "border-border hover:border-primary/50 bg-card")
      )}
      style={{ width: "100px", height: "75px" }}
    >
      {/* Icon */}
      <div
        className={cn(
          "flex items-center justify-center rounded-md p-1.5",
          colorClass
        )}
      >
        <Icon className="h-5 w-5" />
      </div>

      {/* Name */}
      <span className="text-[10px] font-medium text-foreground truncate w-full text-center leading-tight px-1">
        {item.name}
      </span>

      {/* Badge or selected indicator */}
      {badge ? (
        <div className="absolute top-1 left-1 px-1 py-0.5 rounded text-[9px] font-bold bg-primary text-primary-foreground leading-none">
          {badge}
        </div>
      ) : (
        isSelected && (
          <div className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
        )
      )}
    </button>
  );
}
