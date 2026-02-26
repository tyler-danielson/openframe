import { useMemo } from "react";
import { cn } from "../../lib/utils";
import { getPhotoUrl } from "../../services/api";
import type { Photo } from "@openframe/shared";

export type LayoutType = "grid" | "artboard" | "masonry" | "collage";

interface PhotoLayoutsProps {
  photos: Photo[];
  layout: LayoutType;
  onPhotoClick: (photo: Photo) => void;
}

interface PhotoItemProps {
  photo: Photo;
  onClick: () => void;
  className?: string;
  objectFit?: "cover" | "contain";
}

function PhotoItem({ photo, onClick, className, objectFit = "cover" }: PhotoItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-lg bg-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all",
        className
      )}
    >
      <img
        src={getPhotoUrl(photo.originalUrl)}
        alt={photo.originalFilename}
        className={cn(
          "h-full w-full transition-transform group-hover:scale-105",
          objectFit === "cover" ? "object-cover" : "object-contain"
        )}
      />
    </button>
  );
}

// Grid Layout - Uniform square tiles
function GridLayout({ photos, onPhotoClick }: Omit<PhotoLayoutsProps, "layout">) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {photos.map((photo) => (
        <PhotoItem
          key={photo.id}
          photo={photo}
          onClick={() => onPhotoClick(photo)}
          className="aspect-square"
          objectFit="cover"
        />
      ))}
    </div>
  );
}

// Artboard Layout - Clean gallery with natural aspect ratios on a canvas feel
function ArtboardLayout({ photos, onPhotoClick }: Omit<PhotoLayoutsProps, "layout">) {
  return (
    <div className="bg-black/5 dark:bg-white/5 rounded-2xl p-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
        {photos.map((photo) => {
          const aspectRatio = (photo.width && photo.height)
            ? photo.width / photo.height
            : 1;

          return (
            <button
              key={photo.id}
              onClick={() => onPhotoClick(photo)}
              className="group relative bg-card rounded-xl shadow-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all hover:shadow-xl hover:-translate-y-1"
            >
              <div
                className="relative w-full"
                style={{ paddingBottom: `${(1 / aspectRatio) * 100}%` }}
              >
                <img
                  src={getPhotoUrl(photo.originalUrl)}
                  alt={photo.originalFilename}
                  className="absolute inset-0 h-full w-full object-contain bg-black/5 dark:bg-white/5"
                />
              </div>
              <div className="p-3 border-t border-border">
                <p className="text-xs text-muted-foreground truncate">
                  {photo.originalFilename}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Masonry Layout - Pinterest-style staggered columns
function MasonryLayout({ photos, onPhotoClick }: Omit<PhotoLayoutsProps, "layout">) {
  const columns = useMemo(() => {
    // Distribute photos into 4 columns based on accumulated height
    const cols: Photo[][] = [[], [], [], []];
    const heights = [0, 0, 0, 0];

    photos.forEach((photo) => {
      const aspectRatio = (photo.width && photo.height)
        ? photo.width / photo.height
        : 1;
      const height = 1 / aspectRatio;

      // Find the shortest column
      const shortestCol = heights.indexOf(Math.min(...heights));
      cols[shortestCol]?.push(photo);
      heights[shortestCol] = (heights[shortestCol] ?? 0) + height;
    });

    return cols;
  }, [photos]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {columns.map((column, colIndex) => (
        <div key={colIndex} className="flex flex-col gap-3">
          {column.map((photo) => {
            const aspectRatio = (photo.width && photo.height)
              ? photo.width / photo.height
              : 1;

            return (
              <button
                key={photo.id}
                onClick={() => onPhotoClick(photo)}
                className="group relative overflow-hidden rounded-lg bg-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all"
                style={{ aspectRatio: aspectRatio.toString() }}
              >
                <img
                  src={getPhotoUrl(photo.originalUrl)}
                  alt={photo.originalFilename}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// Collage Layout - Mixed sizes with featured photos
function CollageLayout({ photos, onPhotoClick }: Omit<PhotoLayoutsProps, "layout">) {
  // Create collage patterns that repeat
  const renderCollageGroup = (groupPhotos: Photo[], groupIndex: number) => {
    const pattern = groupIndex % 4;

    switch (pattern) {
      case 0:
        // Pattern: One large left, two stacked right
        return (
          <div className="grid grid-cols-3 gap-3" key={groupIndex}>
            {groupPhotos[0] && (
              <PhotoItem
                photo={groupPhotos[0]}
                onClick={() => onPhotoClick(groupPhotos[0]!)}
                className="col-span-2 row-span-2 aspect-square"
              />
            )}
            {groupPhotos[1] && (
              <PhotoItem
                photo={groupPhotos[1]}
                onClick={() => onPhotoClick(groupPhotos[1]!)}
                className="aspect-square"
              />
            )}
            {groupPhotos[2] && (
              <PhotoItem
                photo={groupPhotos[2]}
                onClick={() => onPhotoClick(groupPhotos[2]!)}
                className="aspect-square"
              />
            )}
          </div>
        );

      case 1:
        // Pattern: Three equal columns
        return (
          <div className="grid grid-cols-3 gap-3" key={groupIndex}>
            {groupPhotos.slice(0, 3).map((photo) => (
              <PhotoItem
                key={photo.id}
                photo={photo}
                onClick={() => onPhotoClick(photo)}
                className="aspect-[3/4]"
              />
            ))}
          </div>
        );

      case 2:
        // Pattern: Two stacked left, one large right
        return (
          <div className="grid grid-cols-3 gap-3" key={groupIndex}>
            {groupPhotos[0] && (
              <PhotoItem
                photo={groupPhotos[0]}
                onClick={() => onPhotoClick(groupPhotos[0]!)}
                className="aspect-square"
              />
            )}
            {groupPhotos[1] && (
              <PhotoItem
                photo={groupPhotos[1]}
                onClick={() => onPhotoClick(groupPhotos[1]!)}
                className="col-span-2 row-span-2 aspect-square"
              />
            )}
            {groupPhotos[2] && (
              <PhotoItem
                photo={groupPhotos[2]}
                onClick={() => onPhotoClick(groupPhotos[2]!)}
                className="aspect-square"
              />
            )}
          </div>
        );

      case 3:
        // Pattern: One wide top, two below
        return (
          <div className="grid grid-cols-2 gap-3" key={groupIndex}>
            {groupPhotos[0] && (
              <PhotoItem
                photo={groupPhotos[0]}
                onClick={() => onPhotoClick(groupPhotos[0]!)}
                className="col-span-2 aspect-[2/1]"
              />
            )}
            {groupPhotos[1] && (
              <PhotoItem
                photo={groupPhotos[1]}
                onClick={() => onPhotoClick(groupPhotos[1]!)}
                className="aspect-square"
              />
            )}
            {groupPhotos[2] && (
              <PhotoItem
                photo={groupPhotos[2]}
                onClick={() => onPhotoClick(groupPhotos[2]!)}
                className="aspect-square"
              />
            )}
          </div>
        );

      default:
        return null;
    }
  };

  // Split photos into groups of 3
  const groups: Photo[][] = [];
  for (let i = 0; i < photos.length; i += 3) {
    groups.push(photos.slice(i, i + 3));
  }

  return (
    <div className="space-y-3">
      {groups.map((group, index) => renderCollageGroup(group, index))}
    </div>
  );
}

export function PhotoLayouts({ photos, layout, onPhotoClick }: PhotoLayoutsProps) {
  switch (layout) {
    case "grid":
      return <GridLayout photos={photos} onPhotoClick={onPhotoClick} />;
    case "artboard":
      return <ArtboardLayout photos={photos} onPhotoClick={onPhotoClick} />;
    case "masonry":
      return <MasonryLayout photos={photos} onPhotoClick={onPhotoClick} />;
    case "collage":
      return <CollageLayout photos={photos} onPhotoClick={onPhotoClick} />;
    default:
      return <GridLayout photos={photos} onPhotoClick={onPhotoClick} />;
  }
}

// Layout selector component
interface LayoutSelectorProps {
  value: LayoutType;
  onChange: (layout: LayoutType) => void;
}

const layouts: { value: LayoutType; label: string; icon: string }[] = [
  { value: "grid", label: "Grid", icon: "▦" },
  { value: "artboard", label: "Artboard", icon: "▢" },
  { value: "masonry", label: "Masonry", icon: "▥" },
  { value: "collage", label: "Collage", icon: "▧" },
];

export function LayoutSelector({ value, onChange }: LayoutSelectorProps) {
  return (
    <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
      {layouts.map((layout) => (
        <button
          key={layout.value}
          onClick={() => onChange(layout.value)}
          className={cn(
            "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
            value === layout.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          title={layout.label}
        >
          <span className="mr-1.5">{layout.icon}</span>
          <span className="hidden sm:inline">{layout.label}</span>
        </button>
      ))}
    </div>
  );
}
