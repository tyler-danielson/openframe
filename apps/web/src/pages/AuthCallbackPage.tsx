import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "../stores/auth";
import { api } from "../services/api";

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
      const finalUrl = returnUrl && isSafeRedirect(returnUrl) ? returnUrl : "/dashboard";

      // On mobile, check for companion access and redirect there instead
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && window.innerWidth < 768;
      if (isMobile && (finalUrl === "/dashboard" || finalUrl === "/calendar")) {
        api.getCompanionAccessMe().then((ctx) => {
          if (ctx.isOwner || ctx.permissions) {
            navigate("/companion", { replace: true });
          } else {
            navigate(finalUrl, { replace: true });
          }
        }).catch(() => {
          navigate(finalUrl, { replace: true });
        });
      } else {
        navigate(finalUrl, { replace: true });
      }
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
