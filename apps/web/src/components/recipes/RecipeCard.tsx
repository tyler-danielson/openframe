import { Star, Clock, Users } from "lucide-react";
import type { Recipe } from "@openframe/shared";
import { cn } from "../../lib/utils";

interface RecipeCardProps {
  recipe: Recipe;
  onClick: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
}

export function RecipeCard({ recipe, onClick, onToggleFavorite }: RecipeCardProps) {
  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);

  return (
    <div
      onClick={onClick}
      className="group relative bg-card border border-border rounded-xl overflow-hidden cursor-pointer hover:border-primary/50 transition-all hover:shadow-lg"
    >
      {/* Thumbnail */}
      <div className="aspect-[4/3] bg-accent relative overflow-hidden">
        {recipe.thumbnailPath ? (
          <img
            src={`/api/v1/recipes/image/${recipe.thumbnailPath}`}
            alt={recipe.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <span className="text-4xl">🍽️</span>
          </div>
        )}

        {/* Favorite button */}
        <button
          onClick={onToggleFavorite}
          className={cn(
            "absolute top-2 right-2 p-2 rounded-full backdrop-blur-sm transition-colors",
            recipe.isFavorite
              ? "bg-yellow-500/20 text-yellow-500"
              : "bg-black/30 text-white/70 hover:text-white"
          )}
        >
          <Star
            className={cn("h-5 w-5", recipe.isFavorite && "fill-current")}
          />
        </button>
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-semibold text-foreground line-clamp-1 mb-1">
          {recipe.title}
        </h3>

        {recipe.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {recipe.description}
          </p>
        )}

        {/* Meta info */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {totalTime > 0 && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{totalTime} min</span>
            </div>
          )}
          {recipe.servings && (
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>{recipe.servings}</span>
            </div>
          )}
        </div>

        {/* Tags */}
        {recipe.tags && recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {recipe.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 text-xs bg-accent rounded-full text-muted-foreground"
              >
                {tag}
              </span>
            ))}
            {recipe.tags.length > 3 && (
              <span className="px-2 py-0.5 text-xs bg-accent rounded-full text-muted-foreground">
                +{recipe.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
