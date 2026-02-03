import { useState, useMemo } from "react";
import { X, Search, Loader2, Images, Check } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";
import { api } from "../../services/api";

interface AlbumPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (albumId: string) => void;
  selectedAlbumId?: string;
}

export function AlbumPicker({ isOpen, onClose, onSelect, selectedAlbumId }: AlbumPickerProps) {
  const [search, setSearch] = useState("");

  const { data: albums, isLoading, error } = useQuery({
    queryKey: ["photo-albums"],
    queryFn: () => api.getAlbums(),
    enabled: isOpen,
  });

  // Filter albums by search
  const filteredAlbums = useMemo(() => {
    if (!albums) return [];
    if (!search) return albums;

    const searchLower = search.toLowerCase();
    return albums.filter(
      (album) =>
        album.name.toLowerCase().includes(searchLower) ||
        (album.description?.toLowerCase().includes(searchLower) ?? false)
    );
  }, [albums, search]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative flex h-[60vh] w-full max-w-xl flex-col rounded-lg bg-card border border-border shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h2 className="text-lg font-semibold">Select Photo Album</h2>
            <p className="text-sm text-muted-foreground">
              {albums ? `${albums.length} albums available` : "Loading albums..."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-border p-4 bg-muted/30">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search albums..."
              className="w-full rounded-md border border-border bg-background pl-9 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* Album list */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <div className="text-center">
                <p className="font-medium">Failed to load albums</p>
                <p className="text-sm mt-1">Please try again later</p>
              </div>
            </div>
          ) : filteredAlbums.length === 0 ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Images className="h-12 w-12 mx-auto opacity-50 mb-3" />
                <p className="font-medium">No albums found</p>
                <p className="text-sm mt-1">
                  {albums?.length === 0
                    ? "Create a photo album in Photos to get started"
                    : "Try a different search term"}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAlbums.map((album) => (
                <button
                  key={album.id}
                  onClick={() => onSelect(album.id)}
                  className={cn(
                    "w-full flex items-center justify-between rounded-md border p-3 transition-colors text-left",
                    album.id === selectedAlbumId
                      ? "border-primary bg-primary/10"
                      : "border-border bg-muted/30 hover:bg-muted"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted/50 flex-shrink-0">
                      <Images className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium truncate">{album.name}</h4>
                      {album.description && (
                        <p className="text-xs text-muted-foreground truncate">
                          {album.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {album.photoCount ?? 0} photos
                      </p>
                    </div>
                  </div>
                  {album.id === selectedAlbumId && (
                    <Check className="h-5 w-5 text-primary flex-shrink-0 ml-2" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border p-4 bg-muted/30">
          <Button onClick={onClose} variant="outline" className="w-full">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
