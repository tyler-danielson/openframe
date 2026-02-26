import { useCallback } from "react";
import { useDemoMode } from "../contexts/DemoContext";
import { useToast } from "../components/ui/Toaster";

export function useDemoGuard() {
  const { isDemoMode } = useDemoMode();
  const { toast } = useToast();

  const guard = useCallback(
    (action?: string) => {
      if (!isDemoMode) return false;
      toast({
        title: "Sign up to use this feature",
        description: action || "Create a free account to get started.",
      });
      return true; // blocked
    },
    [isDemoMode, toast]
  );

  return { isDemoMode, guard };
}
