import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  RefreshCw,
  Link2,
  Unlink,
  Loader2,
  Check,
  AlertCircle,
  Image,
  CloudOff,
} from "lucide-react";
import { api } from "../../services/api";
import { Button } from "../ui/Button";
import { useAuthStore } from "../../stores/auth";
import { hasFeatureScope, buildOAuthUrl } from "../../utils/oauth-scopes";

function appUrl(path: string) {
  const base = import.meta.env.VITE_BASE_PATH || "/";
  const prefix = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${prefix}${path}`;
}

export function GooglePhotoAlbums() {
  const queryClient = useQueryClient();
  const [linkingAlbumId, setLinkingAlbumId] = useState<string | null>(null);
  const [syncingAlbumId, setSyncingAlbumId] = useState<string | null>(null);
  const [unlinkingAlbumId, setUnlinkingAlbumId] = useState<string | null>(null);
  const [showBrowse, setShowBrowse] = useState(false);

  // Check connection status
  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ["google-photos-library-status"],
    queryFn: () => api.getGooglePhotosLibraryStatus(),
  });

  // Fetch user for scope check
  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.getMe(),
  });

  const isConnected = status?.connected ?? false;

  // Fetch Google albums when browsing
  const {
    data: googleAlbums = [],
    isLoading: albumsLoading,
    refetch: refetchAlbums,
  } = useQuery({
    queryKey: ["google-photo-albums"],
    queryFn: () => api.getGoogleAlbums(),
    enabled: isConnected && showBrowse,
  });

  const linkedAlbums = googleAlbums.filter((a) => a.isLinked);
  const availableAlbums = googleAlbums.filter((a) => !a.isLinked);

  // Link album mutation
  const linkMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      api.linkGoogleAlbum(id, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-photo-albums"] });
      queryClient.invalidateQueries({ queryKey: ["photo-albums"] });
      setLinkingAlbumId(null);
    },
    onError: () => setLinkingAlbumId(null),
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: (albumId: string) => api.syncGoogleAlbum(albumId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-photo-albums"] });
      queryClient.invalidateQueries({ queryKey: ["photo-albums"] });
      setSyncingAlbumId(null);
    },
    onError: () => setSyncingAlbumId(null),
  });

  // Unlink mutation
  const unlinkMutation = useMutation({
    mutationFn: ({
      albumId,
      deletePhotos,
    }: {
      albumId: string;
      deletePhotos: boolean;
    }) => api.unlinkGoogleAlbum(albumId, deletePhotos),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-photo-albums"] });
      queryClient.invalidateQueries({ queryKey: ["photo-albums"] });
      setUnlinkingAlbumId(null);
    },
    onError: () => setUnlinkingAlbumId(null),
  });

  // Auto-sync toggle
  const toggleAutoSync = useMutation({
    mutationFn: ({
      albumId,
      autoSync,
    }: {
      albumId: string;
      autoSync: boolean;
    }) => api.updateGoogleAlbumSettings(albumId, { autoSync }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-photo-albums"] });
    },
  });

  const handleConnect = () => {
    const token = useAuthStore.getState().accessToken;
    window.location.href = buildOAuthUrl(
      "google",
      "photos",
      token,
      appUrl("/settings/connections?service=google-photos&connected=1")
    );
  };

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold">Google Photos</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Link Google Photo albums to use across the app
        </p>
      </div>

      {/* Connection Status */}
      {!isConnected && (
        <div className="rounded-lg border border-border p-6 text-center">
          <CloudOff className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-medium mb-1">Google Photos Not Connected</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {status?.reason || "Connect your Google account with Photos access to browse and link albums."}
          </p>
          <Button onClick={handleConnect}>Connect Google Photos</Button>
        </div>
      )}

      {isConnected && (
        <>
          {/* Linked Albums */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-primary">
                Linked Albums
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowBrowse(!showBrowse);
                  if (!showBrowse) refetchAlbums();
                }}
              >
                {showBrowse ? "Hide Browser" : "Browse Albums"}
              </Button>
            </div>

            {linkedAlbums.length === 0 && !showBrowse && (
              <div className="rounded-lg border border-dashed border-border p-6 text-center">
                <Image className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No albums linked yet. Click "Browse Albums" to get started.
                </p>
              </div>
            )}

            {linkedAlbums.length > 0 && (
              <div className="space-y-2">
                {linkedAlbums.map((album) => (
                  <div
                    key={album.id}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Image className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{album.title}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{album.mediaItemsCount} photos</span>
                          {album.lastSyncedAt && (
                            <>
                              <span>·</span>
                              <span>
                                Synced{" "}
                                {new Date(album.lastSyncedAt).toLocaleDateString()}
                              </span>
                            </>
                          )}
                          {album.autoSync && (
                            <>
                              <span>·</span>
                              <span className="text-primary">Auto-sync</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <label className="flex items-center gap-1.5 text-xs mr-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={album.autoSync}
                          onChange={(e) =>
                            toggleAutoSync.mutate({
                              albumId: album.localAlbumId!,
                              autoSync: e.target.checked,
                            })
                          }
                          className="rounded border-primary accent-primary"
                        />
                        Auto
                      </label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSyncingAlbumId(album.localAlbumId);
                          syncMutation.mutate(album.localAlbumId!);
                        }}
                        disabled={syncingAlbumId === album.localAlbumId}
                        title="Sync now"
                      >
                        {syncingAlbumId === album.localAlbumId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (
                            confirm(
                              "Unlink this album? Photos will be kept locally."
                            )
                          ) {
                            setUnlinkingAlbumId(album.localAlbumId);
                            unlinkMutation.mutate({
                              albumId: album.localAlbumId!,
                              deletePhotos: false,
                            });
                          }
                        }}
                        disabled={unlinkingAlbumId === album.localAlbumId}
                        title="Unlink album"
                      >
                        <Unlink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Browse Available Albums */}
          {showBrowse && (
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-primary mb-3">
                Available Google Albums
              </h3>

              {albumsLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">
                    Loading albums...
                  </span>
                </div>
              )}

              {!albumsLoading && availableAlbums.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {googleAlbums.length > 0
                    ? "All albums are already linked!"
                    : "No albums found in your Google Photos account."}
                </p>
              )}

              {!albumsLoading && availableAlbums.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {availableAlbums.map((album) => {
                    const isLinking = linkingAlbumId === album.id;
                    return (
                      <div
                        key={album.id}
                        className="rounded-lg border border-border p-3 flex items-center gap-3"
                      >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted overflow-hidden">
                          {album.coverPhotoBaseUrl ? (
                            <img
                              src={`${album.coverPhotoBaseUrl}=w96-h96-c`}
                              alt=""
                              className="h-full w-full object-cover"
                              crossOrigin="anonymous"
                            />
                          ) : (
                            <Image className="h-6 w-6 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {album.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {album.mediaItemsCount} items
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setLinkingAlbumId(album.id);
                            linkMutation.mutate({
                              id: album.id,
                              title: album.title,
                            });
                          }}
                          disabled={isLinking}
                        >
                          {isLinking ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                              Importing...
                            </>
                          ) : (
                            <>
                              <Link2 className="h-3.5 w-3.5 mr-1.5" />
                              Link
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Sync Status */}
          {(linkMutation.isSuccess || syncMutation.isSuccess) && (
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-950/30 rounded-lg p-3">
              <Check className="h-4 w-4" />
              <span>
                {linkMutation.isSuccess && linkMutation.data
                  ? `Linked! ${linkMutation.data.imported} photos imported.`
                  : syncMutation.isSuccess && syncMutation.data
                    ? `Synced! ${syncMutation.data.imported} new photos imported.`
                    : "Done!"}
              </span>
            </div>
          )}

          {(linkMutation.isError || syncMutation.isError || unlinkMutation.isError) && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
              <AlertCircle className="h-4 w-4" />
              <span>
                {linkMutation.error instanceof Error
                  ? linkMutation.error.message
                  : syncMutation.error instanceof Error
                    ? syncMutation.error.message
                    : "An error occurred"}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
