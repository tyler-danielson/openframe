import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  QrCode,
  Search,
  Star,
  Loader2,
  Filter,
} from "lucide-react";
import { api } from "../../services/api";
import { Button } from "../ui/Button";
import { RecipeCard } from "../recipes/RecipeCard";
import { RecipeViewer } from "../recipes/RecipeViewer";
import { QRRecipeUpload } from "../recipes/QRRecipeUpload";
import { AddRecipeModal } from "../recipes/AddRecipeModal";
import type { Recipe } from "@openframe/shared";

interface RecipesSectionProps {
  showAddModal: boolean;
  onShowAddModalChange: (show: boolean) => void;
  showQRModal: boolean;
  onShowQRModalChange: (show: boolean) => void;
}

export function RecipesSection({
  showAddModal,
  onShowAddModalChange,
  showQRModal,
  onShowQRModalChange,
}: RecipesSectionProps) {
  const queryClient = useQueryClient();
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Fetch recipes
  const { data: recipes = [], isLoading } = useQuery({
    queryKey: ["recipes", showFavoritesOnly, selectedTag],
    queryFn: () =>
      api.getRecipes({
        favorite: showFavoritesOnly || undefined,
        tag: selectedTag || undefined,
      }),
  });

  // Fetch tags
  const { data: allTags = [] } = useQuery({
    queryKey: ["recipe-tags"],
    queryFn: () => api.getRecipeTags(),
  });

  // Create recipe mutation
  const createRecipe = useMutation({
    mutationFn: (data: Parameters<typeof api.createRecipe>[0]) =>
      api.createRecipe(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      queryClient.invalidateQueries({ queryKey: ["recipe-tags"] });
    },
  });

  // Update recipe mutation
  const updateRecipe = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof api.updateRecipe>[1];
    }) => api.updateRecipe(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      queryClient.invalidateQueries({ queryKey: ["recipe-tags"] });
    },
  });

  // Delete recipe mutation
  const deleteRecipe = useMutation({
    mutationFn: (id: string) => api.deleteRecipe(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
      queryClient.invalidateQueries({ queryKey: ["recipe-tags"] });
      setSelectedRecipe(null);
    },
  });

  // Toggle favorite mutation
  const toggleFavorite = useMutation({
    mutationFn: (id: string) => api.toggleRecipeFavorite(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recipes"] });
    },
  });

  // Filter recipes by search query
  const filteredRecipes = recipes.filter((recipe) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      recipe.title.toLowerCase().includes(query) ||
      recipe.description?.toLowerCase().includes(query) ||
      recipe.tags?.some((tag) => tag.toLowerCase().includes(query))
    );
  });

  const handleCreateRecipe = async (data: Partial<Recipe>) => {
    await createRecipe.mutateAsync(data as Parameters<typeof api.createRecipe>[0]);
  };

  const handleUpdateRecipe = async (data: Partial<Recipe>) => {
    if (!editingRecipe) return;
    await updateRecipe.mutateAsync({ id: editingRecipe.id, data });
    setEditingRecipe(null);
    if (selectedRecipe?.id === editingRecipe.id) {
      const updated = await api.getRecipe(editingRecipe.id);
      setSelectedRecipe(updated);
    }
  };

  const handleToggleFavorite = async (recipe: Recipe, e?: React.MouseEvent) => {
    e?.stopPropagation();
    await toggleFavorite.mutateAsync(recipe.id);
    if (selectedRecipe?.id === recipe.id) {
      setSelectedRecipe({ ...selectedRecipe, isFavorite: !selectedRecipe.isFavorite });
    }
  };

  return (
    <>
      {/* Search and Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search recipes..."
            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          />
        </div>

        {/* Favorites filter */}
        <button
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
            showFavoritesOnly
              ? "bg-yellow-500/10 border-yellow-500/50 text-yellow-500"
              : "border-border text-muted-foreground hover:bg-accent"
          }`}
        >
          <Star
            className={`h-4 w-4 ${showFavoritesOnly ? "fill-current" : ""}`}
          />
          <span className="text-sm">Favorites</span>
        </button>

        {/* Tag filter */}
        {allTags.length > 0 && (
          <div className="relative">
            <select
              value={selectedTag || ""}
              onChange={(e) => setSelectedTag(e.target.value || null)}
              className="appearance-none pl-3 pr-8 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
            >
              <option value="">All tags</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
            <Filter className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
        )}

        {/* Mobile QR button */}
        <button
          onClick={() => onShowQRModalChange(true)}
          className="sm:hidden p-2 rounded-lg border border-border text-muted-foreground hover:bg-accent"
        >
          <QrCode className="h-5 w-5" />
        </button>
      </div>

      {/* Recipes Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredRecipes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-6xl mb-4">🍽️</div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            {searchQuery || showFavoritesOnly || selectedTag
              ? "No recipes found"
              : "No recipes yet"}
          </h2>
          <p className="text-muted-foreground mb-6 max-w-sm">
            {searchQuery || showFavoritesOnly || selectedTag
              ? "Try adjusting your filters or search terms"
              : "Add your first recipe by snapping a photo or entering it manually"}
          </p>
          {!searchQuery && !showFavoritesOnly && !selectedTag && (
            <div className="flex flex-col sm:flex-row gap-3">
              <Button variant="outline" onClick={() => onShowQRModalChange(true)}>
                <QrCode className="h-4 w-4 mr-2" />
                Snap a Recipe
              </Button>
              <Button onClick={() => onShowAddModalChange(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Manually
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredRecipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onClick={() => setSelectedRecipe(recipe)}
              onToggleFavorite={(e) => handleToggleFavorite(recipe, e)}
            />
          ))}
        </div>
      )}

      {/* Recipe Viewer */}
      {selectedRecipe && (
        <RecipeViewer
          recipe={selectedRecipe}
          onClose={() => setSelectedRecipe(null)}
          onEdit={() => {
            setEditingRecipe(selectedRecipe);
            setSelectedRecipe(null);
          }}
          onDelete={() => deleteRecipe.mutate(selectedRecipe.id)}
          onToggleFavorite={() => handleToggleFavorite(selectedRecipe)}
        />
      )}

      {/* Add/Edit Recipe Modal */}
      <AddRecipeModal
        isOpen={showAddModal || !!editingRecipe}
        onClose={() => {
          onShowAddModalChange(false);
          setEditingRecipe(null);
        }}
        onSave={editingRecipe ? handleUpdateRecipe : handleCreateRecipe}
        initialData={editingRecipe}
      />

      {/* QR Upload Modal */}
      <QRRecipeUpload
        isOpen={showQRModal}
        onClose={() => onShowQRModalChange(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["recipes"] });
          queryClient.invalidateQueries({ queryKey: ["recipe-tags"] });
        }}
      />
    </>
  );
}
