import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api, type AdminTicketListResponse } from "../../services/api";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

const STATUS_TABS = [
  { id: "", label: "All" },
  { id: "open", label: "Open" },
  { id: "in_progress", label: "In Progress" },
  { id: "waiting_on_user", label: "Waiting" },
  { id: "resolved", label: "Resolved" },
  { id: "closed", label: "Closed" },
];

const STATUS_BADGE: Record<string, string> = {
  open: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  in_progress: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  waiting_on_user: "bg-purple-500/10 text-purple-600 border-purple-500/30",
  resolved: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  closed: "bg-muted text-muted-foreground border-border",
};

const PRIORITY_BADGE: Record<string, string> = {
  low: "text-muted-foreground",
  normal: "text-foreground",
  high: "text-amber-600 font-medium",
  urgent: "text-destructive font-bold",
};

export function AdminSupportPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useMemo(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useQuery<AdminTicketListResponse>({
    queryKey: ["admin", "tickets", page, debouncedSearch, statusFilter],
    queryFn: () =>
      api.getAdminTickets({
        page,
        pageSize: 25,
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
      }),
  });

  return (
    <div className="p-6 max-w-6xl">
      <h1 className="text-2xl font-bold text-primary mb-6">Support Tickets</h1>

      {/* Status Tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setStatusFilter(tab.id);
              setPage(1);
            }}
            className={cn(
              "px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
              statusFilter === tab.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-primary/10"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search tickets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 h-10 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
        />
      </div>

      {/* Ticket Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Subject</th>
                <th className="text-left p-3 font-medium text-muted-foreground">User</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Priority</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Category</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Updated</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="p-3" colSpan={6}>
                        <div className="h-5 bg-muted rounded animate-pulse w-full" />
                      </td>
                    </tr>
                  ))
                : data?.items.map((ticket) => (
                    <tr
                      key={ticket.id}
                      onClick={() => navigate(`/admin/support/${ticket.id}`)}
                      className="border-b border-border hover:bg-primary/5 cursor-pointer transition-colors"
                    >
                      <td className="p-3 font-medium max-w-[200px] truncate">
                        {ticket.subject}
                      </td>
                      <td className="p-3">
                        <div className="text-sm">{ticket.user.name || ticket.user.email}</div>
                      </td>
                      <td className="p-3">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-xs border capitalize",
                            STATUS_BADGE[ticket.status] || STATUS_BADGE.open
                          )}
                        >
                          {ticket.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={cn(
                            "text-xs capitalize",
                            PRIORITY_BADGE[ticket.priority] || ""
                          )}
                        >
                          {ticket.priority}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground capitalize text-xs">
                        {ticket.category.replace(/_/g, " ")}
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">
                        {new Date(ticket.updatedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
              {!isLoading && data?.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No tickets found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.total > 0 && (
          <div className="flex items-center justify-between p-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Showing {(page - 1) * data.pageSize + 1}-
              {Math.min(page * data.pageSize, data.total)} of {data.total}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!data.hasMore}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
