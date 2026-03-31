import type { WidgetConfigProps } from "./types";

export function CountdownHolderConfig({
  config,
  onChange,
}: WidgetConfigProps) {
  return (
    <>
      <label className="block">
        <span className="text-sm font-medium">Expand Direction</span>
        <p className="text-xs text-muted-foreground mb-2">
          How the widget grows as countdown events are added
        </p>
        <div className="flex flex-col gap-2">
          {([
            { value: "fill", label: "Fill", desc: "Events fill the entire widget, text auto-sizes" },
            { value: "expand-down", label: "Expand Down", desc: "Events stack from the top down" },
            { value: "expand-up", label: "Expand Up", desc: "Events stack from the bottom up" },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange("expandDirection", opt.value)}
              className={`flex flex-col items-start px-3 py-2 rounded-lg border text-left transition-colors ${
                (config.expandDirection ?? "fill") === opt.value
                  ? "border-primary bg-primary/10"
                  : "border-border hover:bg-accent"
              }`}
            >
              <span className="text-sm font-medium">{opt.label}</span>
              <span className="text-xs text-muted-foreground">{opt.desc}</span>
            </button>
          ))}
        </div>
      </label>
    </>
  );
}
