import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { useRemoteControlStore } from "../stores/remote-control";

const PdfViewer = lazy(() => import("./FileSharePdfViewer"));

interface FileShareState {
  shareId: string;
  fileUrl: string;
  fileType: "image" | "pdf";
  mimeType: string;
  pageCount?: number;
  currentPage: number;
}

export function FileShareOverlay() {
  const [share, setShare] = useState<FileShareState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pendingCommands = useRemoteControlStore((s) => s.pendingCommands);
  const consumeCommand = useRemoteControlStore((s) => s.consumeCommand);

  // Process file-share commands
  useEffect(() => {
    const relevant = pendingCommands.filter(
      (c) =>
        c.type === "file-share" ||
        c.type === "file-share-dismiss" ||
        c.type === "file-share-page"
    );
    if (relevant.length === 0) return;

    // Consume all relevant commands
    const toProcess = [...relevant];
    // We need to consume from the store — consume the right ones
    for (const cmd of toProcess) {
      // Find and consume this specific command
      const state = useRemoteControlStore.getState();
      const idx = state.pendingCommands.findIndex(
        (c) => c === cmd || (c.type === cmd.type && c.timestamp === cmd.timestamp)
      );
      if (idx >= 0) {
        useRemoteControlStore.setState({
          pendingCommands: state.pendingCommands.filter((_, i) => i !== idx),
        });
      }
    }

    for (const cmd of toProcess) {
      switch (cmd.type) {
        case "file-share": {
          const p = cmd.payload as {
            shareId: string;
            fileUrl: string;
            fileType: "image" | "pdf";
            mimeType: string;
            pageCount?: number;
          };
          if (p?.shareId && p?.fileUrl) {
            setIsLoading(true);
            setShare({
              shareId: p.shareId,
              fileUrl: p.fileUrl,
              fileType: p.fileType,
              mimeType: p.mimeType,
              pageCount: p.pageCount,
              currentPage: 1,
            });
          }
          break;
        }
        case "file-share-dismiss":
          setShare(null);
          setIsLoading(true);
          break;
        case "file-share-page": {
          const p = cmd.payload as { page?: number };
          if (typeof p?.page === "number") {
            setShare((prev) =>
              prev ? { ...prev, currentPage: p.page! } : null
            );
          }
          break;
        }
      }
    }
  }, [pendingCommands]);

  if (!share) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center">
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-[201] flex flex-col items-center justify-center bg-black gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-white/70" />
          <div className="w-64 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-white/50 rounded-full animate-[loading-bar_1.5s_ease-in-out_infinite]" />
          </div>
          <span className="text-white/60 text-sm">
            {share.fileType === "pdf" ? "Loading PDF..." : "Loading image..."}
          </span>
          <style>{`
            @keyframes loading-bar {
              0% { width: 0%; margin-left: 0%; }
              50% { width: 60%; margin-left: 20%; }
              100% { width: 0%; margin-left: 100%; }
            }
          `}</style>
        </div>
      )}

      {share.fileType === "image" ? (
        <img
          src={share.fileUrl}
          alt="Shared file"
          className="max-w-full max-h-full object-contain"
          onLoad={() => setIsLoading(false)}
          onError={() => setIsLoading(false)}
        />
      ) : (
        <Suspense
          fallback={
            <div className="flex flex-col items-center gap-3 text-white">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span>Loading PDF viewer...</span>
            </div>
          }
        >
          <PdfViewer
            fileUrl={share.fileUrl}
            currentPage={share.currentPage}
            pageCount={share.pageCount}
            onLoaded={() => setIsLoading(false)}
          />
        </Suspense>
      )}

      {/* Page indicator for PDFs */}
      {share.fileType === "pdf" && share.pageCount && !isLoading && (
        <div className="absolute bottom-6 right-6 bg-black/70 text-white px-4 py-2 rounded-lg text-lg font-medium">
          {share.currentPage} / {share.pageCount}
        </div>
      )}
    </div>
  );
}
