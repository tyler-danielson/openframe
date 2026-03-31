import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Server,
  Folder,
  File,
  ChevronRight,
  Download,
  Upload,
  FolderPlus,
  Trash2,
  Loader2,
  Image,
  Music,
  Film,
  FileText,
  Archive,
  RefreshCw,
  HardDrive,
  ArrowLeft,
} from "lucide-react";
import { api, type StorageServerInfo, type StorageFileInfo } from "../services/api";
import { Button } from "../components/ui/Button";
import { cn } from "../lib/utils";

function formatFileSize(bytes: number | null): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function getFileIcon(file: StorageFileInfo) {
  if (file.isDirectory) return <Folder className="h-5 w-5 text-primary" />;
  const mime = file.mimeType || "";
  if (mime.startsWith("image/")) return <Image className="h-5 w-5 text-primary" />;
  if (mime.startsWith("video/")) return <Film className="h-5 w-5 text-primary/80" />;
  if (mime.startsWith("audio/")) return <Music className="h-5 w-5 text-primary/70" />;
  if (mime === "application/pdf") return <FileText className="h-5 w-5 text-primary/60" />;
  if (mime === "application/zip") return <Archive className="h-5 w-5 text-primary/80" />;
  return <File className="h-5 w-5 text-muted-foreground" />;
}

export function FilesPage() {
  const queryClient = useQueryClient();
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState("/");
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);

  const { data: servers = [], isLoading: loadingServers } = useQuery({
    queryKey: ["storage-servers"],
    queryFn: () => api.getStorageServers(),
  });

  const {
    data: browseData,
    isLoading: loadingFiles,
    refetch: refetchFiles,
  } = useQuery({
    queryKey: ["storage-browse", selectedServerId, currentPath],
    queryFn: () => api.browseStorageFiles(selectedServerId!, currentPath),
    enabled: !!selectedServerId,
  });

  const mkdirMutation = useMutation({
    mutationFn: () => api.createStorageDir(selectedServerId!, currentPath + "/" + newFolderName),
    onSuccess: () => {
      setNewFolderName("");
      setShowNewFolder(false);
      queryClient.invalidateQueries({ queryKey: ["storage-browse", selectedServerId, currentPath] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (filePath: string) => api.deleteStorageFile(selectedServerId!, filePath),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["storage-browse", selectedServerId, currentPath] });
    },
  });

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedServerId) return;
    api.uploadStorageFile(selectedServerId, currentPath, file).then(() => {
      queryClient.invalidateQueries({ queryKey: ["storage-browse", selectedServerId, currentPath] });
    });
    e.target.value = "";
  }

  function navigateToFolder(folderPath: string) {
    setCurrentPath(folderPath);
  }

  function navigateUp() {
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    setCurrentPath("/" + parts.join("/"));
  }

  // Breadcrumb segments
  const pathSegments = currentPath.split("/").filter(Boolean);

  const selectedServer = servers.find((s) => s.id === selectedServerId);
  const files = browseData?.files ?? [];

  // Sort: directories first, then by name
  const sortedFiles = [...files].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="flex h-full">
      {/* Left panel: Server list */}
      <div className="w-64 shrink-0 border-r border-primary/10 bg-background p-4">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-primary">
          <HardDrive className="h-4 w-4" />
          Storage Servers
        </h2>

        {loadingServers ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : servers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No servers connected. Add one in{" "}
            <a href="/settings/connections" className="text-primary underline">
              Settings &rarr; Connections
            </a>
          </p>
        ) : (
          <div className="space-y-1">
            {servers.map((server) => (
              <button
                key={server.id}
                onClick={() => {
                  setSelectedServerId(server.id);
                  setCurrentPath("/");
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  selectedServerId === server.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-foreground hover:bg-primary/5"
                )}
              >
                <Server className="h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <div className="truncate">{server.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {server.protocol.toUpperCase()} &middot; {server.host}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main area: File browser */}
      <div className="flex-1 overflow-hidden p-4">
        {!selectedServerId ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <div className="text-center">
              <HardDrive className="mx-auto mb-3 h-12 w-12 text-primary/20" />
              <p className="text-lg font-medium">Select a server</p>
              <p className="text-sm">Choose a storage server from the left to browse files</p>
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col">
            {/* Toolbar */}
            <div className="mb-3 flex items-center justify-between">
              {/* Breadcrumb */}
              <div className="flex items-center gap-1 text-sm">
                {currentPath !== "/" && (
                  <button
                    onClick={navigateUp}
                    className="mr-1 rounded p-1 hover:bg-primary/10 text-muted-foreground"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => setCurrentPath("/")}
                  className="rounded px-1.5 py-0.5 font-medium text-primary hover:bg-primary/10"
                >
                  {selectedServer?.name}
                </button>
                {pathSegments.map((seg, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    <button
                      onClick={() =>
                        setCurrentPath("/" + pathSegments.slice(0, i + 1).join("/"))
                      }
                      className="rounded px-1.5 py-0.5 hover:bg-primary/10 text-foreground"
                    >
                      {seg}
                    </button>
                  </span>
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => refetchFiles()}
                  className="rounded-lg p-2 hover:bg-primary/10 text-muted-foreground"
                  title="Refresh"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setShowNewFolder(true)}
                  className="rounded-lg p-2 hover:bg-primary/10 text-muted-foreground"
                  title="New folder"
                >
                  <FolderPlus className="h-4 w-4" />
                </button>
                <label
                  className="cursor-pointer rounded-lg p-2 hover:bg-primary/10 text-muted-foreground"
                  title="Upload file"
                >
                  <Upload className="h-4 w-4" />
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>
            </div>

            {/* New folder input */}
            {showNewFolder && (
              <div className="mb-3 flex items-center gap-2">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Folder name"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newFolderName) mkdirMutation.mutate();
                    if (e.key === "Escape") setShowNewFolder(false);
                  }}
                  className="rounded-lg border border-primary/30 bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
                <Button
                  size="sm"
                  onClick={() => mkdirMutation.mutate()}
                  disabled={!newFolderName || mkdirMutation.isPending}
                >
                  Create
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowNewFolder(false)}
                >
                  Cancel
                </Button>
              </div>
            )}

            {/* File list */}
            <div className="flex-1 overflow-auto rounded-lg border border-primary/10">
              {loadingFiles ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : sortedFiles.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <p className="text-sm">This folder is empty</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-primary/10 text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium w-24 text-right">Size</th>
                      <th className="px-3 py-2 font-medium w-40">Modified</th>
                      <th className="px-3 py-2 font-medium w-20"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedFiles.map((file) => (
                      <tr
                        key={file.path}
                        className={cn(
                          "border-b border-primary/5 transition-colors",
                          file.isDirectory
                            ? "cursor-pointer hover:bg-primary/5"
                            : "hover:bg-muted/30"
                        )}
                        onClick={() => {
                          if (file.isDirectory) navigateToFolder(file.path);
                        }}
                      >
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            {getFileIcon(file)}
                            <span className={file.isDirectory ? "font-medium" : ""}>
                              {file.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground">
                          {file.isDirectory ? "" : formatFileSize(file.size)}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {file.modifiedAt
                            ? new Date(file.modifiedAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-1">
                            {!file.isDirectory && (
                              <a
                                href={api.getStorageDownloadUrl(selectedServerId, file.path)}
                                onClick={(e) => e.stopPropagation()}
                                className="rounded p-1 hover:bg-primary/10 text-muted-foreground"
                                title="Download"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </a>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Delete ${file.name}?`)) {
                                  deleteMutation.mutate(file.path);
                                }
                              }}
                              className="rounded p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
