// DEBUG: verify module evaluation
console.log("[OpenFrame] main.tsx evaluating, basename:", import.meta.env.VITE_BASE_PATH);

import { StrictMode, Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

// Error boundary to catch React rendering errors (window.onerror won't catch these)
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null; errorInfo: ErrorInfo | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[OpenFrame] React error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  override render() {
    if (this.state.error) {
      return (
        <pre
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "#1a1a2e",
            color: "#ff6b6b",
            padding: "20px",
            fontSize: "14px",
            fontFamily: "monospace",
            whiteSpace: "pre-wrap",
            overflow: "auto",
            zIndex: 99999,
          }}
        >
          {`OpenFrame React Error:\n\n${this.state.error.toString()}\n\n${this.state.error.stack || ""}\n\nComponent Stack:\n${this.state.errorInfo?.componentStack || "N/A"}`}
        </pre>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

// In cloud mode, the SPA is served under /app/
const basePath = import.meta.env.VITE_BASE_PATH || "/";
const basename = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;

console.log("[OpenFrame] mounting React, basename:", basename);
const rootEl = document.getElementById("root");
if (!rootEl) {
  document.body.innerHTML = '<pre style="color:red;padding:20px">FATAL: #root element not found</pre>';
  throw new Error("#root element not found");
}
createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter basename={basename || undefined}>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
);
