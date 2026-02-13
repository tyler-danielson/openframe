import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  QrCode,
  Timer,
  ChefHat,
} from "lucide-react";
import { api } from "../services/api";
import { Button } from "../components/ui/Button";
import { TimersSection } from "../components/kitchen/TimersSection";
import { RecipesSection } from "../components/kitchen/RecipesSection";
import { AddTimerModal } from "../components/kitchen/AddTimerModal";

export function KitchenPage() {
  const queryClient = useQueryClient();
  const [showTimerModal, setShowTimerModal] = useState(false);
  const [showAddRecipeModal, setShowAddRecipeModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  const startTimer = useMutation({
    mutationFn: (data: { name: string; durationSeconds: number }) =>
      api.startTimer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kitchen-active-timers"] });
    },
  });

  const createPreset = useMutation({
    mutationFn: (data: { name: string; durationSeconds: number }) =>
      api.createTimerPreset(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kitchen-timer-presets"] });
    },
  });

  const handleStartTimer = async (data: {
    name: string;
    durationSeconds: number;
    saveAsPreset: boolean;
  }) => {
    await startTimer.mutateAsync({
      name: data.name,
      durationSeconds: data.durationSeconds,
    });
    if (data.saveAsPreset) {
      await createPreset.mutateAsync({
        name: data.name,
        durationSeconds: data.durationSeconds,
      });
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <ChefHat className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Kitchen</h1>
              <p className="text-sm text-muted-foreground">
                Timers & Recipes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setShowTimerModal(true)}
            >
              <Timer className="h-4 w-4 mr-2" />
              Add Timer
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowQRModal(true)}
              className="hidden sm:flex"
            >
              <QrCode className="h-4 w-4 mr-2" />
              Snap Recipe
            </Button>
            <Button onClick={() => setShowAddRecipeModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Recipe
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-4 space-y-6">
        {/* Timers Section */}
        <TimersSection />

        {/* Recipes Section */}
        <div>
          <h2 className="text-sm font-semibold text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
            <ChefHat className="h-4 w-4" />
            Recipes
          </h2>
          <RecipesSection
            showAddModal={showAddRecipeModal}
            onShowAddModalChange={setShowAddRecipeModal}
            showQRModal={showQRModal}
            onShowQRModalChange={setShowQRModal}
          />
        </div>
      </main>

      {/* Add Timer Modal */}
      <AddTimerModal
        isOpen={showTimerModal}
        onClose={() => setShowTimerModal(false)}
        onStart={handleStartTimer}
      />
    </div>
  );
}
