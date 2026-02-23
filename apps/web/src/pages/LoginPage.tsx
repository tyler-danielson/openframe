import { useNavigate } from "react-router-dom";
import { Calendar, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { useAuthStore } from "../stores/auth";
import { useEffect, useState } from "react";
import { api } from "../services/api";
import { appUrl } from "../lib/cloud";

export function LoginPage() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setTokens = useAuthStore((state) => state.setTokens);

  const isSafeRedirect = (u: string) => u.startsWith("/") && !u.startsWith("//");
  const rawReturnTo = new URLSearchParams(window.location.search).get("returnTo");
  const returnTo = rawReturnTo && isSafeRedirect(rawReturnTo) ? rawReturnTo : "/dashboard";

  // Provider availability
  const [providers, setProviders] = useState<{ google: boolean; microsoft: boolean } | null>(null);

  // Password form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(returnTo);
    }
  }, [isAuthenticated, navigate, returnTo]);

  // Fetch available providers
  useEffect(() => {
    api.getAvailableProviders().then(setProviders).catch(() => setProviders({ google: false, microsoft: false }));
  }, []);

  const handleGoogleLogin = () => {
    const returnUrl = encodeURIComponent(appUrl(returnTo));
    const callbackUrl = encodeURIComponent(appUrl("/auth/callback"));
    window.location.href = `/api/v1/auth/oauth/google?returnUrl=${returnUrl}&callbackUrl=${callbackUrl}`;
  };

  const handleMicrosoftLogin = () => {
    const returnUrl = encodeURIComponent(appUrl(returnTo));
    const callbackUrl = encodeURIComponent(appUrl("/auth/callback"));
    window.location.href = `/api/v1/auth/oauth/microsoft?returnUrl=${returnUrl}&callbackUrl=${callbackUrl}`;
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Email and password are required");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await api.loginWithPassword(email, password);
      setTokens(result.accessToken, result.refreshToken);
      navigate(returnTo);
    } catch (err: any) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const hasOAuthProviders = providers && (providers.google || providers.microsoft);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Calendar className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Welcome to OpenFrame</CardTitle>
          <CardDescription>
            Sign in to access your calendar dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Password login form */}
          <form onSubmit={handlePasswordLogin} className="space-y-3">
            <div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                placeholder="Email address"
              />
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 pr-10 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                placeholder="Password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Sign In
            </Button>
          </form>

          {/* OAuth divider and buttons */}
          {hasOAuthProviders && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or continue with</span>
                </div>
              </div>

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
            </>
          )}

          <p className="text-center text-xs text-muted-foreground">
            By signing in, you agree to sync your calendar data with OpenFrame.
            Your data is stored locally and never shared.
          </p>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <a
            href="/demo"
            className="flex items-center justify-center gap-2 w-full rounded-md border border-primary/40 bg-primary/5 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
          >
            Try Demo Mode
          </a>
          <p className="text-center text-xs text-muted-foreground">
            Explore with sample data — no account needed
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
