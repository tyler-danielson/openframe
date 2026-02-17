import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ChefHat, ArrowLeft, Clock, Users, Search } from "lucide-react";
import { api } from "../../../services/api";
import { Card } from "../../../components/ui/Card";
import { CompanionPageHeader } from "../components/CompanionPageHeader";

export function CompanionRecipesPage() {
  const [search, setSearch] = useState("");
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);

  const { data: recipes, isLoading } = useQuery({
    queryKey: ["companion-recipes"],
    queryFn: () => api.getRecipes(),
    staleTime: 120_000,
  });

  const { data: recipe, isLoading: recipeLoading } = useQuery({
    queryKey: ["companion-recipe", selectedRecipeId],
    queryFn: () => api.getRecipe(selectedRecipeId!),
    enabled: !!selectedRecipeId,
    staleTime: 120_000,
  });

  // Recipe detail view
  if (selectedRecipeId && recipe) {
    return (
      <div className="flex flex-col h-full">
        <CompanionPageHeader
          title={recipe.title}
          backTo="/companion/more/recipes"
        />
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {recipe.sourceImagePath && (
            <img
              src={api.getRecipeImageUrl(recipe.sourceImagePath)}
              alt={recipe.title}
              className="w-full h-48 rounded-xl object-cover"
            />
          )}

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {recipe.prepTime && (
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Prep: {recipe.prepTime}m
              </div>
            )}
            {recipe.cookTime && (
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Cook: {recipe.cookTime}m
              </div>
            )}
            {recipe.servings && (
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {recipe.servings} servings
              </div>
            )}
          </div>

          {recipe.description && (
            <p className="text-sm text-muted-foreground">{recipe.description}</p>
          )}

          {/* Ingredients */}
          {recipe.ingredients && recipe.ingredients.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-primary mb-2">Ingredients</h3>
              <Card className="p-4">
                <ul className="space-y-2">
                  {recipe.ingredients.map((ing: any, i: number) => (
                    <li key={i} className="text-sm text-foreground flex gap-2">
                      <span className="text-primary font-medium shrink-0">
                        {ing.amount} {ing.unit}
                      </span>
                      <span>{ing.name || ing.ingredient}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          )}

          {/* Instructions */}
          {recipe.instructions && recipe.instructions.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-primary mb-2">Instructions</h3>
              <div className="space-y-3">
                {recipe.instructions.map((step: string, i: number) => (
                  <Card key={i} className="p-4 flex gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">{i + 1}</span>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">{step}</p>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {recipe.notes && (
            <div>
              <h3 className="text-sm font-semibold text-primary mb-2">Notes</h3>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">{recipe.notes}</p>
              </Card>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Recipe detail loading
  if (selectedRecipeId && recipeLoading) {
    return (
      <div className="flex flex-col h-full">
        <CompanionPageHeader title="Recipe" />
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // Filtered recipes
  const filtered = (recipes || []).filter((r: any) =>
    search ? r.title.toLowerCase().includes(search.toLowerCase()) : true
  );

  return (
    <div className="flex flex-col h-full">
      <CompanionPageHeader title="Recipes" backTo="/companion/more" />

      {/* Search */}
      <div className="px-4 py-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recipes..."
            className="w-full rounded-xl border border-border bg-card pl-9 pr-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>
      </div>

      {/* Recipe list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ChefHat className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">{search ? "No matching recipes" : "No recipes yet"}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((r: any) => (
              <button
                key={r.id}
                onClick={() => setSelectedRecipeId(r.id)}
                className="text-left"
              >
                <Card className="overflow-hidden hover:bg-primary/5 transition-colors">
                  {r.thumbnailPath || r.sourceImagePath ? (
                    <img
                      src={api.getRecipeImageUrl(r.thumbnailPath || r.sourceImagePath!)}
                      alt={r.title}
                      className="w-full h-24 object-cover"
                    />
                  ) : (
                    <div className="w-full h-24 bg-primary/5 flex items-center justify-center">
                      <ChefHat className="h-8 w-8 text-primary/30" />
                    </div>
                  )}
                  <div className="p-2.5">
                    <div className="text-sm font-medium text-foreground line-clamp-2 leading-snug">
                      {r.title}
                    </div>
                    {(r.prepTime || r.cookTime) && (
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {(r.prepTime || 0) + (r.cookTime || 0)}m
                      </div>
                    )}
                  </div>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
