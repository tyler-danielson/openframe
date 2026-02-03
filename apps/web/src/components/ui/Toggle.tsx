import { cn } from "../../lib/utils";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
}

export function Toggle({ checked, onChange, size = "md", disabled = false, className }: ToggleProps) {
  const sizes = {
    sm: {
      track: "h-5 w-9",
      thumb: "h-3.5 w-3.5",
      translate: "translate-x-4",
    },
    md: {
      track: "h-6 w-11",
      thumb: "h-4 w-4",
      translate: "translate-x-5",
    },
  };

  const s = sizes[size];

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        s.track,
        checked ? "bg-primary" : "bg-muted-foreground/30",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out",
          s.thumb,
          checked ? s.translate : "translate-x-0.5",
          "mt-[3px] ml-0.5"
        )}
      />
    </button>
  );
}

interface ToggleGroupProps {
  items: {
    key: string;
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
  }[];
  className?: string;
}

export function ToggleGroup({ items, className }: ToggleGroupProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => item.onChange(!item.checked)}
          className={cn(
            "px-2 py-1 text-xs font-medium rounded-md transition-all duration-200",
            item.checked
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
