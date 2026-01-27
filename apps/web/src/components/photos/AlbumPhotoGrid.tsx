import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Trash2, RefreshCw, Image, Check, Plus, Cloud } from "lucide-react";
import { api } from "../../services/api";
import { Button } from "../ui/Button";
import { AddPhotosModal } from "./AddPhotosModal";
import { cn } from "../../lib/utils";
import type { Photo } from "@openframe/shared";

interface AlbumPhotoGridProps {
  albumId: string;
  albumName: string;
  onBack: () => void;
}

export function AlbumPhotoGrid({ albumId, albumName, onBack }: AlbumPhotoGridProps) {
  const queryClient = useQueryClient();
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ["album-photos", albumId],
    queryFn: () => api.getAlbumPhotos(albumId),
  });

  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);

  const deletePhotos = useMutation({
    mutationFn: async (photoIds: string[]) => {
      for (const id of photoIds) {
        await api.deletePhoto(id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["album-photos", albumId] });
      queryClient.invalidateQueries({ queryKey: ["photo-albums"] });
      setSelectedPhotos(new Set());
      setIsSelecting(false);
      setDeletingPhotoId(null);
    },
  });

  const handleDeleteSinglePhoto = (photoId: string) => {
    setDeletingPhotoId(photoId);
    deletePhotos.mutate([photoId]);
  };

  const handlePhotoClick = (photo: Photo) => {
    if (isSelecting) {
      setSelectedPhotos((prev) => {
        const next = new Set(prev);
        if (next.has(photo.id)) {
          next.delete(photo.id);
        } else {
          next.add(photo.id);
        }
        return next;
      });
    }
  };

  const handleSelectAll = () => {
    if (selectedPhotos.size === photos.length) {
      setSelectedPhotos(new Set());
    } else {
      setSelectedPhotos(new Set(photos.map((p) => p.id)));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedPhotos.size > 0) {
      deletePhotos.mutate(Array.from(selectedPhotos));
    }
  };

  const handleImportComplete = () => {
    queryClient.invalidateQueries({ queryKey: ["album-photos", albumId] });
    queryClient.invalidateQueries({ queryKey: ["photo-albums"] });
    queryClient.refetchQueries({ queryKey: ["photo-albums"] });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Albums
        </button>

        <h3 className="font-medium">{albumName}</h3>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Photos
          </Button>
          {photos.length > 0 && (
            <Button
              variant={isSelecting ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setIsSelecting(!isSelecting);
                setSelectedPhotos(new Set());
              }}
            >
              {isSelecting ? "Done" : "Select"}
            </Button>
          )}
        </div>
      </div>

      {/* Add Photos Modal */}
      <AddPhotosModal
        albumId={albumId}
        albumName={albumName}
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onImportComplete={handleImportComplete}
      />

      {/* Selection toolbar */}
      {isSelecting && photos.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleSelectAll}>
              {selectedPhotos.size === photos.length ? "Deselect All" : "Select All"}
            </Button>
            <span className="text-sm text-muted-foreground">
              {selectedPhotos.size} selected
            </span>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDeleteSelected}
            disabled={selectedPhotos.size === 0 || deletePhotos.isPending}
          >
            {deletePhotos.isPending ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Delete
          </Button>
        </div>
      )}

      {/* Photo grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading photos...</span>
        </div>
      ) : photos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <Image className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">No photos in this album</p>
          <p className="text-sm text-muted-foreground">
            Click "Add Photos" to upload from your device or import from Google Photos
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {photos.map((photo) => (
            <PhotoGridItem
              key={photo.id}
              photo={photo}
              isSelecting={isSelecting}
              isSelected={selectedPhotos.has(photo.id)}
              onClick={() => handlePhotoClick(photo)}
              onDelete={handleDeleteSinglePhoto}
              isDeleting={deletingPhotoId === photo.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface PhotoGridItemProps {
  photo: Photo;
  isSelecting: boolean;
  isSelected: boolean;
  onClick: () => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}

function PhotoGridItem({
  photo,
  isSelecting,
  isSelected,
  onClick,
  onDelete,
  isDeleting,
}: PhotoGridItemProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <div
      className={cn(
        "relative aspect-square rounded-lg overflow-hidden bg-muted transition-all group",
        isSelecting && "cursor-pointer",
        isSelected && "ring-2 ring-primary ring-offset-2"
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="h-full w-full"
      >
        <img
          src={photo.thumbnailUrl ?? photo.originalUrl}
          alt={photo.originalFilename}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </button>

      {/* Source indicator badge */}
      {photo.sourceType === "google" && !isSelecting && (
        <div className="absolute bottom-1 left-1 flex h-5 w-5 items-center justify-center rounded bg-black/60">
          <Cloud className="h-3 w-3 text-white" />
        </div>
      )}

      {/* Delete button - always visible for touch screens */}
      {!isSelecting && !showDeleteConfirm && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowDeleteConfirm(true);
          }}
          className="absolute top-1 right-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white active:bg-red-600"
          title="Delete photo"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}

      {/* Delete confirmation overlay */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2 p-2">
          <p className="text-white text-xs text-center">Delete this photo?</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(photo.id);
              }}
              disabled={isDeleting}
              className="px-3 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isDeleting ? "..." : "Delete"}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteConfirm(false);
              }}
              className="px-3 py-1 text-xs rounded bg-gray-600 text-white hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Selection indicator */}
      {isSelecting && (
        <div
          className={cn(
            "absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors",
            isSelected
              ? "bg-primary border-primary"
              : "bg-white/80 border-white"
          )}
        >
          {isSelected && <Check className="h-4 w-4 text-white" />}
        </div>
      )}
    </div>
  );
}
