import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, X, Loader2, UserPlus, Clock } from "lucide-react";
import { api, type JoinRequest } from "../../services/api";
import { Card } from "../../components/ui/Card";

export function CompanionJoinRequestsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["join-requests", "pending"],
    queryFn: () => api.getJoinRequests("pending"),
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => api.approveJoinRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["join-requests"] });
      queryClient.invalidateQueries({ queryKey: ["join-request-count"] });
    },
  });

  const rejectMut = useMutation({
    mutationFn: (id: string) => api.rejectJoinRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["join-requests"] });
      queryClient.invalidateQueries({ queryKey: ["join-request-count"] });
    },
  });

  return (
    <div className="p-4 pb-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/companion/more")}
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-card border border-border min-h-[44px] min-w-[44px] hover:bg-muted/50 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold text-foreground">Join Requests</h1>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : requests.length === 0 ? (
        <Card className="p-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <UserPlus className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">No pending join requests</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((req: JoinRequest) => (
            <Card key={req.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0">
                  {req.userAvatar ? (
                    <img src={req.userAvatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <span className="text-sm font-medium text-primary">
                      {(req.userName || req.userEmail || "?")[0]?.toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {req.userName || req.userEmail}
                  </p>
                  {req.userName && req.userEmail && (
                    <p className="text-xs text-muted-foreground truncate">{req.userEmail}</p>
                  )}
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                      {req.kioskName && <span>{req.kioskName} &middot; </span>}
                      {new Date(req.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
              {req.message && (
                <p className="mt-2 text-sm text-muted-foreground italic">"{req.message}"</p>
              )}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => approveMut.mutate(req.id)}
                  disabled={approveMut.isPending || rejectMut.isPending}
                  className="flex-1 flex items-center justify-center gap-2 h-11 min-h-[44px] rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {approveMut.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Approve
                </button>
                <button
                  onClick={() => rejectMut.mutate(req.id)}
                  disabled={approveMut.isPending || rejectMut.isPending}
                  className="flex-1 flex items-center justify-center gap-2 h-11 min-h-[44px] rounded-lg border border-border text-foreground font-medium text-sm hover:bg-muted/50 transition-colors disabled:opacity-50"
                >
                  {rejectMut.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                  Decline
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
