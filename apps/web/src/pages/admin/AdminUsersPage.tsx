import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api, type AdminUserListResponse } from "../../services/api";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

const ROLE_BADGES: Record<string, string> = {
  admin: "bg-primary/10 text-primary border-primary/30",
  member: "bg-muted text-muted-foreground border-border",
  viewer: "bg-amber-500/10 text-amber-600 border-amber-500/30",
};

const ROLES = ["all", "admin", "member", "viewer"];

export function AdminUsersPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useMemo(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useQuery<AdminUserListResponse>({
    queryKey: ["admin", "users", page, debouncedSearch, roleFilter],
    queryFn: () =>
      api.getAdminUsers({
        page,
        pageSize: 25,
        search: debouncedSearch || undefined,
        role: roleFilter !== "all" ? roleFilter : undefined,
      }),
  });

  return (
    <div className="p-6 max-w-6xl">
      <h1 className="text-2xl font-bold text-primary mb-6">Users</h1>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 h-10 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
          />
        </div>
        <div className="flex gap-1">
          {ROLES.map((r) => (
            <button
              key={r}
              onClick={() => {
                setRoleFilter(r);
                setPage(1);
              }}
              className={cn(
                "px-3 py-2 rounded-lg text-xs font-medium transition-colors capitalize",
                roleFilter === r
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-primary/10"
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* User Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">User</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Role</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Plan</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Joined</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="p-3" colSpan={4}>
                        <div className="h-5 bg-muted rounded animate-pulse w-64" />
                      </td>
                    </tr>
                  ))
                : data?.items.map((user) => (
                    <tr
                      key={user.id}
                      onClick={() => navigate(`/admin/users/${user.id}`)}
                      className="border-b border-border hover:bg-primary/5 cursor-pointer transition-colors"
                    >
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          {user.avatarUrl ? (
                            <img
                              src={user.avatarUrl}
                              alt=""
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                              {(user.name || user.email)[0]?.toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="font-medium">{user.name || "No name"}</div>
                            <div className="text-xs text-muted-foreground">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-xs font-medium border capitalize",
                            ROLE_BADGES[user.role] || ROLE_BADGES.member
                          )}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="capitalize">{user.planName}</span>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.total > 0 && (
          <div className="flex items-center justify-between p-3 border-t border-border">
            <span className="text-xs text-muted-foreground">
              Showing {(page - 1) * (data.pageSize) + 1}-
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
