import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, RefreshCw, Image, Check, Folder } from "lucide-react";
import { api } from "../../services/api";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";
import type { Photo, PhotoAlbum } from "@openframe/shared";

interface PhotoWithAlbum extends Photo {
  albumName: string;
}

export function ManageAllPhotos() {
  const queryClient = useQueryClient();
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);

  // Fetch all albums
  const { data: albums = [], isLoading: loadingAlbums } = useQuery({
    queryKey: ["photo-albums"],
    queryFn: () => api.getAlbums(),
  });

  // Fetch photos for each album
  const { data: allPhotos = [], isLoading: loadingPhotos } = useQuery({
    queryKey: ["all-photos", albums.map((a) => a.id).join(",")],
    queryFn: async () => {
      const photoPromises = albums.map(async (album) => {
        const photos = await api.getAlbumPhotos(album.id);
        return photos.map((photo) => ({
          ...photo,
          albumName: album.name,
        }));
      });
      const results = await Promise.all(photoPromises);
      return results.flat();
    },
    enabled: albums.length > 0,
  });

  const deletePhotos = useMutation({
    mutationFn: async (photoIds: string[]) => {
      for (const id of photoIds) {
        await api.deletePhoto(id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-photos"] });
      queryClient.invalidateQueries({ queryKey: ["photo-albums"] });
      queryClient.invalidateQueries({ queryKey: ["album-photos"] });
      setSelectedPhotos(new Set());
      setIsSelecting(false);
    },
  });

  const handlePhotoClick = (photo: PhotoWithAlbum) => {
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
    if (selectedPhotos.size === allPhotos.length) {
      setSelectedPhotos(new Set());
    } else {
      setSelectedPhotos(new Set(allPhotos.map((p) => p.id)));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedPhotos.size > 0) {
      deletePhotos.mutate(Array.from(selectedPhotos));
    }
  };

  const isLoading = loadingAlbums || loadingPhotos;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading photos...</span>
      </div>
    );
  }

  if (allPhotos.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <Image className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">No photos uploaded</p>
        <p className="text-sm text-muted-foreground">
          Upload photos using the Local Photos section above
        </p>
      </div>
    );
  }

  // Group photos by album for display
  const photosByAlbum = allPhotos.reduce<Record<string, PhotoWithAlbum[]>>((acc, photo) => {
    const albumPhotos = acc[photo.albumName] ?? [];
    albumPhotos.push(photo);
    acc[photo.albumName] = albumPhotos;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Header with select/delete controls */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {allPhotos.length} photo{allPhotos.length !== 1 ? "s" : ""} total
        </p>
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
      </div>

      {/* Selection toolbar */}
      {isSelecting && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleSelectAll}>
              {selectedPhotos.size === allPhotos.length ? "Deselect All" : "Select All"}
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
            Delete ({selectedPhotos.size})
          </Button>
        </div>
      )}

      {/* Photos grouped by album */}
      <div className="space-y-6">
        {Object.entries(photosByAlbum).map(([albumName, photos]) => (
          <div key={albumName}>
            <div className="flex items-center gap-2 mb-2">
              <Folder className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{albumName}</span>
              <span className="text-xs text-muted-foreground">
                ({photos.length} photo{photos.length !== 1 ? "s" : ""})
              </span>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => handlePhotoClick(photo)}
                  className={cn(
                    "relative aspect-square rounded-lg overflow-hidden bg-muted transition-all",
                    isSelecting && "cursor-pointer hover:ring-2 hover:ring-primary/50",
                    selectedPhotos.has(photo.id) && "ring-2 ring-primary ring-offset-2"
                  )}
                >
                  <img
                    src={photo.thumbnailUrl ?? photo.originalUrl}
                    alt={photo.originalFilename}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />

                  {/* Selection indicator */}
                  {isSelecting && (
                    <div
                      className={cn(
                        "absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors",
                        selectedPhotos.has(photo.id)
                          ? "bg-primary border-primary"
                          : "bg-white/80 border-white"
                      )}
                    >
                      {selectedPhotos.has(photo.id) && (
                        <Check className="h-3 w-3 text-white" />
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
