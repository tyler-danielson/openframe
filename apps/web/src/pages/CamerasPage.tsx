import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Camera, RefreshCw, Grid, LayoutGrid } from "lucide-react";
import { api } from "../services/api";
import { Button } from "../components/ui/Button";
import { CameraFeed } from "../components/cameras/CameraFeed";
import { AddCameraModal } from "../components/cameras/AddCameraModal";
import { cn } from "../lib/utils";
import type { Camera as CameraType } from "@openframe/shared";

type GridSize = 1 | 2 | 3 | 4;

export function CamerasPage() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [fullscreenCameraId, setFullscreenCameraId] = useState<string | null>(null);
  const [gridSize, setGridSize] = useState<GridSize>(2);

  // Fetch cameras
  const { data: cameras = [], isLoading } = useQuery({
    queryKey: ["cameras"],
    queryFn: () => api.getCameras(),
  });

  // Add camera mutation
  const addCameraMutation = useMutation({
    mutationFn: api.createCamera.bind(api),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cameras"] });
    },
  });

  // Delete camera mutation
  const deleteCameraMutation = useMutation({
    mutationFn: api.deleteCamera.bind(api),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cameras"] });
    },
  });

  const handleDeleteCamera = (camera: CameraType) => {
    if (confirm(`Delete camera "${camera.name}"?`)) {
      deleteCameraMutation.mutate(camera.id);
    }
  };

  const gridColsClass = {
    1: "grid-cols-1",
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
  }[gridSize];

  // No cameras state
  if (cameras.length === 0 && !isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <Camera className="h-10 w-10 text-primary" />
        </div>
        <h2 className="mt-6 text-2xl font-semibold">No Cameras</h2>
        <p className="mt-2 text-center text-muted-foreground">
          Add your first IP camera to start monitoring.
        </p>
        <Button onClick={() => setShowAddModal(true)} className="mt-6">
          <Plus className="mr-2 h-4 w-4" />
          Add Camera
        </Button>
        <AddCameraModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSubmit={async (data) => { await addCameraMutation.mutateAsync(data); }}
        />
      </div>
    );
  }

  // Fullscreen camera view
  if (fullscreenCameraId) {
    const camera = cameras.find((c) => c.id === fullscreenCameraId);
    if (camera) {
      return (
        <CameraFeed
          camera={camera}
          isFullscreen
          onToggleFullscreen={() => setFullscreenCameraId(null)}
        />
      );
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <h1 className="text-xl font-semibold">Cameras</h1>

        <div className="flex items-center gap-3">
          {/* Grid size selector */}
          <div className="flex items-center gap-1 rounded-md border border-border p-1">
            {([1, 2, 3, 4] as GridSize[]).map((size) => (
              <button
                key={size}
                onClick={() => setGridSize(size)}
                className={cn(
                  "rounded px-2 py-1 text-xs font-medium transition-colors",
                  gridSize === size
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {size}x
              </button>
            ))}
          </div>

          {/* Refresh all */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["cameras"] })}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>

          {/* Add camera */}
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Camera
          </Button>
        </div>
      </header>

      {/* Camera grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className={cn("grid gap-4", gridColsClass)}>
            {cameras
              .filter((c) => c.isEnabled)
              .map((camera) => (
                <CameraFeed
                  key={camera.id}
                  camera={camera}
                  onEdit={() => {
                    // TODO: Edit camera modal
                  }}
                  onDelete={() => handleDeleteCamera(camera)}
                  onToggleFullscreen={() => setFullscreenCameraId(camera.id)}
                />
              ))}
          </div>
        )}
      </div>

      {/* Add camera modal */}
      <AddCameraModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={async (data) => { await addCameraMutation.mutateAsync(data); }}
      />
    </div>
  );
}
