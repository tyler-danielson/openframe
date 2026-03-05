import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Upload,
  ChevronLeft,
  ChevronRight,
  X,
  FileText,
  Image,
  Loader2,
} from "lucide-react";
import { api, type FileShareResult } from "../../services/api";

const STORAGE_KEY = "openframe_active_fileshare";

interface ActiveShare extends FileShareResult {
  kioskId: string;
  fileUrl: string;
}

function loadActiveShare(kioskId: string): ActiveShare | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const share = JSON.parse(raw) as ActiveShare;
    if (share.kioskId !== kioskId) return null;
    return share;
  } catch {
    return null;
  }
}

function saveActiveShare(share: ActiveShare | null) {
  if (share) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(share));
  } else {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}

export function CompanionFileSharePage() {
  const { kioskId } = useParams<{ kioskId: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeShare, setActiveShare] = useState<ActiveShare | null>(() =>
    loadActiveShare(kioskId ?? "")
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync active share to sessionStorage
  useEffect(() => {
    saveActiveShare(activeShare);
  }, [activeShare]);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !kioskId) return;

      setUploading(true);
      setError(null);

      try {
        const result = await api.uploadFileShare(file);

        const fileUrl = `/api/v1/fileshare/${result.shareId}/file`;

        const share: ActiveShare = {
          ...result,
          kioskId,
          fileUrl,
        };

        setActiveShare(share);
        setCurrentPage(1);

        // Send command to kiosk
        await api.sendKioskCommand(kioskId, {
          type: "file-share",
          payload: {
            shareId: result.shareId,
            fileUrl,
            fileType: result.fileType,
            mimeType: result.mimeType,
            pageCount: result.pageCount,
          },
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
        // Reset input so the same file can be re-selected
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [kioskId]
  );

  const handleDismiss = useCallback(async () => {
    if (!activeShare || !kioskId) return;

    try {
      await api.deleteFileShare(activeShare.shareId);
    } catch {
      // Ignore — share may already be expired
    }

    try {
      await api.sendKioskCommand(kioskId, { type: "file-share-dismiss" });
    } catch {
      // Ignore
    }

    setActiveShare(null);
    setCurrentPage(1);
  }, [activeShare, kioskId]);

  const handlePageChange = useCallback(
    async (newPage: number) => {
      if (!activeShare || !kioskId) return;
      const maxPage = activeShare.pageCount ?? 1;
      const clamped = Math.max(1, Math.min(newPage, maxPage));
      setCurrentPage(clamped);

      await api
        .sendKioskCommand(kioskId, {
          type: "file-share-page",
          payload: { page: clamped },
        })
        .catch(() => {});
    },
    [activeShare, kioskId]
  );

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`/companion/kiosks/${kioskId}`)}
          className="p-2 -ml-2 rounded-lg hover:bg-primary/5"
        >
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h2 className="text-xl font-semibold text-foreground">Share to Kiosk</h2>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {!activeShare ? (
        /* No active share — show upload UI */
        <div className="flex flex-col items-center gap-4 py-12">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Upload className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center">
            <p className="text-foreground font-medium">
              Send a file to the kiosk display
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Images and PDFs are supported
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
            onChange={handleFileSelect}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 min-h-[48px]"
          >
            {uploading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-5 w-5" />
                Choose File
              </>
            )}
          </button>
        </div>
      ) : activeShare.fileType === "pdf" ? (
        /* Active PDF share — show page controls */
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 rounded-xl border border-primary/20 bg-card">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-foreground truncate">
                {activeShare.originalName}
              </div>
              <div className="text-sm text-muted-foreground">
                {activeShare.pageCount} page{activeShare.pageCount !== 1 ? "s" : ""}
              </div>
            </div>
          </div>

          {/* Page navigation */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="p-3 rounded-xl bg-card border border-border hover:bg-primary/5 transition-colors disabled:opacity-30 min-h-[48px] min-w-[48px] flex items-center justify-center"
            >
              <ChevronLeft className="h-6 w-6 text-foreground" />
            </button>

            <div className="text-lg font-medium text-foreground min-w-[100px] text-center">
              {currentPage} / {activeShare.pageCount}
            </div>

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= (activeShare.pageCount ?? 1)}
              className="p-3 rounded-xl bg-card border border-border hover:bg-primary/5 transition-colors disabled:opacity-30 min-h-[48px] min-w-[48px] flex items-center justify-center"
            >
              <ChevronRight className="h-6 w-6 text-foreground" />
            </button>
          </div>

          {/* Dismiss */}
          <button
            onClick={handleDismiss}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/5 transition-colors font-medium min-h-[48px]"
          >
            <X className="h-5 w-5" />
            Dismiss from Kiosk
          </button>
        </div>
      ) : (
        /* Active image share — show preview and dismiss */
        <div className="space-y-4">
          <div className="rounded-xl border border-primary/20 overflow-hidden bg-black">
            <img
              src={activeShare.fileUrl}
              alt={activeShare.originalName}
              className="w-full max-h-[300px] object-contain"
            />
          </div>

          <div className="flex items-center gap-3 px-1">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Image className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-foreground text-sm truncate">
                {activeShare.originalName}
              </div>
              <div className="text-xs text-muted-foreground">
                Showing on kiosk
              </div>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/5 transition-colors font-medium min-h-[48px]"
          >
            <X className="h-5 w-5" />
            Dismiss from Kiosk
          </button>
        </div>
      )}
    </div>
  );
}
