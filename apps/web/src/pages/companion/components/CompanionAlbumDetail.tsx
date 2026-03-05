import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Image,
  Plus,
  CheckCircle2,
  Trash2,
  X,
  ArrowLeft,
} from "lucide-react";
import { api, getPhotoUrl } from "../../../services/api";
import { CompanionPhotoUploadSheet } from "./CompanionPhotoUploadSheet";

interface CompanionAlbumDetailProps {
  albumId: string;
  albumName: string;
  onBack: () => void;
}

export function CompanionAlbumDetail({
  albumId,
  albumName,
  onBack,
}: CompanionAlbumDetailProps) {
  const queryClient = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);

  const { data: photos, isLoading } = useQuery({
    queryKey: ["companion-album-photos", albumId],
    queryFn: () => api.getAlbumPhotos(albumId),
    staleTime: 60_000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deletePhoto(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["companion-album-photos", albumId],
      });
      queryClient.invalidateQueries({ queryKey: ["companion-albums"] });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        await api.deletePhoto(id);
      }
    },
    onSuccess: () => {
      setSelected(new Set());
      setSelecting(false);
      queryClient.invalidateQueries({
        queryKey: ["companion-album-photos", albumId],
      });
      queryClient.invalidateQueries({ queryKey: ["companion-albums"] });
    },
  });

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleDeleteSingle(id: string) {
    deleteMutation.mutate(id);
    setDeleteConfirmId(null);
  }

  function handleBulkDelete() {
    bulkDeleteMutation.mutate(Array.from(selected));
    setBulkDeleteConfirm(false);
  }

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-lg hover:bg-primary/10 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <ArrowLeft className="h-5 w-5 text-primary" />
        </button>
        <h1 className="text-lg font-semibold truncate flex-1">{albumName}</h1>
        <div className="shrink-0 flex items-center gap-1">
          <button
            onClick={() => {
              if (selecting) {
                setSelecting(false);
                setSelected(new Set());
              } else {
                setSelecting(true);
              }
            }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              selecting
                ? "bg-primary text-primary-foreground"
                : "hover:bg-primary/10 text-primary"
            }`}
          >
            {selecting ? "Cancel" : "Select"}
          </button>
          <button
            onClick={() => setShowUpload(true)}
            className="p-2 rounded-lg hover:bg-primary/10 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <Plus className="h-5 w-5 text-primary" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !photos || photos.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Image className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No photos in this album</p>
            <button
              onClick={() => setShowUpload(true)}
              className="mt-3 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
            >
              Upload Photos
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {photos.map((photo: any) => (
              <div key={photo.id} className="aspect-square relative overflow-hidden rounded">
                <button
                  className="w-full h-full"
                  onClick={() => {
                    if (selecting) {
                      toggleSelect(photo.id);
                    } else {
                      setViewPhoto(
                        getPhotoUrl(photo.url || photo.originalUrl) || ""
                      );
                    }
                  }}
                >
                  <img
                    src={getPhotoUrl(
                      photo.thumbnailUrl || photo.url || photo.originalUrl
                    )}
                    alt=""
                    className={`w-full h-full object-cover transition-all ${
                      selecting && selected.has(photo.id)
                        ? "ring-2 ring-primary brightness-75"
                        : ""
                    }`}
                    loading="lazy"
                  />
                </button>
                {selecting && selected.has(photo.id) && (
                  <div className="absolute top-1 right-1 pointer-events-none">
                    <CheckCircle2 className="h-5 w-5 text-primary drop-shadow" />
                  </div>
                )}
                {!selecting && (
                  <button
                    onClick={() => setDeleteConfirmId(photo.id)}
                    className="absolute bottom-1 right-1 p-1.5 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-white" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bulk delete bar */}
      {selecting && selected.size > 0 && (
        <div className="shrink-0 border-t border-border bg-card p-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {selected.size} selected
          </span>
          <button
            onClick={() => setBulkDeleteConfirm(true)}
            className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium"
          >
            Delete {selected.size}
          </button>
        </div>
      )}

      {/* Single delete confirmation */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setDeleteConfirmId(null)}
          />
          <div className="relative bg-card rounded-xl p-5 mx-6 max-w-sm w-full">
            <h3 className="text-base font-semibold mb-2">Delete Photo?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              This photo will be permanently deleted.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-lg hover:bg-primary/10 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteSingle(deleteConfirmId)}
                className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk delete confirmation */}
      {bulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setBulkDeleteConfirm(false)}
          />
          <div className="relative bg-card rounded-xl p-5 mx-6 max-w-sm w-full">
            <h3 className="text-base font-semibold mb-2">
              Delete {selected.size} Photos?
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              These photos will be permanently deleted.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setBulkDeleteConfirm(false)}
                className="px-4 py-2 rounded-lg hover:bg-primary/10 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium"
              >
                Delete {selected.size}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-size photo viewer */}
      {viewPhoto && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
          <button
            onClick={() => setViewPhoto(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
          >
            <X className="h-6 w-6 text-white" />
          </button>
          <img
            src={viewPhoto}
            alt=""
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}

      {showUpload && (
        <CompanionPhotoUploadSheet
          albumId={albumId}
          onClose={() => setShowUpload(false)}
          onComplete={() => {
            queryClient.invalidateQueries({
              queryKey: ["companion-album-photos", albumId],
            });
            queryClient.invalidateQueries({ queryKey: ["companion-albums"] });
          }}
        />
      )}
    </div>
  );
}
