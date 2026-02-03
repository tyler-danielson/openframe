import { useState, useEffect } from "react";
import { X, ExternalLink, Loader2, Link2, AlertCircle } from "lucide-react";
import type { CalendarProvider } from "@openframe/shared";
import { Button } from "../ui/Button";

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectGoogle: () => void;
  onConnectMicrosoft: () => void;
  onConnectCalDAV: (url: string, username: string, password: string) => Promise<void>;
  onSubscribeICS: (url: string, name?: string) => Promise<void>;
  onManageSports: () => void;
  initialView?: ModalView;
}

type ModalView = "select" | "caldav" | "ics";

// Provider options for selection
const PROVIDERS: {
  id: CalendarProvider;
  name: string;
  description: string;
  icon: React.ReactNode;
  bgColor: string;
}[] = [
  {
    id: "google",
    name: "Google Calendar",
    description: "Connect your Google account",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24">
        <path
          fill="#EA4335"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
          fill="#4285F4"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
      </svg>
    ),
    bgColor: "bg-red-500/10 hover:bg-red-500/20",
  },
  {
    id: "microsoft",
    name: "Microsoft Outlook",
    description: "Connect Microsoft 365 or Outlook.com",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24">
        <path fill="#0078D4" d="M0 0h11.5v11.5H0z" />
        <path fill="#0078D4" d="M12.5 0H24v11.5H12.5z" />
        <path fill="#0078D4" d="M0 12.5h11.5V24H0z" />
        <path fill="#0078D4" d="M12.5 12.5H24V24H12.5z" />
      </svg>
    ),
    bgColor: "bg-blue-500/10 hover:bg-blue-500/20",
  },
  {
    id: "caldav",
    name: "CalDAV",
    description: "iCloud, Fastmail, or any CalDAV server",
    icon: <span className="text-2xl">📅</span>,
    bgColor: "bg-purple-500/10 hover:bg-purple-500/20",
  },
  {
    id: "ics",
    name: "ICS Subscription",
    description: "Subscribe to a .ics calendar feed",
    icon: <span className="text-2xl">🔗</span>,
    bgColor: "bg-emerald-500/10 hover:bg-emerald-500/20",
  },
  {
    id: "sports",
    name: "Sports",
    description: "Follow your favorite teams",
    icon: <span className="text-2xl">🏈</span>,
    bgColor: "bg-orange-500/10 hover:bg-orange-500/20",
  },
];

export function AddAccountModal({
  isOpen,
  onClose,
  onConnectGoogle,
  onConnectMicrosoft,
  onConnectCalDAV,
  onSubscribeICS,
  onManageSports,
  initialView = "select",
}: AddAccountModalProps) {
  const [view, setView] = useState<ModalView>(initialView);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // CalDAV form state
  const [caldavUrl, setCaldavUrl] = useState("");
  const [caldavUsername, setCaldavUsername] = useState("");
  const [caldavPassword, setCaldavPassword] = useState("");

  // ICS form state
  const [icsUrl, setIcsUrl] = useState("");
  const [icsName, setIcsName] = useState("");

  // Reset view to initialView when modal opens
  useEffect(() => {
    if (isOpen) {
      setView(initialView);
    }
  }, [isOpen, initialView]);

  const handleClose = () => {
    setView("select");
    setError(null);
    setCaldavUrl("");
    setCaldavUsername("");
    setCaldavPassword("");
    setIcsUrl("");
    setIcsName("");
    onClose();
  };

  const handleProviderSelect = (provider: CalendarProvider) => {
    setError(null);
    switch (provider) {
      case "google":
        onConnectGoogle();
        handleClose();
        break;
      case "microsoft":
        onConnectMicrosoft();
        handleClose();
        break;
      case "caldav":
        setView("caldav");
        break;
      case "ics":
        setView("ics");
        break;
      case "sports":
        onManageSports();
        handleClose();
        break;
    }
  };

  const handleCalDAVSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await onConnectCalDAV(caldavUrl, caldavUsername, caldavPassword);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setIsLoading(false);
    }
  };

  const handleICSSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await onSubscribeICS(icsUrl, icsName || undefined);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to subscribe");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-card rounded-xl shadow-xl border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">
            {view === "select" && "Add Calendar Account"}
            {view === "caldav" && "Connect CalDAV"}
            {view === "ics" && "Subscribe to Calendar"}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Provider selection */}
          {view === "select" && (
            <div className="space-y-2">
              {PROVIDERS.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => handleProviderSelect(provider.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-lg border border-border transition-colors ${provider.bgColor}`}
                >
                  <div className="flex-shrink-0">{provider.icon}</div>
                  <div className="text-left">
                    <p className="font-medium">{provider.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {provider.description}
                    </p>
                  </div>
                  <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
                </button>
              ))}
            </div>
          )}

          {/* CalDAV form */}
          {view === "caldav" && (
            <form onSubmit={handleCalDAVSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  CalDAV Server URL
                </label>
                <input
                  type="url"
                  value={caldavUrl}
                  onChange={(e) => setCaldavUrl(e.target.value)}
                  placeholder="https://caldav.example.com/calendar"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Username
                </label>
                <input
                  type="text"
                  value={caldavUsername}
                  onChange={(e) => setCaldavUsername(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Password / App Password
                </label>
                <input
                  type="password"
                  value={caldavPassword}
                  onChange={(e) => setCaldavPassword(e.target.value)}
                  placeholder="App-specific password"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  For iCloud, use an app-specific password from appleid.apple.com
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setView("select")}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button type="submit" disabled={isLoading} className="flex-1">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    "Connect"
                  )}
                </Button>
              </div>
            </form>
          )}

          {/* ICS subscription form */}
          {view === "ics" && (
            <form onSubmit={handleICSSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Calendar URL
                </label>
                <input
                  type="url"
                  value={icsUrl}
                  onChange={(e) => setIcsUrl(e.target.value)}
                  placeholder="https://example.com/calendar.ics"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter a .ics or webcal:// URL
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Calendar Name (optional)
                </label>
                <input
                  type="text"
                  value={icsName}
                  onChange={(e) => setIcsName(e.target.value)}
                  placeholder="My Calendar"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setView("select")}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button type="submit" disabled={isLoading} className="flex-1">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Subscribing...
                    </>
                  ) : (
                    <>
                      <Link2 className="mr-2 h-4 w-4" />
                      Subscribe
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
