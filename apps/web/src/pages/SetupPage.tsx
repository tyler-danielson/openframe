import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, ArrowRight, ArrowLeft, Check, SkipForward, Loader2, Eye, EyeOff, Copy, Globe } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { useAuthStore } from "../stores/auth";
import { api } from "../services/api";

type SetupStep = "welcome" | "admin" | "server" | "google" | "microsoft" | "weather" | "location" | "complete";

const STEPS: SetupStep[] = ["welcome", "admin", "server", "google", "microsoft", "weather", "location", "complete"];

const STEP_LABELS: Record<SetupStep, string> = {
  welcome: "Welcome",
  admin: "Create Admin",
  server: "Server",
  google: "Google",
  microsoft: "Microsoft",
  weather: "Weather",
  location: "Location",
  complete: "Complete",
};

export function SetupPage() {
  const navigate = useNavigate();
  const setTokens = useAuthStore((s) => s.setTokens);

  const [currentStep, setCurrentStep] = useState<SetupStep>("welcome");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Admin form
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminName, setAdminName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Server settings
  const [serverName, setServerName] = useState("OpenFrame");
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [externalUrl, setExternalUrl] = useState(() => {
    // Auto-detect from current window location
    const loc = window.location;
    return `${loc.protocol}//${loc.host}`;
  });

  // Google
  const [googleClientId, setGoogleClientId] = useState("");
  const [googleClientSecret, setGoogleClientSecret] = useState("");

  // Microsoft
  const [msClientId, setMsClientId] = useState("");
  const [msClientSecret, setMsClientSecret] = useState("");
  const [msTenantId, setMsTenantId] = useState("common");

  // Weather
  const [weatherApiKey, setWeatherApiKey] = useState("");

  // Location
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [mapsApiKey, setMapsApiKey] = useState("");

  // Track what's been configured
  const [configured, setConfigured] = useState<Set<string>>(new Set());

  const stepIndex = STEPS.indexOf(currentStep);

  function goNext() {
    if (stepIndex < STEPS.length - 1) {
      setError(null);
      setCurrentStep(STEPS[stepIndex + 1]!);
    }
  }

  function goBack() {
    if (stepIndex > 0) {
      setError(null);
      setCurrentStep(STEPS[stepIndex - 1]!);
    }
  }

  async function handleCreateAdmin() {
    if (!adminEmail || !adminPassword || !adminName) {
      setError("All fields are required");
      return;
    }
    if (adminPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await api.createAdmin({
        email: adminEmail,
        password: adminPassword,
        name: adminName,
      });
      setTokens(result.accessToken, result.refreshToken);
      goNext();
    } catch (err: any) {
      setError(err.message || "Failed to create admin");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveSettings(category: string, settings: Record<string, string>) {
    setLoading(true);
    setError(null);
    try {
      // Filter out empty values
      const filtered: Record<string, string> = {};
      for (const [k, v] of Object.entries(settings)) {
        if (v) filtered[k] = v;
      }
      if (Object.keys(filtered).length > 0) {
        await api.setupConfigure(category, filtered);
        setConfigured((prev) => new Set(prev).add(category));
      }
      goNext();
    } catch (err: any) {
      setError(err.message || "Failed to save settings");
    } finally {
      setLoading(false);
    }
  }

  async function handleComplete() {
    setLoading(true);
    setError(null);
    try {
      await api.completeSetup();
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setError(err.message || "Failed to complete setup");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg">
        {/* Progress indicator */}
        <div className="mb-6 flex items-center justify-center gap-1.5">
          {STEPS.map((step, i) => (
            <div
              key={step}
              className={`h-2 rounded-full transition-all ${
                i < stepIndex
                  ? "w-8 bg-primary"
                  : i === stepIndex
                    ? "w-8 bg-primary"
                    : "w-2 bg-muted"
              }`}
            />
          ))}
        </div>

        <Card>
          {/* Welcome */}
          {currentStep === "welcome" && (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Calendar className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">Welcome to OpenFrame</CardTitle>
                <CardDescription>
                  Let's set up your self-hosted calendar dashboard. This wizard will walk you through creating an admin account and configuring your integrations.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Every step after creating your admin account is optional and can be configured later in Settings.
                </p>
                <Button className="w-full gap-2" onClick={goNext}>
                  Get Started <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </>
          )}

          {/* Create Admin */}
          {currentStep === "admin" && (
            <>
              <CardHeader>
                <CardTitle>Create Admin Account</CardTitle>
                <CardDescription>
                  This will be the primary administrator for your OpenFrame instance.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-primary">Name</label>
                  <input
                    type="text"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-primary">Email</label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                    placeholder="admin@example.com"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-primary">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 pr-10 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                      placeholder="Minimum 8 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={goBack} className="gap-1">
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                  <Button className="flex-1 gap-2" onClick={handleCreateAdmin} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Create Account <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {/* Server Settings */}
          {currentStep === "server" && (
            <>
              <CardHeader>
                <CardTitle>Server Settings</CardTitle>
                <CardDescription>
                  Basic configuration for your OpenFrame server.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-primary">External URL</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={externalUrl}
                      onChange={(e) => setExternalUrl(e.target.value)}
                      className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                      placeholder="https://openframe.example.com"
                    />
                    <button
                      type="button"
                      onClick={() => setExternalUrl(window.location.origin)}
                      className="shrink-0 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-colors"
                      title="Use current URL"
                    >
                      <Globe className="h-4 w-4 inline-block mr-1" />
                      Use Current
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    The URL where this server is accessible. Auto-detected from your browser. Used for OAuth redirects and QR codes.
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-primary">Server Name</label>
                  <input
                    type="text"
                    value={serverName}
                    onChange={(e) => setServerName(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                    placeholder="OpenFrame"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-primary">Timezone</label>
                  <input
                    type="text"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                    placeholder="America/New_York"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Auto-detected from your browser. Change if needed.
                  </p>
                </div>

                {/* Show computed redirect URIs */}
                {externalUrl && (
                  <div className="rounded-lg border border-border bg-muted/50 p-3">
                    <p className="text-xs font-medium text-primary mb-2">OAuth Redirect URIs</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      Use these URLs when configuring OAuth apps in Google Cloud Console, Microsoft Entra, and Spotify Developer Dashboard.
                    </p>
                    {[
                      { label: "Google", path: "/api/v1/auth/oauth/google/callback" },
                      { label: "Microsoft", path: "/api/v1/auth/oauth/microsoft/callback" },
                      { label: "Spotify", path: "/api/v1/spotify/auth/callback" },
                    ].map((item) => {
                      const uri = `${externalUrl.replace(/\/+$/, "")}${item.path}`;
                      return (
                        <div key={item.label} className="flex items-center gap-1 mb-1">
                          <span className="text-xs font-medium w-16 shrink-0">{item.label}:</span>
                          <code className="text-xs bg-background border border-border rounded px-1.5 py-0.5 truncate flex-1">{uri}</code>
                          <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText(uri)}
                            className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-primary"
                            title="Copy"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={goBack} className="gap-1">
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                  <Button
                    className="flex-1 gap-2"
                    onClick={async () => {
                      setLoading(true);
                      setError(null);
                      try {
                        // Save server settings (external_url) to the server category
                        if (externalUrl) {
                          await api.setupConfigure("server", { external_url: externalUrl });
                          setConfigured((prev) => new Set(prev).add("server"));
                        }
                        // Save home settings (server_name, timezone) to the home category
                        await api.setupConfigure("home", { server_name: serverName, timezone });
                        setConfigured((prev) => new Set(prev).add("home"));
                        goNext();
                      } catch (err: any) {
                        setError(err.message || "Failed to save settings");
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Next <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {/* Google OAuth */}
          {currentStep === "google" && (
            <>
              <CardHeader>
                <CardTitle>Google OAuth</CardTitle>
                <CardDescription>
                  Connect Google for calendar sync, tasks, photos, and more. Get credentials from the{" "}
                  <a
                    href="https://console.cloud.google.com/apis/credentials"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    Google Cloud Console
                  </a>.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-primary">Client ID</label>
                  <input
                    type="text"
                    value={googleClientId}
                    onChange={(e) => setGoogleClientId(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                    placeholder="xxxxxx.apps.googleusercontent.com"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-primary">Client Secret</label>
                  <input
                    type="password"
                    value={googleClientSecret}
                    onChange={(e) => setGoogleClientSecret(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                    placeholder="GOCSPX-xxxxxx"
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={goBack} className="gap-1">
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                  <Button variant="ghost" onClick={goNext} className="gap-1">
                    <SkipForward className="h-4 w-4" /> Skip
                  </Button>
                  <Button
                    className="flex-1 gap-2"
                    onClick={() =>
                      handleSaveSettings("google", {
                        client_id: googleClientId,
                        client_secret: googleClientSecret,
                      })
                    }
                    disabled={loading || (!googleClientId && !googleClientSecret)}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Save & Next <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {/* Microsoft OAuth */}
          {currentStep === "microsoft" && (
            <>
              <CardHeader>
                <CardTitle>Microsoft OAuth</CardTitle>
                <CardDescription>
                  Connect Microsoft for Outlook calendar and tasks. Get credentials from{" "}
                  <a
                    href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    Azure Portal
                  </a>.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-primary">Application (Client) ID</label>
                  <input
                    type="text"
                    value={msClientId}
                    onChange={(e) => setMsClientId(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-primary">Client Secret</label>
                  <input
                    type="password"
                    value={msClientSecret}
                    onChange={(e) => setMsClientSecret(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                    placeholder="Client secret value"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-primary">Tenant ID</label>
                  <input
                    type="text"
                    value={msTenantId}
                    onChange={(e) => setMsTenantId(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                    placeholder="common"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Use "common" for multi-tenant, or your specific tenant ID.
                  </p>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={goBack} className="gap-1">
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                  <Button variant="ghost" onClick={goNext} className="gap-1">
                    <SkipForward className="h-4 w-4" /> Skip
                  </Button>
                  <Button
                    className="flex-1 gap-2"
                    onClick={() =>
                      handleSaveSettings("microsoft", {
                        client_id: msClientId,
                        client_secret: msClientSecret,
                        tenant_id: msTenantId,
                      })
                    }
                    disabled={loading || (!msClientId && !msClientSecret)}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Save & Next <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {/* Weather */}
          {currentStep === "weather" && (
            <>
              <CardHeader>
                <CardTitle>Weather</CardTitle>
                <CardDescription>
                  Add an OpenWeatherMap API key for weather display. Get a free key at{" "}
                  <a
                    href="https://openweathermap.org/api"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    openweathermap.org
                  </a>.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-primary">API Key</label>
                  <input
                    type="password"
                    value={weatherApiKey}
                    onChange={(e) => setWeatherApiKey(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                    placeholder="Your OpenWeatherMap API key"
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={goBack} className="gap-1">
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                  <Button variant="ghost" onClick={goNext} className="gap-1">
                    <SkipForward className="h-4 w-4" /> Skip
                  </Button>
                  <Button
                    className="flex-1 gap-2"
                    onClick={() => handleSaveSettings("weather", { api_key: weatherApiKey })}
                    disabled={loading || !weatherApiKey}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Save & Next <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {/* Location */}
          {currentStep === "location" && (
            <>
              <CardHeader>
                <CardTitle>Home Location</CardTitle>
                <CardDescription>
                  Set your home coordinates for weather, commute times, and other location features.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-primary">Latitude</label>
                    <input
                      type="text"
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                      placeholder="40.7128"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-primary">Longitude</label>
                    <input
                      type="text"
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                      placeholder="-74.0060"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-primary">Google Maps API Key</label>
                  <input
                    type="password"
                    value={mapsApiKey}
                    onChange={(e) => setMapsApiKey(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                    placeholder="AIzaSy... (optional, for commute times)"
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={goBack} className="gap-1">
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                  <Button variant="ghost" onClick={goNext} className="gap-1">
                    <SkipForward className="h-4 w-4" /> Skip
                  </Button>
                  <Button
                    className="flex-1 gap-2"
                    onClick={async () => {
                      // Save location to home category, maps key to google category
                      setLoading(true);
                      setError(null);
                      try {
                        const homeSettings: Record<string, string> = {};
                        if (latitude) homeSettings.latitude = latitude;
                        if (longitude) homeSettings.longitude = longitude;
                        if (Object.keys(homeSettings).length > 0) {
                          await api.setupConfigure("home", homeSettings);
                          setConfigured((prev) => new Set(prev).add("home"));
                        }
                        if (mapsApiKey) {
                          await api.setupConfigure("google", { maps_api_key: mapsApiKey });
                        }
                        goNext();
                      } catch (err: any) {
                        setError(err.message || "Failed to save settings");
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading || (!latitude && !longitude && !mapsApiKey)}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Save & Next <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {/* Complete */}
          {currentStep === "complete" && (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Check className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">Setup Complete!</CardTitle>
                <CardDescription>
                  Your OpenFrame instance is ready to use.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border border-border bg-muted/50 p-4">
                  <h4 className="mb-2 text-sm font-medium text-primary">Configured:</h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-primary" /> Admin account created
                    </li>
                    {configured.has("server") && (
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-primary" /> External URL configured
                      </li>
                    )}
                    {configured.has("home") && (
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-primary" /> Server settings
                      </li>
                    )}
                    {configured.has("google") && (
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-primary" /> Google OAuth
                      </li>
                    )}
                    {configured.has("microsoft") && (
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-primary" /> Microsoft OAuth
                      </li>
                    )}
                    {configured.has("weather") && (
                      <li className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-primary" /> Weather
                      </li>
                    )}
                  </ul>
                </div>
                <p className="text-sm text-muted-foreground">
                  You can configure additional integrations anytime from Settings.
                </p>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button className="w-full gap-2" onClick={handleComplete} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Go to Dashboard <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </>
          )}
        </Card>

        {/* Step label */}
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Step {stepIndex + 1} of {STEPS.length} — {STEP_LABELS[currentStep]}
        </p>
      </div>
    </div>
  );
}
