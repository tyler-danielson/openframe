import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/auth";
import { api, type Kiosk } from "../services/api";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { appUrl } from "../lib/cloud";

const CLOUD_URL = "https://openframe.us";

// Check if the current page is being served from a local/LAN server
// (as opposed to a cloud relay like openframe.us)
function isLocalOrigin(): boolean {
  const hostname = window.location.hostname;
  return hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname.startsWith("192.168.")
    || hostname.startsWith("10.")
    || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
}

type PageState = "server-entry" | "loading" | "login" | "picking" | "submitting" | "done" | "error";

export function TvSetupPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const code = searchParams.get("code") || "";
  // If redirected from cloud, this tells us where to POST the completion
  const cloudParam = searchParams.get("cloud") || "";

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setTokens = useAuthStore((state) => state.setTokens);

  const [pageState, setPageState] = useState<PageState>("loading");
  const [kiosks, setKiosks] = useState<Kiosk[]>([]);
  const [selectedKioskId, setSelectedKioskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Server URL entry state
  const [serverUrl, setServerUrl] = useState("");

  // Login form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  // OAuth providers
  const [providers, setProviders] = useState<{ google: boolean; microsoft: boolean } | null>(null);

  // Determine the cloud relay URL to POST completion to
  const cloudRelayUrl = cloudParam || CLOUD_URL;

  // If no code, show error immediately
  useEffect(() => {
    if (!code) {
      setPageState("error");
      setError("Invalid setup link — missing code parameter.");
    }
  }, [code]);

  // Determine initial state — probe the API to detect if we're on the server
  useEffect(() => {
    if (!code) return;

    if (isAuthenticated) {
      // Already logged in on this server — go straight to kiosk picking
      return;
    }

    // If we have a `cloud` param, we were redirected from the cloud page
    // to the local server — show login form
    if (cloudParam) {
      setPageState("login");
      return;
    }

    // If we're on a local/LAN server, we know we're on the right server
    if (isLocalOrigin()) {
      setPageState("login");
      return;
    }

    // For public domains, probe the API to check if we're on an OpenFrame server.
    // If the API responds, we're on the server — show login.
    // If it fails, we're on a different domain (e.g. the cloud) — show server-entry.
    api.getAvailableProviders()
      .then(() => setPageState("login"))
      .catch(() => setPageState("server-entry"));
  }, [code, isAuthenticated, cloudParam]);

  // Fetch available auth providers
  useEffect(() => {
    api.getAvailableProviders().then(setProviders).catch(() => setProviders({ google: false, microsoft: false }));
  }, []);

  // Build the return URL that preserves tv-setup params through OAuth
  const tvSetupReturnPath = `/tv-setup?code=${encodeURIComponent(code)}${cloudParam ? `&cloud=${encodeURIComponent(cloudParam)}` : ""}`;

  const handleGoogleLogin = () => {
    localStorage.setItem("oauth_return_url", tvSetupReturnPath);
    const returnUrl = encodeURIComponent(appUrl(tvSetupReturnPath));
    const callbackUrl = encodeURIComponent(appUrl("/auth/callback"));
    window.location.href = `/api/v1/auth/oauth/google?returnUrl=${returnUrl}&callbackUrl=${callbackUrl}`;
  };

  const handleMicrosoftLogin = () => {
    localStorage.setItem("oauth_return_url", tvSetupReturnPath);
    const returnUrl = encodeURIComponent(appUrl(tvSetupReturnPath));
    const callbackUrl = encodeURIComponent(appUrl("/auth/callback"));
    window.location.href = `/api/v1/auth/oauth/microsoft?returnUrl=${returnUrl}&callbackUrl=${callbackUrl}`;
  };

  const hasOAuthProviders = providers && (providers.google || providers.microsoft);

  // Once authenticated, load kiosks
  useEffect(() => {
    if (!isAuthenticated || !code) return;

    async function loadKiosks() {
      try {
        const list = await api.getKiosks();
        setKiosks(list);
        if (list.length > 0) setSelectedKioskId(list[0]!.id);
        setPageState("picking");
      } catch {
        setPageState("error");
        setError("Failed to load kiosks. Make sure you are connected to your OpenFrame server.");
      }
    }

    setPageState("loading");
    loadKiosks();
  }, [isAuthenticated, code]);

  const handleServerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let url = serverUrl.trim();
    if (!url) return;

    // Normalize: add http:// if no protocol specified
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `http://${url}`;
    }
    // Remove trailing slashes
    url = url.replace(/\/+$/, "");

    // Auto-append dev port for private/LAN IPs that have no port specified
    try {
      const parsed = new URL(url);
      if (!parsed.port) {
        const h = parsed.hostname;
        const isPrivateIP = h === "localhost" || h === "127.0.0.1"
          || h.startsWith("192.168.") || h.startsWith("10.")
          || /^172\.(1[6-9]|2\d|3[01])\./.test(h);
        if (isPrivateIP) {
          parsed.port = "5176";
          url = parsed.toString().replace(/\/+$/, "");
        }
      }
    } catch { /* invalid URL, let it fail naturally */ }

    // Redirect to the local server's tv-setup page, passing the cloud origin
    // so the local page knows where to POST the completion
    const cloudOrigin = window.location.origin;
    window.location.href = `${url}/tv-setup?code=${encodeURIComponent(code)}&cloud=${encodeURIComponent(cloudOrigin)}`;
  };

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
      // Ensure the code is registered on the cloud relay.
      // The TV may not have internet access to poll the cloud itself,
      // so the phone registers the code on its behalf.
      await fetch(`${cloudRelayUrl}/api/tv-setup?code=${encodeURIComponent(code)}`).catch(() => {});

      const res = await fetch(`${cloudRelayUrl}/api/tv-setup/${encodeURIComponent(code)}/complete`, {
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
          {/* Server URL entry — shown on cloud page before redirect */}
          {pageState === "server-entry" && (
            <form onSubmit={handleServerSubmit} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enter the URL of your OpenFrame server to connect your TV.
              </p>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-primary" htmlFor="serverUrl">
                  Server URL
                </label>
                <input
                  id="serverUrl"
                  type="url"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="http://192.168.1.100:5176"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Your phone must be on the same network as your server.
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={!serverUrl.trim()}>
                Continue
              </Button>
            </form>
          )}

          {/* Loading */}
          {pageState === "loading" && (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          )}

          {/* Login form */}
          {pageState === "login" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Log in to your OpenFrame account to pick a kiosk for your TV.
              </p>

              {/* OAuth buttons */}
              {hasOAuthProviders && (
                <div className="space-y-2">
                  {providers?.google && (
                    <Button
                      className="w-full gap-2"
                      variant="outline"
                      onClick={handleGoogleLogin}
                    >
                      <svg className="h-5 w-5" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="currentColor"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      Continue with Google
                    </Button>
                  )}
                  {providers?.microsoft && (
                    <Button
                      className="w-full gap-2"
                      variant="outline"
                      onClick={handleMicrosoftLogin}
                    >
                      <svg className="h-5 w-5" viewBox="0 0 24 24">
                        <path fill="#f25022" d="M1 1h10v10H1z" />
                        <path fill="#00a4ef" d="M1 13h10v10H1z" />
                        <path fill="#7fba00" d="M13 1h10v10H13z" />
                        <path fill="#ffb900" d="M13 13h10v10H13z" />
                      </svg>
                      Continue with Microsoft
                    </Button>
                  )}
                </div>
              )}

              {/* Divider between OAuth and password */}
              {hasOAuthProviders && (
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">or sign in with email</span>
                  </div>
                </div>
              )}

              {/* Password form */}
              <form onSubmit={handleLogin} className="space-y-4">
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
            </div>
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
