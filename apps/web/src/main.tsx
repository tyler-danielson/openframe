// DEBUG: verify module evaluation
console.log("[OpenFrame] main.tsx evaluating, basename:", import.meta.env.VITE_BASE_PATH);

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

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
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={basename || undefined}>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
