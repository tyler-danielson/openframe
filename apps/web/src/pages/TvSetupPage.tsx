import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/auth";
import { api, type Kiosk } from "../services/api";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

const CLOUD_URL = "https://openframe.us";

type PageState = "loading" | "login" | "picking" | "submitting" | "done" | "error";

export function TvSetupPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const code = searchParams.get("code") || "";

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setTokens = useAuthStore((state) => state.setTokens);

  const [pageState, setPageState] = useState<PageState>("loading");
  const [kiosks, setKiosks] = useState<Kiosk[]>([]);
  const [selectedKioskId, setSelectedKioskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Login form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  // If no code, show error immediately
  useEffect(() => {
    if (!code) {
      setPageState("error");
      setError("Invalid setup link — missing code parameter.");
    }
  }, [code]);

  // Once authenticated, load kiosks
  useEffect(() => {
    if (!isAuthenticated || !code) return;

    async function loadKiosks() {
      try {
        const list = await api.getKiosks();
        setKiosks(list);
        if (list.length > 0) setSelectedKioskId(list[0].id);
        setPageState("picking");
      } catch {
        setPageState("error");
        setError("Failed to load kiosks. Make sure you are connected to your OpenFrame server.");
      }
    }

    setPageState("loading");
    loadKiosks();
  }, [isAuthenticated, code]);

  // If not authenticated, show login
  useEffect(() => {
    if (code && !isAuthenticated && pageState === "loading") {
      setPageState("login");
    }
  }, [code, isAuthenticated, pageState]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setLoginError("Email and password are required");
      return;
    }
    setLoggingIn(true);
    setLoginError(null);
    try {
      const result = await api.loginWithPassword(email, password);
      setTokens(result.accessToken, result.refreshToken);
      // useEffect above will kick off kiosk loading
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoggingIn(false);
    }
  };

  const handleConnect = async () => {
    const kiosk = kiosks.find((k) => k.id === selectedKioskId);
    if (!kiosk) return;

    setPageState("submitting");
    try {
      const res = await fetch(`${CLOUD_URL}/api/tv-setup/${encodeURIComponent(code)}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverUrl: window.location.origin,
          kioskToken: kiosk.token,
          kioskName: kiosk.name,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 404) throw new Error("Setup code expired or not found. Please restart the TV setup.");
        if (res.status === 409) throw new Error("This TV has already been set up.");
        throw new Error(data.error || `Server error (${res.status})`);
      }

      setPageState("done");
    } catch (err) {
      setPageState("error");
      setError(err instanceof Error ? err.message : "Failed to complete TV setup.");
    }
  };

  if (!code && pageState !== "error") return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <svg className="h-8 w-8 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <CardTitle className="text-2xl">TV Setup</CardTitle>
          <CardDescription>Connect your Samsung TV to OpenFrame</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Loading */}
          {pageState === "loading" && (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          )}

          {/* Login form */}
          {pageState === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Log in to your OpenFrame account to pick a kiosk for your TV.
              </p>
              {loginError && (
                <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
                  {loginError}
                </div>
              )}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-primary" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-primary" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loggingIn}>
                {loggingIn ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          )}

          {/* Kiosk picker */}
          {pageState === "picking" && (
            <>
              <p className="text-sm text-muted-foreground">
                Pick which kiosk this TV should display:
              </p>
              {kiosks.length === 0 ? (
                <div className="rounded-md border border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                  No kiosks found. Create a kiosk in Settings first.
                </div>
              ) : (
                <div className="space-y-2">
                  {kiosks.map((kiosk) => (
                    <button
                      key={kiosk.id}
                      onClick={() => setSelectedKioskId(kiosk.id)}
                      className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                        selectedKioskId === kiosk.id
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/40 hover:bg-primary/5"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-primary">{kiosk.name}</span>
                        <span
                          className={`text-xs rounded-full px-2 py-0.5 ${
                            kiosk.isActive
                              ? "bg-green-500/10 text-green-500"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {kiosk.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground capitalize">
                        {kiosk.displayType} · {kiosk.displayMode.replace("-", " ")}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {kiosks.length > 0 && (
                <Button
                  className="w-full"
                  disabled={!selectedKioskId}
                  onClick={handleConnect}
                >
                  Connect this kiosk to TV
                </Button>
              )}
            </>
          )}

          {/* Submitting */}
          {pageState === "submitting" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Connecting TV...</p>
            </div>
          )}

          {/* Done */}
          {pageState === "done" && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                <svg className="h-8 w-8 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-primary">TV Setup Complete!</p>
              <p className="text-sm text-muted-foreground">
                Your Samsung TV should connect automatically within a few seconds.
                You can close this page.
              </p>
              <Button variant="outline" className="mt-2" onClick={() => navigate("/dashboard")}>
                Go to Dashboard
              </Button>
            </div>
          )}

          {/* Error */}
          {pageState === "error" && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
                <svg className="h-8 w-8 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-primary">Setup Failed</p>
              <p className="text-sm text-muted-foreground">
                {error || "Something went wrong. Please try again."}
              </p>
              <Button variant="outline" className="mt-2" onClick={() => navigate("/dashboard")}>
                Go to Dashboard
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
