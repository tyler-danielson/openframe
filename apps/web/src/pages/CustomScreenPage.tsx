import { Component, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../services/api";
import { BuilderCanvas } from "../components/builder/BuilderCanvas";
import { BuilderProvider } from "../contexts/BuilderContext";
import { type ScreensaverLayoutConfig, DEFAULT_LAYOUT_CONFIG } from "../stores/screensaver";

// ErrorBoundary to catch and display React errors with component stack
class CustomScreenErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null; errorInfo: { componentStack: string } | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  override componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    this.setState({ error, errorInfo });
    console.error("[CustomScreen] React error caught:", error.message);
    console.error("[CustomScreen] Component stack:", errorInfo.componentStack);
  }

  override render() {
    if (this.state.error) {
      return (
        <div style={{
          position: "fixed", inset: 0, background: "#1a1a2e", color: "#e0e0e0",
          padding: "20px", overflow: "auto", fontFamily: "monospace", fontSize: "13px",
          zIndex: 9999,
        }}>
          <h2 style={{ color: "#ff6b6b", marginBottom: "12px" }}>
            React Error #{this.state.error.message.match(/\d+/)?.[0] || "?"}
          </h2>
          <div style={{ color: "#ffd93d", marginBottom: "16px", whiteSpace: "pre-wrap" }}>
            {this.state.error.message}
          </div>
          <h3 style={{ color: "#6bcb77", marginBottom: "8px" }}>Component Stack:</h3>
          <pre style={{
            background: "#0d1117", padding: "12px", borderRadius: "8px",
            whiteSpace: "pre-wrap", lineHeight: "1.6", fontSize: "12px",
          }}>
            {this.state.errorInfo?.componentStack || "No component stack available"}
          </pre>
          <h3 style={{ color: "#6bcb77", marginTop: "16px", marginBottom: "8px" }}>Stack Trace:</h3>
          <pre style={{
            background: "#0d1117", padding: "12px", borderRadius: "8px",
            whiteSpace: "pre-wrap", lineHeight: "1.4", fontSize: "11px",
            maxHeight: "300px", overflow: "auto",
          }}>
            {this.state.error.stack || "No stack trace"}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export function CustomScreenPage({ screenId: propScreenId }: { screenId?: string } = {}) {
  const { slug, dashboardId } = useParams<{ slug?: string; dashboardId?: string }>();

  // Fetch by slug (direct access via /screen/:slug)
  const { data: screenBySlug, isLoading: loadingBySlug, error: errorBySlug } = useQuery({
    queryKey: ["custom-screen", slug],
    queryFn: () => api.getCustomScreenBySlug(slug!),
    enabled: !!slug,
  });

  // Fetch by screen ID (when passed as prop from kiosk dashboard config)
  const { data: screenById, isLoading: loadingById } = useQuery({
    queryKey: ["custom-screen-id", propScreenId],
    queryFn: () => api.getCustomScreen(propScreenId!),
    enabled: !!propScreenId && !slug,
  });

  // Fetch all screens to resolve dashboardId → screenId (fallback for /d/:dashboardId route)
  const { data: allScreens, isLoading: loadingAll } = useQuery({
    queryKey: ["custom-screens"],
    queryFn: () => api.getCustomScreens(),
    enabled: !!dashboardId && !slug && !propScreenId,
  });

  // For /d/:dashboardId route, try to find the screen (first screen as fallback)
  const screenFromAll = allScreens?.[0] ?? null;

  const screen = screenBySlug || screenById || screenFromAll;
  const isLoading = (!!slug && loadingBySlug) || (!!propScreenId && !slug && loadingById) || (!!dashboardId && !slug && !propScreenId && loadingAll);
  const error = slug ? errorBySlug : null;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error || !screen) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Screen not found</p>
      </div>
    );
  }

  const layoutConfig: ScreensaverLayoutConfig = {
    ...DEFAULT_LAYOUT_CONFIG,
    ...(screen.layoutConfig as Partial<ScreensaverLayoutConfig>),
  };

  return (
    <CustomScreenErrorBoundary>
      <div className="h-full w-full">
        <BuilderProvider initialConfig={layoutConfig}>
          <BuilderCanvas showGrid={false} previewMode={true} liveMode={true} />
        </BuilderProvider>
      </div>
    </CustomScreenErrorBoundary>
  );
}
