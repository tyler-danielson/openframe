import { Outlet, useNavigate, useLocation, Link } from "react-router-dom";
import { Shield, LayoutDashboard, Users, LifeBuoy, Network, ArrowLeft } from "lucide-react";
import { useAuthStore } from "../../stores/auth";
import { isCloudMode } from "../../lib/cloud";
import { useEffect } from "react";

const navItems = [
  { path: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { path: "/admin/users", label: "Users", icon: Users },
  { path: "/admin/support", label: "Support", icon: LifeBuoy },
  { path: "/admin/topology", label: "Topology", icon: Network },
];

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);

  // Guard: redirect if not cloud mode or not admin
  useEffect(() => {
    if (!isCloudMode || !user || user.role !== "admin") {
      navigate("/", { replace: true });
    }
  }, [isCloudMode, user, navigate]);

  if (!isCloudMode || !user || user.role !== "admin") {
    return null;
  }

  const isActive = (item: (typeof navItems)[0]) => {
    if (item.exact) {
      return location.pathname === "/admin" || location.pathname === "/admin/";
    }
    return location.pathname.startsWith(item.path);
  };

  return (
    <div className="flex h-[100dvh] bg-background text-foreground">
      {/* Left Sidebar */}
      <aside className="w-56 shrink-0 bg-card border-r border-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <span className="font-semibold text-primary">Admin</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => {
            const active = isActive(item);
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-primary/10 hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Back to App */}
        <div className="p-2 border-t border-border">
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-primary/10 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to App
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
