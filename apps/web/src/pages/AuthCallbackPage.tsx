import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "../stores/auth";

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setTokens = useAuthStore((state) => state.setTokens);

  useEffect(() => {
    const accessToken = searchParams.get("accessToken");
    const refreshToken = searchParams.get("refreshToken");
    const returnTo = searchParams.get("returnTo");

    if (accessToken && refreshToken) {
      setTokens(accessToken, refreshToken);

      // Use returnTo from URL params, fall back to localStorage, then default to dashboard
      let returnUrl = returnTo;
      if (!returnUrl) {
        returnUrl = localStorage.getItem("oauth_return_url");
        localStorage.removeItem("oauth_return_url");
      }

      const isSafeRedirect = (u: string) => u.startsWith("/") && !u.startsWith("//");
      navigate(returnUrl && isSafeRedirect(returnUrl) ? returnUrl : "/dashboard", { replace: true });
    } else {
      navigate("/login", { replace: true });
    }
  }, [searchParams, setTokens, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Signing you in...</p>
      </div>
    </div>
  );
}
