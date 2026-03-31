import { useState } from "react";
import { Globe, MonitorPlay } from "lucide-react";
import { CastDialog } from "./CastDialog";

interface CastWebpageButtonProps {
  className?: string;
}

export function CastWebpageButton({ className }: CastWebpageButtonProps) {
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [url, setUrl] = useState("");
  const [showCastDialog, setShowCastDialog] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    // Auto-prepend https:// if no protocol
    const finalUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    setUrl(finalUrl);
    setShowCastDialog(true);
  };

  const handleClose = () => {
    setShowCastDialog(false);
    setShowUrlInput(false);
    setUrl("");
  };

  if (showUrlInput) {
    return (
      <>
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter URL to cast..."
              autoFocus
              className="w-full pl-9 pr-3 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setShowUrlInput(false);
                  setUrl("");
                }
              }}
            />
          </div>
          <button
            type="submit"
            disabled={!url.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <MonitorPlay className="h-4 w-4" />
            Cast
          </button>
          <button
            type="button"
            onClick={() => {
              setShowUrlInput(false);
              setUrl("");
            }}
            className="text-sm text-muted-foreground hover:text-foreground px-2 py-2"
          >
            Cancel
          </button>
        </form>

        <CastDialog
          isOpen={showCastDialog}
          onClose={handleClose}
          contentType="webpage"
          webpageUrl={url}
        />
      </>
    );
  }

  return (
    <button
      onClick={() => setShowUrlInput(true)}
      title="Cast webpage to kiosk"
      className={
        className ||
        "inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-primary/10 hover:border-primary/40 hover:text-primary"
      }
    >
      <Globe className="h-4 w-4" />
      Cast Webpage
    </button>
  );
}
