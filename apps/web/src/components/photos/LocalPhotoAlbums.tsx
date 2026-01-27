import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Folder, Plus, Trash2, Image, Check, RefreshCw } from "lucide-react";
import { api } from "../../services/api";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";
import type { PhotoAlbum } from "@openframe/shared";

interface LocalPhotoAlbumsProps {
  onSelectAlbum: (albumId: string) => void;
}

export function LocalPhotoAlbums({ onSelectAlbum }: LocalPhotoAlbumsProps) {
  const queryClient = useQueryClient();
  const [newAlbumName, setNewAlbumName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: albums = [], isLoading } = useQuery({
    queryKey: ["photo-albums"],
    queryFn: () => api.getAlbums(),
  });

  const createAlbum = useMutation({
    mutationFn: (name: string) => api.createAlbum({ name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["photo-albums"] });
      setNewAlbumName("");
      setIsCreating(false);
    },
  });

  const updateAlbum = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { isActive?: boolean } }) =>
      api.updateAlbum(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["photo-albums"] });
    },
  });

  const deleteAlbum = useMutation({
    mutationFn: (id: string) => api.deleteAlbum(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["photo-albums"] });
      setDeleteConfirm(null);
    },
  });

  const handleCreateAlbum = () => {
    if (newAlbumName.trim()) {
      createAlbum.mutate(newAlbumName.trim());
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading albums...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Create new album */}
      {isCreating ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={newAlbumName}
            onChange={(e) => setNewAlbumName(e.target.value)}
            placeholder="Album name"
            className="flex-1 rounded-md border border-border bg-background px-3 py-2"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateAlbum();
              if (e.key === "Escape") setIsCreating(false);
            }}
          />
          <Button
            onClick={handleCreateAlbum}
            disabled={!newAlbumName.trim() || createAlbum.isPending}
          >
            {createAlbum.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              "Create"
            )}
          </Button>
          <Button variant="outline" onClick={() => setIsCreating(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          onClick={() => setIsCreating(true)}
          className="w-full"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create New Album
        </Button>
      )}

      {/* Album list */}
      {albums.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <Folder className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">No albums yet</p>
          <p className="text-sm text-muted-foreground">
            Create an album to start uploading photos
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {albums.map((album) => (
            <AlbumItem
              key={album.id}
              album={album}
              isDeleting={deleteConfirm === album.id}
              onSelect={() => onSelectAlbum(album.id)}
              onToggleActive={() =>
                updateAlbum.mutate({
                  id: album.id,
                  data: { isActive: !album.isActive },
                })
              }
              onDeleteClick={() => setDeleteConfirm(album.id)}
              onDeleteConfirm={() => deleteAlbum.mutate(album.id)}
              onDeleteCancel={() => setDeleteConfirm(null)}
              isUpdating={updateAlbum.isPending}
            />
          ))}
        </div>
      )}

      {/* Help text */}
      <p className="text-xs text-muted-foreground text-center">
        Toggle albums to include them in the screensaver slideshow
      </p>
    </div>
  );
}

interface AlbumItemProps {
  album: PhotoAlbum;
  isDeleting: boolean;
  onSelect: () => void;
  onToggleActive: () => void;
  onDeleteClick: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  isUpdating: boolean;
}

function AlbumItem({
  album,
  isDeleting,
  onSelect,
  onToggleActive,
  onDeleteClick,
  onDeleteConfirm,
  onDeleteCancel,
  isUpdating,
}: AlbumItemProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg border p-3 transition-colors",
        album.isActive
          ? "border-primary bg-primary/5"
          : "border-border hover:bg-muted/50"
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex flex-1 items-center gap-3 text-left min-h-[44px]"
      >
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            album.isActive ? "bg-primary/10" : "bg-muted"
          )}
        >
          <Image
            className={cn(
              "h-5 w-5",
              album.isActive ? "text-primary" : "text-muted-foreground"
            )}
          />
        </div>
        <div>
          <p className="font-medium">{album.name}</p>
          <p className="text-sm text-muted-foreground">
            {album.photoCount ?? 0} photo{album.photoCount !== 1 ? "s" : ""}
          </p>
        </div>
      </button>

      <div className="flex items-center gap-2">
        {/* Active toggle */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleActive();
          }}
          disabled={isUpdating}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
            album.isActive
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          )}
          title={album.isActive ? "Active in slideshow" : "Click to include in slideshow"}
        >
          <Check className="h-5 w-5" />
        </button>

        {/* Delete button */}
        {isDeleting ? (
          <div className="flex gap-1">
            <Button
              variant="destructive"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteConfirm();
              }}
            >
              Delete
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteCancel();
              }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteClick();
            }}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            title="Delete album"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}
