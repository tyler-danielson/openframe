import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, UserPlus, CheckCircle, Clock, XCircle, Shield } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { useAuthStore } from "../stores/auth";
import { api } from "../services/api";

export function JoinPage() {
  const { kioskToken } = useParams<{ kioskToken: string }>();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [status, setStatus] = useState<"loading" | "submitting" | "none" | "pending" | "approved" | "rejected" | "has_access" | "is_owner" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!kioskToken) return;

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      navigate(`/login?returnTo=/join/${kioskToken}`, { replace: true });
      return;
    }

    // Check current status
    api
      .checkJoinStatus(kioskToken)
      .then((data) => {
        if (data.status === "none") {
          // Auto-submit the join request
          setStatus("submitting");
          api
            .submitJoinRequest(kioskToken)
            .then(() => setStatus("pending"))
            .catch((err) => {
              setError(err.message || "Failed to submit request");
              setStatus("error");
            });
        } else {
          setStatus(data.status);
        }
      })
      .catch((err) => {
        setError(err.message || "Failed to check status");
        setStatus("error");
      });
  }, [kioskToken, isAuthenticated, navigate]);

  if (status === "loading" || status === "submitting") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const configs: Record<string, { icon: typeof CheckCircle; iconClass: string; bgClass: string; title: string; description: string }> = {
    pending: {
      icon: Clock,
      iconClass: "text-primary",
      bgClass: "bg-primary/10",
      title: "Request Sent",
      description: "Your request has been sent to the kiosk owner. You'll get access once they approve it.",
    },
    approved: {
      icon: CheckCircle,
      iconClass: "text-primary",
      bgClass: "bg-primary/10",
      title: "Request Approved",
      description: "Your request was approved! You now have companion access.",
    },
    has_access: {
      icon: CheckCircle,
      iconClass: "text-primary",
      bgClass: "bg-primary/10",
      title: "Already Connected",
      description: "You already have access to this kiosk. Open the companion app to get started.",
    },
    is_owner: {
      icon: Shield,
      iconClass: "text-primary",
      bgClass: "bg-primary/10",
      title: "You Own This Kiosk",
      description: "This is your own kiosk. You already have full access.",
    },
    rejected: {
      icon: XCircle,
      iconClass: "text-destructive",
      bgClass: "bg-destructive/10",
      title: "Request Declined",
      description: "Your request to join was declined by the kiosk owner.",
    },
    error: {
      icon: XCircle,
      iconClass: "text-destructive",
      bgClass: "bg-destructive/10",
      title: "Something Went Wrong",
      description: error || "An error occurred. Please try again.",
    },
  };

  const config = configs[status] || configs.error;
  const Icon = config.icon;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${config.bgClass}`}>
            <Icon className={`h-8 w-8 ${config.iconClass}`} />
          </div>
          <CardTitle className="text-2xl">{config.title}</CardTitle>
          <CardDescription>{config.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(status === "approved" || status === "has_access") && (
            <Button
              className="w-full"
              onClick={() => navigate("/companion")}
            >
              Open Companion App
            </Button>
          )}
          {status === "is_owner" && (
            <Button
              className="w-full"
              onClick={() => navigate("/settings/kiosks")}
            >
              Go to Kiosk Settings
            </Button>
          )}
          <Button
            className="w-full"
            variant="outline"
            onClick={() => navigate("/")}
          >
            Go Home
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
