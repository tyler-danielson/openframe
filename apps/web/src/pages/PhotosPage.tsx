import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Image, Upload, QrCode } from "lucide-react";
import { api } from "../services/api";
import { Button } from "../components/ui/Button";
import { QRUploadModal } from "../components/photos/QRUploadModal";
import { PhotoViewerModal } from "../components/photos/PhotoViewerModal";
import { PhotoLayouts, LayoutSelector, type LayoutType } from "../components/photos/PhotoLayouts";
import { KioskQRUpload } from "../components/photos/KioskQRUpload";
import { useKiosk } from "../contexts/KioskContext";
import { cn } from "../lib/utils";
import type { PhotoAlbum, Photo } from "@openframe/shared";

export function PhotosPage() {
  const queryClient = useQueryClient();
  const { token: kioskToken } = useKiosk();
  const isKioskMode = !!kioskToken;
  const [selectedAlbum, setSelectedAlbum] = useState<PhotoAlbum | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [layout, setLayout] = useState<LayoutType>(() => {
    const saved = localStorage.getItem("photoLayout");
    return (saved as LayoutType) || "grid";
  });

  const handleLayoutChange = (newLayout: LayoutType) => {
    setLayout(newLayout);
    localStorage.setItem("photoLayout", newLayout);
  };

  // Fetch albums
  const { data: albums = [] } = useQuery({
    queryKey: ["albums"],
    queryFn: () => api.getAlbums(),
  });

  // Fetch photos for selected album
  const { data: photos = [] } = useQuery({
    queryKey: ["photos", selectedAlbum?.id],
    queryFn: () => api.getAlbumPhotos(selectedAlbum!.id),
    enabled: !!selectedAlbum,
  });

  // Create album mutation
  const createAlbum = useMutation({
    mutationFn: (name: string) => api.createAlbum({ name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["albums"] });
    },
  });

  const refreshPhotos = () => {
    queryClient.invalidateQueries({ queryKey: ["photos", selectedAlbum?.id] });
    queryClient.invalidateQueries({ queryKey: ["albums"] });
  };

  const handleCreateAlbum = async () => {
    const name = prompt("Enter album name:");
    if (name) {
      createAlbum.mutate(name);
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || !selectedAlbum) return;

    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        await api.uploadPhoto(selectedAlbum.id, file);
      }
      queryClient.invalidateQueries({ queryKey: ["photos", selectedAlbum.id] });
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  return (
    <div className="flex h-full">
      {/* Album sidebar */}
      <div className="w-64 border-r border-border bg-card p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Albums</h2>
          <Button size="icon" variant="ghost" onClick={handleCreateAlbum}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-1">
          {albums.map((album) => (
            <button
              key={album.id}
              onClick={() => setSelectedAlbum(album)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
                selectedAlbum?.id === album.id
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              )}
            >
              <Image className="h-4 w-4" />
              <div className="flex-1">
                <p className="font-medium">{album.name}</p>
                <p className="text-xs opacity-70">
                  {album.photoCount ?? 0} photos
                </p>
              </div>
              {album.isActive && (
                <span className="h-2 w-2 rounded-full bg-green-500" title="Active in slideshow" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Photo grid */}
      <div className="flex-1 p-6">
        {selectedAlbum ? (
          <>
            <div className="mb-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-semibold">{selectedAlbum.name}</h1>
                  {selectedAlbum.description && (
                    <p className="text-muted-foreground">
                      {selectedAlbum.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowQRModal(true)}
                    title="Upload from mobile device"
                  >
                    <QrCode className="mr-2 h-4 w-4" />
                    Mobile Upload
                  </Button>
                  <input
                    type="file"
                    id="photo-upload"
                    multiple
                    accept="image/*"
                    onChange={handleUpload}
                    className="hidden"
                    disabled={isUploading}
                  />
                  <label
                    htmlFor="photo-upload"
                    className={`inline-flex cursor-pointer items-center justify-center rounded-md bg-primary px-4 h-10 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isUploading ? 'pointer-events-none opacity-50' : ''}`}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {isUploading ? "Uploading..." : "Upload Photos"}
                  </label>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {photos.length} {photos.length === 1 ? "photo" : "photos"}
                </p>
                <LayoutSelector value={layout} onChange={handleLayoutChange} />
              </div>
            </div>

            {photos.length === 0 ? (
              <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed border-border">
                <div className="text-center">
                  <Image className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-2 text-muted-foreground">No photos yet</p>
                  <p className="text-sm text-muted-foreground">
                    Upload some photos to get started
                  </p>
                </div>
              </div>
            ) : (
              <PhotoLayouts
                photos={photos}
                layout={layout}
                onPhotoClick={setSelectedPhoto}
              />
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <Image className="mx-auto h-16 w-16 text-muted-foreground" />
              <p className="mt-4 text-lg text-muted-foreground">
                Select an album to view photos
              </p>
            </div>
          </div>
        )}
      </div>

      {/* QR Code Upload Modal */}
      {selectedAlbum && (
        <QRUploadModal
          isOpen={showQRModal}
          onClose={() => {
            setShowQRModal(false);
            // Refresh photos after closing in case uploads happened
            queryClient.invalidateQueries({ queryKey: ["photos", selectedAlbum.id] });
          }}
          albumId={selectedAlbum.id}
          albumName={selectedAlbum.name}
        />
      )}

      {/* Kiosk mode: persistent QR code in corner */}
      {isKioskMode && <KioskQRUpload />}

      {/* Photo Viewer Modal */}
      {selectedPhoto && (
        <PhotoViewerModal
          photo={selectedPhoto}
          isOpen={!!selectedPhoto}
          onClose={() => setSelectedPhoto(null)}
          onPhotoUpdated={refreshPhotos}
          onPhotoDeleted={refreshPhotos}
        />
      )}
    </div>
  );
}
