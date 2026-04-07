import { type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Settings } from "lucide-react";
import { useUserMode } from "../hooks/useUserMode";

interface ModeGateProps {
  children: ReactNode;
}

/**
 * Wraps a route so it only renders when the user is in Advanced mode.
 * Shows a friendly page explaining the feature requires Advanced mode.
 */
export function ModeGate({ children }: ModeGateProps) {
  const { isAdvanced } = useUserMode();

  if (!isAdvanced) {
    return <AdvancedModeRequiredPage />;
  }

  return <>{children}</>;
}

function AdvancedModeRequiredPage() {
  const navigate = useNavigate();

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Settings className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">
          Advanced Feature
        </h2>
        <p className="text-muted-foreground">
          This feature is available in Advanced mode. Switch your display mode in Settings to access it.
        </p>
        <button
          onClick={() => navigate("/settings/account")}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Settings className="h-4 w-4" />
          Go to Settings
        </button>
      </div>
    </div>
  );
}
