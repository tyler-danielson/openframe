import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Image,
  FolderOpen,
  Plus,
  MoreVertical,
  CheckCircle2,
} from "lucide-react";
import { api, getPhotoUrl } from "../../../services/api";
import { Card } from "../../../components/ui/Card";
import { CompanionPageHeader } from "../components/CompanionPageHeader";
import { CompanionAlbumDetail } from "../components/CompanionAlbumDetail";

export function CompanionPhotosPage() {
  const queryClient = useQueryClient();
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [menuAlbumId, setMenuAlbumId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: albums, isLoading: albumsLoading } = useQuery({
    queryKey: ["companion-albums"],
    queryFn: () => api.getAlbums(),
    staleTime: 120_000,
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => api.createAlbum({ name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companion-albums"] });
      setIsCreating(false);
      setNewAlbumName("");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { isActive?: boolean } }) =>
      api.updateAlbum(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companion-albums"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAlbum(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companion-albums"] });
      setDeleteConfirmId(null);
    },
  });

  const selectedAlbum = albums?.find((a: any) => a.id === selectedAlbumId);

  // Album detail view
  if (selectedAlbumId) {
    return (
      <CompanionAlbumDetail
        albumId={selectedAlbumId}
        albumName={selectedAlbum?.name || "Photos"}
        onBack={() => setSelectedAlbumId(null)}
      />
    );
  }

  function handleCreate() {
    const name = newAlbumName.trim();
    if (!name) return;
    createMutation.mutate(name);
  }

  // Album grid
  return (
    <div className="flex flex-col h-full">
      <CompanionPageHeader
        title="Photos"
        backTo="/companion/more"
        rightAction={
          <button
            onClick={() => setIsCreating(true)}
            className="p-2 rounded-lg hover:bg-primary/10 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <Plus className="h-5 w-5 text-primary" />
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto p-4">
        {/* Inline create form */}
        {isCreating && (
          <div className="mb-4 p-3 rounded-xl border border-primary/30 bg-card">
            <input
              autoFocus
              type="text"
              placeholder="Album name"
              value={newAlbumName}
              onChange={(e) => setNewAlbumName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") {
                  setIsCreating(false);
                  setNewAlbumName("");
                }
              }}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <div className="flex gap-2 mt-2 justify-end">
              <button
                onClick={() => {
                  setIsCreating(false);
                  setNewAlbumName("");
                }}
                className="px-3 py-1.5 rounded-lg hover:bg-primary/10 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newAlbumName.trim() || createMutation.isPending}
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
              >
                {createMutation.isPending ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        )}

        {albumsLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !albums || (albums as any[]).length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No photo albums</p>
            {!isCreating && (
              <button
                onClick={() => setIsCreating(true)}
                className="mt-3 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
              >
                Create Album
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {(albums as any[]).map((album: any) => (
              <div key={album.id} className="relative">
                <button
                  onClick={() => setSelectedAlbumId(album.id)}
                  className="text-left w-full"
                >
                  <Card className="overflow-hidden hover:bg-primary/5 transition-colors">
                    {album.coverPhotoUrl ? (
                      <div className="relative">
                        <img
                          src={getPhotoUrl(album.coverPhotoUrl)}
                          alt={album.name}
                          className="w-full h-28 object-cover"
                        />
                        {album.isActive && (
                          <div className="absolute top-1.5 left-1.5">
                            <CheckCircle2 className="h-5 w-5 text-primary drop-shadow" />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-full h-28 bg-primary/5 flex items-center justify-center relative">
                        <Image className="h-8 w-8 text-primary/30" />
                        {album.isActive && (
                          <div className="absolute top-1.5 left-1.5">
                            <CheckCircle2 className="h-5 w-5 text-primary drop-shadow" />
                          </div>
                        )}
                      </div>
                    )}
                    <div className="p-2.5">
                      <div className="text-sm font-medium text-foreground truncate pr-6">
                        {album.name}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {album.photoCount || 0} photos
                      </div>
                    </div>
                  </Card>
                </button>
                {/* Menu button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuAlbumId(
                      menuAlbumId === album.id ? null : album.id
                    );
                  }}
                  className="absolute bottom-2 right-1.5 p-1.5 rounded-lg hover:bg-primary/10 transition-colors"
                >
                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
                </button>
                {/* Dropdown menu */}
                {menuAlbumId === album.id && (
                  <div className="absolute bottom-10 right-1 z-20 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[160px]">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateMutation.mutate({
                          id: album.id,
                          data: { isActive: !album.isActive },
                        });
                        setMenuAlbumId(null);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-primary/10 transition-colors"
                    >
                      {album.isActive
                        ? "Remove from Slideshow"
                        : "Add to Slideshow"}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(album.id);
                        setMenuAlbumId(null);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      Delete Album
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Close menu on backdrop tap */}
      {menuAlbumId && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setMenuAlbumId(null)}
        />
      )}

      {/* Delete album confirmation */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setDeleteConfirmId(null)}
          />
          <div className="relative bg-card rounded-xl p-5 mx-6 max-w-sm w-full">
            <h3 className="text-base font-semibold mb-2">Delete Album?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              This album and all its photos will be permanently deleted.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-lg hover:bg-primary/10 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirmId)}
                className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
