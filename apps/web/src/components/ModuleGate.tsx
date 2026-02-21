import { type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { MODULE_REGISTRY, type ModuleId } from "@openframe/shared";
import { useModuleStore } from "../stores/modules";
import { Puzzle } from "lucide-react";

interface ModuleGateProps {
  moduleId: string;
  children: ReactNode;
}

/**
 * Wraps a route so it only renders when the given module is enabled.
 * Shows a "Module not enabled" page with an action to go to Settings > Modules.
 */
export function ModuleGate({ moduleId, children }: ModuleGateProps) {
  const isEnabled = useModuleStore((s) => s.isEnabled(moduleId));

  if (!isEnabled) {
    return <ModuleNotInstalledPage moduleId={moduleId} />;
  }

  return <>{children}</>;
}

function ModuleNotInstalledPage({ moduleId }: { moduleId: string }) {
  const navigate = useNavigate();
  const moduleDef = MODULE_REGISTRY[moduleId as ModuleId];
  const name = moduleDef?.name ?? moduleId;
  const description = moduleDef?.description ?? "";

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Puzzle className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">
          {name} is not enabled
        </h2>
        <p className="text-muted-foreground">{description}</p>
        <button
          onClick={() => navigate("/settings?tab=modules")}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Puzzle className="h-4 w-4" />
          Enable in Settings
        </button>
      </div>
    </div>
  );
}
