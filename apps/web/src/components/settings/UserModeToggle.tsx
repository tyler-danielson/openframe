import { Smartphone, Wrench } from "lucide-react";
import { useUserMode } from "../../hooks/useUserMode";

export function UserModeToggle() {
  const { mode, setMode } = useUserMode();

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-primary">Display Mode</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Choose how much of OpenFrame you want to see. You can switch anytime — nothing is deleted.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setMode("simple")}
          className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all ${
            mode === "simple"
              ? "border-primary bg-primary/5 shadow-sm"
              : "border-border hover:border-primary/40 hover:bg-accent"
          }`}
        >
          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
            mode === "simple" ? "bg-primary/10" : "bg-muted"
          }`}>
            <Smartphone className={`h-5 w-5 ${mode === "simple" ? "text-primary" : "text-muted-foreground"}`} />
          </div>
          <div>
            <p className="font-medium text-sm">Simple</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Calendar, tasks, weather, photos. Just the essentials.
            </p>
          </div>
          {mode === "simple" && (
            <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setMode("advanced")}
          className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all ${
            mode === "advanced"
              ? "border-primary bg-primary/5 shadow-sm"
              : "border-border hover:border-primary/40 hover:bg-accent"
          }`}
        >
          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
            mode === "advanced" ? "bg-primary/10" : "bg-muted"
          }`}>
            <Wrench className={`h-5 w-5 ${mode === "advanced" ? "text-primary" : "text-muted-foreground"}`} />
          </div>
          <div>
            <p className="font-medium text-sm">Advanced</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Everything — smart home, media, AI, custom screens, and more.
            </p>
          </div>
          {mode === "advanced" && (
            <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary" />
          )}
        </button>
      </div>
    </div>
  );
}
