import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type AdminTicketDetail } from "../../services/api";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { ArrowLeft, Send } from "lucide-react";
import { cn } from "../../lib/utils";
import { useState, useRef, useEffect } from "react";

const STATUSES = ["open", "in_progress", "waiting_on_user", "resolved", "closed"];
const PRIORITIES = ["low", "normal", "high", "urgent"];
const CATEGORIES = ["billing", "bug", "feature_request", "account", "general"];

export function AdminTicketDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [reply, setReply] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: ticket, isLoading } = useQuery<AdminTicketDetail>({
    queryKey: ["admin", "ticket", ticketId],
    queryFn: () => api.getAdminTicket(ticketId!),
    enabled: !!ticketId,
  });

  const updateMutation = useMutation({
    mutationFn: (data: { status?: string; priority?: string; category?: string }) =>
      api.updateAdminTicket(ticketId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "ticket", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "tickets"] });
    },
  });

  const replyMutation = useMutation({
    mutationFn: (content: string) => api.postAdminTicketMessage(ticketId!, content),
    onSuccess: () => {
      setReply("");
      queryClient.invalidateQueries({ queryKey: ["admin", "ticket", ticketId] });
    },
  });

  // Auto-scroll to newest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.messages.length]);

  if (isLoading || !ticket) {
    return (
      <div className="p-6">
        <div className="h-8 bg-muted rounded w-48 animate-pulse mb-6" />
        <div className="h-64 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  const handleSendReply = () => {
    if (!reply.trim()) return;
    replyMutation.mutate(reply.trim());
  };

  return (
    <div className="p-6 max-w-4xl">
      {/* Back button */}
      <button
        onClick={() => navigate("/admin/support")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Tickets
      </button>

      {/* Ticket Header */}
      <Card className="p-5 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-bold mb-1">{ticket.subject}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{ticket.user.name || ticket.user.email}</span>
              <span>&middot;</span>
              <span>{new Date(ticket.createdAt).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Inline editing dropdowns */}
        <div className="flex flex-wrap gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Status</label>
            <select
              value={ticket.status}
              onChange={(e) => updateMutation.mutate({ status: e.target.value })}
              className="h-8 px-2 rounded-md border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Priority</label>
            <select
              value={ticket.priority}
              onChange={(e) => updateMutation.mutate({ priority: e.target.value })}
              className="h-8 px-2 rounded-md border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Category</label>
            <select
              value={ticket.category}
              onChange={(e) => updateMutation.mutate({ category: e.target.value })}
              className="h-8 px-2 rounded-md border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Message Thread */}
      <Card className="p-5 mb-6">
        <h2 className="text-sm font-semibold text-primary mb-4">Messages</h2>
        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
          {ticket.messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex",
                msg.isAdminReply ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-lg px-4 py-3",
                  msg.isAdminReply
                    ? "bg-primary/10 border border-primary/20"
                    : "bg-accent border border-border"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium">
                    {msg.sender.name || msg.sender.email}
                  </span>
                  {msg.isAdminReply && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">
                      Admin
                    </span>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  {new Date(msg.createdAt).toLocaleString()}
                </span>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </Card>

      {/* Reply Input */}
      <Card className="p-4">
        <div className="flex gap-3">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Type your reply..."
            rows={3}
            className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleSendReply();
              }
            }}
          />
          <Button
            onClick={handleSendReply}
            disabled={!reply.trim() || replyMutation.isPending}
            className="self-end"
          >
            <Send className="h-4 w-4 mr-2" />
            Send
          </Button>
        </div>
      </Card>
    </div>
  );
}
