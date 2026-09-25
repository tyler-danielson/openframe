import { QueryClient } from "@tanstack/react-query";

/**
 * The app's one React Query cache. It lives in its own module so that signing
 * out (lib/session) can empty it: cached responses belong to whoever was
 * signed in when they were fetched.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});
