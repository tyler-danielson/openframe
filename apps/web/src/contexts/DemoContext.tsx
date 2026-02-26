import { createContext, useContext, useMemo, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  DEMO_CALENDARS,
  DEMO_WEATHER,
  DEMO_HOURLY,
  DEMO_FORECAST,
  DEMO_TASK_LISTS,
  DEMO_TASKS,
  DEMO_HEADLINES,
  DEMO_USER,
  generateDemoEvents,
} from "../data/demoData";

interface DemoContextValue {
  isDemoMode: boolean;
}

const DemoContext = createContext<DemoContextValue>({ isDemoMode: false });

export function useDemoMode() {
  return useContext(DemoContext);
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const demoClient = useMemo(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: Infinity,
          refetchInterval: false,
          refetchOnWindowFocus: false,
          refetchOnReconnect: false,
          retry: false,
        },
      },
    });

    // Pre-seed exact-match query keys
    client.setQueryData(["calendars"], DEMO_CALENDARS);
    client.setQueryData(["weather-current"], DEMO_WEATHER);
    client.setQueryData(["weather", "current"], DEMO_WEATHER);
    client.setQueryData(["weather-hourly"], DEMO_HOURLY);
    client.setQueryData(["weather", "hourly"], DEMO_HOURLY);
    client.setQueryData(["weather-forecast"], DEMO_FORECAST);
    client.setQueryData(["task-lists"], DEMO_TASK_LISTS);
    client.setQueryData(["me"], DEMO_USER);
    client.setQueryData(["todays-sports"], []);
    client.setQueryData(["favorite-teams"], []);

    // Set queryDefaults for prefix-matched keys (dynamic suffixes)
    client.setQueryDefaults(["events"], {
      queryFn: () => Promise.resolve(generateDemoEvents()),
    });
    client.setQueryDefaults(["tasks"], {
      queryFn: () => Promise.resolve(DEMO_TASKS),
    });
    client.setQueryDefaults(["news-headlines"], {
      queryFn: () => Promise.resolve(DEMO_HEADLINES),
    });
    client.setQueryDefaults(["sports-events"], {
      queryFn: () => Promise.resolve([]),
    });

    return client;
  }, []);

  return (
    <DemoContext.Provider value={{ isDemoMode: true }}>
      <QueryClientProvider client={demoClient}>
        {children}
      </QueryClientProvider>
    </DemoContext.Provider>
  );
}
