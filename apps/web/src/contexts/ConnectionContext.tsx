import { createContext, useContext, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useConnectionHealth, type ConnectionStatus } from "../hooks/useConnectionHealth";

interface ConnectionContextValue {
  connectionStatus: ConnectionStatus;
  lastOnlineAt: Date | null;
  isOffline: boolean;
  checkNow: () => Promise<boolean>;
}

const ConnectionContext = createContext<ConnectionContextValue>({
  connectionStatus: "online",
  lastOnlineAt: null,
  isOffline: false,
  checkNow: async () => true,
});

export function useConnection() {
  return useContext(ConnectionContext);
}

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { status, lastOnlineAt, checkNow } = useConnectionHealth({
    enabled: true,
    onReconnect: () => {
      console.log("[Connection] Restored, refreshing data...");
      queryClient.invalidateQueries();
    },
  });

  return (
    <ConnectionContext.Provider
      value={{
        connectionStatus: status,
        lastOnlineAt,
        isOffline: status !== "online",
        checkNow,
      }}
    >
      {children}
    </ConnectionContext.Provider>
  );
}
