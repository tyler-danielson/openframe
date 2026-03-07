import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, UserPlus, CheckCircle, Clock, XCircle, Shield } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { api } from "../services/api";

type JoinStatus = "form" | "submitting" | "pending" | "approved" | "rejected" | "has_access" | "is_owner" | "error";

export function JoinPage() {
  const { kioskToken } = useParams<{ kioskToken: string }>();
  const navigate = useNavigate();

  const [status, setStatus] = useState<JoinStatus>("form");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kioskToken || !email.trim()) return;

    setStatus("submitting");
    setError(null);

    try {
      // Check if there's already a request or access for this email
      const check = await api.checkJoinStatus(kioskToken, email.trim());
      if (check.status !== "none") {
        setStatus(check.status as JoinStatus);
        return;
      }

      // Submit the request
      await api.submitJoinRequest(kioskToken, email.trim(), name.trim() || undefined);
      setStatus("pending");
    } catch (err: any) {
      setError(err.message || "Failed to submit request");
      setStatus("error");
    }
  };

  // Show the email form
  if (status === "form") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <UserPlus className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Request Access</CardTitle>
            <CardDescription>
              Enter your email to request companion access to this kiosk's calendar, tasks, and more.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Name (optional)</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                  placeholder="Your name"
                />
              </div>
              <Button type="submit" className="w-full gap-2">
                <UserPlus className="h-4 w-4" />
                Request Access
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "submitting") {
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
      description: "This email already has access. Sign in to use the companion app.",
    },
    is_owner: {
      icon: Shield,
      iconClass: "text-primary",
      bgClass: "bg-primary/10",
      title: "You Own This Kiosk",
      description: "This email belongs to the kiosk owner. You already have full access.",
    },
    rejected: {
      icon: XCircle,
      iconClass: "text-destructive",
      bgClass: "bg-destructive/10",
      title: "Request Declined",
      description: "A previous request for this email was declined by the kiosk owner.",
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
            <Button className="w-full" onClick={() => navigate("/companion/login")}>
              Sign In
            </Button>
          )}
          {status === "error" && (
            <Button className="w-full" onClick={() => setStatus("form")}>
              Try Again
            </Button>
          )}
          {status === "rejected" && (
            <Button className="w-full" variant="outline" onClick={() => setStatus("form")}>
              Try Different Email
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
