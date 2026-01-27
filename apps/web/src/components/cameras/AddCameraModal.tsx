import { useState } from "react";
import { X, Camera, Loader2 } from "lucide-react";
import { Button } from "../ui/Button";

interface AddCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    rtspUrl?: string;
    mjpegUrl?: string;
    snapshotUrl?: string;
    username?: string;
    password?: string;
  }) => Promise<void>;
}

export function AddCameraModal({ isOpen, onClose, onSubmit }: AddCameraModalProps) {
  const [name, setName] = useState("");
  const [rtspUrl, setRtspUrl] = useState("");
  const [mjpegUrl, setMjpegUrl] = useState("");
  const [snapshotUrl, setSnapshotUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!mjpegUrl && !snapshotUrl) {
      setError("Please provide either an MJPEG URL or Snapshot URL");
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit({
        name,
        rtspUrl: rtspUrl || undefined,
        mjpegUrl: mjpegUrl || undefined,
        snapshotUrl: snapshotUrl || undefined,
        username: username || undefined,
        password: password || undefined,
      });
      // Reset form
      setName("");
      setRtspUrl("");
      setMjpegUrl("");
      setSnapshotUrl("");
      setUsername("");
      setPassword("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add camera");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setError(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-lg rounded-lg bg-card border border-border shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4 sticky top-0 bg-card">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Camera className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Add Camera</h2>
              <p className="text-sm text-muted-foreground">
                Configure your IP camera
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="rounded-full p-1 hover:bg-muted transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Camera Name *
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Front Door Camera"
              required
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="border-t border-border pt-4">
            <h3 className="text-sm font-medium mb-3">Stream URLs</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Provide at least one URL. MJPEG streams play directly in the browser.
              Snapshots refresh periodically.
            </p>

            <div className="space-y-3">
              <div className="space-y-2">
                <label htmlFor="mjpegUrl" className="text-sm font-medium">
                  MJPEG Stream URL
                </label>
                <input
                  id="mjpegUrl"
                  type="url"
                  value={mjpegUrl}
                  onChange={(e) => setMjpegUrl(e.target.value)}
                  placeholder="http://192.168.1.100/video.mjpg"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="snapshotUrl" className="text-sm font-medium">
                  Snapshot URL
                </label>
                <input
                  id="snapshotUrl"
                  type="url"
                  value={snapshotUrl}
                  onChange={(e) => setSnapshotUrl(e.target.value)}
                  placeholder="http://192.168.1.100/snapshot.jpg"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="rtspUrl" className="text-sm font-medium">
                  RTSP URL <span className="text-muted-foreground">(reference only)</span>
                </label>
                <input
                  id="rtspUrl"
                  type="text"
                  value={rtspUrl}
                  onChange={(e) => setRtspUrl(e.target.value)}
                  placeholder="rtsp://192.168.1.100:554/stream"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="text-xs text-muted-foreground">
                  RTSP requires a proxy server (like go2rtc) for browser playback
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <h3 className="text-sm font-medium mb-3">Authentication (Optional)</h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label htmlFor="username" className="text-sm font-medium">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="password"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Camera"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
