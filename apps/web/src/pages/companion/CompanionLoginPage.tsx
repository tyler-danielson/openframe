import { useNavigate } from "react-router-dom";
import { Smartphone, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { useAuthStore } from "../../stores/auth";
import { useEffect, useState } from "react";
import { api } from "../../services/api";

const getApiServerUrl = () => "";

export function CompanionLoginPage() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setTokens = useAuthStore((state) => state.setTokens);

  const returnTo = "/companion";

  const [providers, setProviders] = useState<{ google: boolean; microsoft: boolean } | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(returnTo, { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    api.getAvailableProviders().then(setProviders).catch(() => setProviders({ google: false, microsoft: false }));
  }, []);

  const handleGoogleLogin = () => {
    const returnUrl = encodeURIComponent(window.location.origin + returnTo);
    window.location.href = `${getApiServerUrl()}/api/v1/auth/oauth/google?returnUrl=${returnUrl}`;
  };

  const handleMicrosoftLogin = () => {
    const returnUrl = encodeURIComponent(window.location.origin + returnTo);
    window.location.href = `${getApiServerUrl()}/api/v1/auth/oauth/microsoft?returnUrl=${returnUrl}`;
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
      navigate(returnTo, { replace: true });
    } catch (err: any) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const hasOAuthProviders = providers && (providers.google || providers.microsoft);

  return (
    <div className="flex flex-col h-[100dvh] bg-background text-foreground">
      {/* Top section with branding */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-12 pb-6">
        <div className="flex items-center justify-center h-20 w-20 rounded-2xl bg-primary/10 mb-4">
          <Smartphone className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">OpenFrame</h1>
        <p className="text-sm text-muted-foreground mt-1">Companion</p>
      </div>

      {/* Login form */}
      <div className="px-6 pb-8 space-y-4 max-w-sm mx-auto w-full">
        <form onSubmit={handlePasswordLogin} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
            placeholder="Email address"
            autoComplete="email"
          />
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-4 py-3 pr-11 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
              placeholder="Password"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {error && <p className="text-sm text-destructive px-1">{error}</p>}
          <Button type="submit" className="w-full h-12 rounded-xl text-base gap-2" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Sign In
          </Button>
        </form>

        {hasOAuthProviders && (
          <>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <div className="space-y-3">
              {providers?.google && (
                <Button
                  className="w-full h-12 rounded-xl gap-2"
                  variant="outline"
                  onClick={handleGoogleLogin}
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continue with Google
                </Button>
              )}
              {providers?.microsoft && (
                <Button
                  className="w-full h-12 rounded-xl gap-2"
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
          </>
        )}
      </div>
    </div>
  );
}
