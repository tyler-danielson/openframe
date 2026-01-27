import { Star, History, Layers, Folder } from "lucide-react";
import { cn } from "../../lib/utils";
import type { IptvCategory } from "@openframe/shared";

interface CategorySidebarProps {
  categories: IptvCategory[];
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string | null) => void;
  specialViews: {
    favorites: boolean;
    history: boolean;
  };
  onSelectSpecialView: (view: "all" | "favorites" | "history") => void;
  activeSpecialView: "all" | "favorites" | "history" | null;
}

export function CategorySidebar({
  categories,
  selectedCategoryId,
  onSelectCategory,
  specialViews,
  onSelectSpecialView,
  activeSpecialView,
}: CategorySidebarProps) {
  return (
    <div className="flex h-full w-56 flex-col border-r border-border bg-card">
      <div className="border-b border-border p-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Categories</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {/* Special views */}
        <div className="mb-2 space-y-1">
          <SidebarItem
            icon={Layers}
            label="All Channels"
            isActive={activeSpecialView === "all"}
            onClick={() => onSelectSpecialView("all")}
          />
          {specialViews.favorites && (
            <SidebarItem
              icon={Star}
              label="Favorites"
              isActive={activeSpecialView === "favorites"}
              onClick={() => onSelectSpecialView("favorites")}
            />
          )}
          {specialViews.history && (
            <SidebarItem
              icon={History}
              label="Recently Watched"
              isActive={activeSpecialView === "history"}
              onClick={() => onSelectSpecialView("history")}
            />
          )}
        </div>

        {/* Divider */}
        {categories.length > 0 && (
          <div className="my-2 border-t border-border" />
        )}

        {/* Categories */}
        <div className="space-y-1">
          {categories.map((category) => (
            <SidebarItem
              key={category.id}
              icon={Folder}
              label={category.name}
              count={category.channelCount}
              isActive={selectedCategoryId === category.id && !activeSpecialView}
              onClick={() => {
                onSelectCategory(category.id);
                onSelectSpecialView("all"); // Clear special view when selecting category
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface SidebarItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count?: number;
  isActive: boolean;
  onClick: () => void;
}

function SidebarItem({ icon: Icon, label, count, isActive, onClick }: SidebarItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-foreground hover:bg-muted"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate text-left">{label}</span>
      {count !== undefined && (
        <span
          className={cn(
            "text-xs",
            isActive ? "text-primary-foreground/70" : "text-muted-foreground"
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
