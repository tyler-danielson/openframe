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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={basename || undefined}>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
