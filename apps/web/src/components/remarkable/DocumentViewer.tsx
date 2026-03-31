import { useState, useEffect } from "react";
import { X, Download, Loader2, AlertCircle } from "lucide-react";
import { api } from "../../services/api";
import { Button } from "../ui/Button";

interface DocumentViewerProps {
  docName: string;
  docPath: string;
  onClose: () => void;
}

export function DocumentViewer({ docName, docPath, onClose }: DocumentViewerProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const blob = await api.fetchDocumentViewBlob(docPath);
        if (!cancelled) {
          setBlobUrl(URL.createObjectURL(blob));
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load document");
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [docPath]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-background rounded-lg shadow-xl w-full max-w-5xl mx-4 h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <div>
            <h2 className="text-lg font-semibold">{docName}</h2>
            <p className="text-xs text-muted-foreground">{docPath}</p>
          </div>
          <div className="flex items-center gap-2">
            {blobUrl && (
              <a
                href={blobUrl}
                download={`${docName}.pdf`}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-input rounded-md hover:bg-muted transition-colors"
              >
                <Download className="h-4 w-4" />
                Download
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1 hover:bg-muted rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 p-4 bg-muted/50">
          {loading && (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Loading document...</span>
            </div>
          )}
          {error && (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}
          {blobUrl && (
            <iframe
              src={blobUrl}
              className="w-full h-full rounded-lg border border-border bg-white"
              title={docName}
            />
          )}
        </div>
      </div>
    </div>
  );
}
