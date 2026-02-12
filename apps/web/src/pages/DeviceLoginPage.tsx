import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/auth";
import { api } from "../services/api";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

type PageState = "loading" | "ready" | "approving" | "approved" | "error" | "expired";

export function DeviceLoginPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const code = searchParams.get("code") || "";

  const [pageState, setPageState] = useState<PageState>("loading");
  const [userCode, setUserCode] = useState("");
  const [expiresIn, setExpiresIn] = useState(0);
  const [kioskName, setKioskName] = useState("TV Kiosk");
  const [error, setError] = useState<string | null>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      const returnTo = `/device-login?code=${encodeURIComponent(code)}`;
      navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
    }
  }, [isAuthenticated, code, navigate]);

  // Verify device code on mount
  useEffect(() => {
    if (!isAuthenticated || !code) return;

    async function verifyCode() {
      try {
        const data = await api.verifyDeviceCode(code);
        setUserCode(data.userCode);
        setExpiresIn(data.expiresIn);
        setPageState("ready");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Invalid or expired code";
        if (message.includes("expired")) {
          setPageState("expired");
        } else {
          setError(message);
          setPageState("error");
        }
      }
    }

    verifyCode();
  }, [isAuthenticated, code]);

  const handleApprove = async () => {
    setPageState("approving");
    try {
      await api.approveDeviceCode(userCode, kioskName.trim() || undefined);
      setPageState("approved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve device");
      setPageState("error");
    }
  };

  const handleDeny = () => {
    navigate("/dashboard");
  };

  const formatCode = (c: string) => {
    if (c.length === 6) {
      return `${c.slice(0, 3)}-${c.slice(3)}`;
    }
    return c;
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <svg className="h-8 w-8 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <CardTitle className="text-2xl">Approve Device</CardTitle>
          <CardDescription>
            A TV is requesting access to your OpenFrame account
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {pageState === "loading" && (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          )}

          {pageState === "ready" && (
            <>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">Device Code</p>
                <p className="text-3xl font-mono font-bold tracking-widest text-primary">
                  {formatCode(userCode)}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Expires in {Math.floor(expiresIn / 60)} min {expiresIn % 60}s
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-primary mb-1" htmlFor="kioskName">
                  Kiosk Name
                </label>
                <input
                  id="kioskName"
                  type="text"
                  value={kioskName}
                  onChange={(e) => setKioskName(e.target.value)}
                  placeholder="TV Kiosk"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Give this kiosk a name so you can identify it later
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  className="flex-1"
                  onClick={handleApprove}
                >
                  Approve
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleDeny}
                >
                  Deny
                </Button>
              </div>
            </>
          )}

          {pageState === "approving" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Approving device...</p>
            </div>
          )}

          {pageState === "approved" && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                <svg className="h-8 w-8 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-primary">Device Approved!</p>
              <p className="text-sm text-muted-foreground">
                The TV should connect automatically within a few seconds.
                You can close this page.
              </p>
              <Button
                variant="outline"
                className="mt-2"
                onClick={() => navigate("/dashboard")}
              >
                Go to Dashboard
              </Button>
            </div>
          )}

          {pageState === "expired" && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/10">
                <svg className="h-8 w-8 text-yellow-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-primary">Code Expired</p>
              <p className="text-sm text-muted-foreground">
                This code has expired. Please generate a new one on the TV.
              </p>
              <Button
                variant="outline"
                className="mt-2"
                onClick={() => navigate("/dashboard")}
              >
                Go to Dashboard
              </Button>
            </div>
          )}

          {pageState === "error" && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
                <svg className="h-8 w-8 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-primary">Error</p>
              <p className="text-sm text-muted-foreground">
                {error || "Something went wrong. Please try again."}
              </p>
              <Button
                variant="outline"
                className="mt-2"
                onClick={() => navigate("/dashboard")}
              >
                Go to Dashboard
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
