import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Image, ArrowLeft, FolderOpen } from "lucide-react";
import { api, getPhotoUrl } from "../../../services/api";
import { Card } from "../../../components/ui/Card";
import { CompanionPageHeader } from "../components/CompanionPageHeader";

export function CompanionPhotosPage() {
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);

  const { data: albums, isLoading: albumsLoading } = useQuery({
    queryKey: ["companion-albums"],
    queryFn: () => api.getAlbums(),
    staleTime: 120_000,
  });

  const { data: photos, isLoading: photosLoading } = useQuery({
    queryKey: ["companion-album-photos", selectedAlbumId],
    queryFn: () => api.getAlbumPhotos(selectedAlbumId!),
    enabled: !!selectedAlbumId,
    staleTime: 60_000,
  });

  const selectedAlbum = albums?.find((a: any) => a.id === selectedAlbumId);

  // Photo grid view for selected album
  if (selectedAlbumId) {
    return (
      <div className="flex flex-col h-full">
        <CompanionPageHeader
          title={selectedAlbum?.name || "Photos"}
          backTo="/companion/more/photos"
        />
        <div className="flex-1 overflow-y-auto p-2">
          {photosLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !photos || (photos as any[]).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Image className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No photos in this album</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {(photos as any[]).map((photo: any) => (
                <div key={photo.id} className="aspect-square relative overflow-hidden rounded">
                  <img
                    src={getPhotoUrl(photo.url || photo.thumbnailUrl)}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Album grid
  return (
    <div className="flex flex-col h-full">
      <CompanionPageHeader title="Photos" backTo="/companion/more" />
      <div className="flex-1 overflow-y-auto p-4">
        {albumsLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !albums || (albums as any[]).length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No photo albums</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {(albums as any[]).map((album: any) => (
              <button
                key={album.id}
                onClick={() => setSelectedAlbumId(album.id)}
                className="text-left"
              >
                <Card className="overflow-hidden hover:bg-primary/5 transition-colors">
                  {album.coverPhotoUrl ? (
                    <img
                      src={album.coverPhotoUrl}
                      alt={album.name}
                      className="w-full h-28 object-cover"
                    />
                  ) : (
                    <div className="w-full h-28 bg-primary/5 flex items-center justify-center">
                      <Image className="h-8 w-8 text-primary/30" />
                    </div>
                  )}
                  <div className="p-2.5">
                    <div className="text-sm font-medium text-foreground truncate">{album.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {album.photoCount || 0} photos
                    </div>
                  </div>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
