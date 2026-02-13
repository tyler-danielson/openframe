import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  X,
  Star,
  Clock,
  Users,
  Edit2,
  Trash2,
  ChevronLeft,
  ExternalLink,
  Timer,
} from "lucide-react";
import type { Recipe, RecipeIngredient } from "@openframe/shared";
import { api } from "../../services/api";
import { Button } from "../ui/Button";
import { useToast } from "../ui/Toaster";
import { cn } from "../../lib/utils";

interface RecipeViewerProps {
  recipe: Recipe;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}

export function RecipeViewer({
  recipe,
  onClose,
  onEdit,
  onDelete,
  onToggleFavorite,
}: RecipeViewerProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const startTimerMutation = useMutation({
    mutationFn: (data: { name: string; durationSeconds: number }) =>
      api.startTimer(data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["kitchen-active-timers"] });
      toast({ title: `Timer "${variables.name}" started!`, type: "success" });
    },
  });

  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);

  const toggleIngredient = (index: number) => {
    const newChecked = new Set(checkedIngredients);
    if (newChecked.has(index)) {
      newChecked.delete(index);
    } else {
      newChecked.add(index);
    }
    setCheckedIngredients(newChecked);
  };

  const toggleStep = (index: number) => {
    const newChecked = new Set(checkedSteps);
    if (newChecked.has(index)) {
      newChecked.delete(index);
    } else {
      newChecked.add(index);
    }
    setCheckedSteps(newChecked);
  };

  const formatIngredient = (ing: RecipeIngredient): string => {
    const parts = [];
    if (ing.amount) parts.push(ing.amount);
    if (ing.unit) parts.push(ing.unit);
    parts.push(ing.name);
    return parts.join(" ");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-card border border-border rounded-2xl w-full max-w-3xl my-8 mx-4 overflow-hidden">
        {/* Header Image */}
        {recipe.sourceImagePath && (
          <div className="relative h-64 bg-accent">
            <img
              src={`/api/v1/recipes/image/${recipe.sourceImagePath}`}
              alt={recipe.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-2 rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        {/* Actions */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <button
            onClick={onToggleFavorite}
            className={cn(
              "p-2 rounded-full backdrop-blur-sm transition-colors",
              recipe.isFavorite
                ? "bg-yellow-500/20 text-yellow-500"
                : "bg-black/50 text-white hover:bg-black/70"
            )}
          >
            <Star
              className={cn("h-5 w-5", recipe.isFavorite && "fill-current")}
            />
          </button>
          <button
            onClick={onEdit}
            className="p-2 rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 transition-colors"
          >
            <Edit2 className="h-5 w-5" />
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-destructive transition-colors"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Title */}
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {recipe.title}
          </h1>

          {recipe.description && (
            <p className="text-muted-foreground mb-4">{recipe.description}</p>
          )}

          {/* Meta info */}
          <div className="flex flex-wrap items-center gap-4 mb-6 text-sm">
            {recipe.prepTime && recipe.prepTime > 0 && (
              <div className="flex items-center gap-1 bg-accent rounded-full">
                <div className="flex items-center gap-1.5 px-3 py-1.5">
                  <Clock className="h-4 w-4 text-primary" />
                  <span>Prep: {recipe.prepTime} min</span>
                </div>
                <button
                  onClick={() =>
                    startTimerMutation.mutate({
                      name: `${recipe.title} - Prep`,
                      durationSeconds: recipe.prepTime! * 60,
                    })
                  }
                  className="flex items-center gap-1 px-2 py-1.5 rounded-full hover:bg-primary/10 text-primary transition-colors"
                  title="Start prep timer"
                >
                  <Timer className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {recipe.cookTime && recipe.cookTime > 0 && (
              <div className="flex items-center gap-1 bg-accent rounded-full">
                <div className="flex items-center gap-1.5 px-3 py-1.5">
                  <Clock className="h-4 w-4 text-primary" />
                  <span>Cook: {recipe.cookTime} min</span>
                </div>
                <button
                  onClick={() =>
                    startTimerMutation.mutate({
                      name: `${recipe.title} - Cook`,
                      durationSeconds: recipe.cookTime! * 60,
                    })
                  }
                  className="flex items-center gap-1 px-2 py-1.5 rounded-full hover:bg-primary/10 text-primary transition-colors"
                  title="Start cook timer"
                >
                  <Timer className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {totalTime > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-full font-medium">
                <Clock className="h-4 w-4" />
                <span>Total: {totalTime} min</span>
              </div>
            )}
            {recipe.servings && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-accent rounded-full">
                <Users className="h-4 w-4 text-primary" />
                <span>{recipe.servings} servings</span>
              </div>
            )}
          </div>

          {/* Tags */}
          {recipe.tags && recipe.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {recipe.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 text-sm bg-accent rounded-full text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            {/* Ingredients */}
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-xl">🥗</span> Ingredients
              </h2>
              <div className="space-y-2">
                {recipe.ingredients && recipe.ingredients.length > 0 ? (
                  recipe.ingredients.map((ing, index) => (
                    <label
                      key={index}
                      className="flex items-start gap-3 cursor-pointer group"
                    >
                      <input
                        type="checkbox"
                        checked={checkedIngredients.has(index)}
                        onChange={() => toggleIngredient(index)}
                        className="mt-1 rounded border-border"
                      />
                      <span
                        className={cn(
                          "text-sm transition-colors",
                          checkedIngredients.has(index)
                            ? "text-muted-foreground line-through"
                            : "text-foreground"
                        )}
                      >
                        {formatIngredient(ing)}
                      </span>
                    </label>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No ingredients listed
                  </p>
                )}
              </div>
            </div>

            {/* Instructions */}
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="text-xl">📝</span> Instructions
              </h2>
              <div className="space-y-3">
                {recipe.instructions && recipe.instructions.length > 0 ? (
                  recipe.instructions.map((step, index) => (
                    <label
                      key={index}
                      className="flex items-start gap-3 cursor-pointer group"
                    >
                      <div
                        className={cn(
                          "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-colors",
                          checkedSteps.has(index)
                            ? "bg-primary text-primary-foreground"
                            : "bg-accent text-muted-foreground"
                        )}
                        onClick={() => toggleStep(index)}
                      >
                        {index + 1}
                      </div>
                      <span
                        className={cn(
                          "text-sm transition-colors flex-1",
                          checkedSteps.has(index)
                            ? "text-muted-foreground line-through"
                            : "text-foreground"
                        )}
                      >
                        {step}
                      </span>
                    </label>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No instructions listed
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          {recipe.notes && (
            <div className="mt-6 p-4 bg-accent/50 rounded-lg">
              <h2 className="text-sm font-semibold text-foreground mb-2">
                Notes
              </h2>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {recipe.notes}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div className="relative bg-card border border-border rounded-xl p-6 max-w-sm">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Delete Recipe?
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to delete "{recipe.title}"? This action
              cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  onDelete();
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
