import {
  Camera,
  MapPin,
  Music,
  Calendar,
  Image,
  Cloud,
} from "lucide-react";
import { cn } from "../../lib/utils";
import type { AvailableItem, ViewType } from "./types";

interface ViewThumbnailProps {
  item: AvailableItem;
  isSelected: boolean;
  onClick: () => void;
}

const TYPE_ICONS: Record<ViewType, React.ElementType> = {
  camera: Camera,
  map: MapPin,
  media: Music,
  calendar: Calendar,
  image: Image,
  weather: Cloud,
};

const TYPE_COLORS: Record<ViewType, string> = {
  camera: "bg-blue-500/20 text-blue-400",
  map: "bg-green-500/20 text-green-400",
  media: "bg-emerald-500/20 text-emerald-400",
  calendar: "bg-purple-500/20 text-purple-400",
  image: "bg-pink-500/20 text-pink-400",
  weather: "bg-orange-500/20 text-orange-400",
};

export function ViewThumbnail({
  item,
  isSelected,
  onClick,
}: ViewThumbnailProps) {
  const Icon = TYPE_ICONS[item.type];
  const colorClass = TYPE_COLORS[item.type];

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all duration-200",
        "hover:ring-2 hover:ring-primary/50 hover:scale-105",
        "flex flex-col items-center justify-center gap-1 p-2",
        isSelected
          ? "border-primary ring-2 ring-primary/30 bg-primary/10"
          : "border-border hover:border-primary/50 bg-card"
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

      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
      )}
    </button>
  );
}
