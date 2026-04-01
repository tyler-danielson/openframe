import { useState, useEffect } from "react";
import { cn } from "../../lib/utils";

interface RecurrencePickerProps {
  value: string | null; // RRULE string or null
  onChange: (value: string | null) => void;
  className?: string;
}

type Frequency = "none" | "daily" | "weekly" | "monthly" | "yearly" | "custom";

const presets: { label: string; freq: Frequency; rule: string | null }[] = [
  { label: "None", freq: "none", rule: null },
  { label: "Daily", freq: "daily", rule: "FREQ=DAILY" },
  { label: "Weekly", freq: "weekly", rule: "FREQ=WEEKLY" },
  { label: "Monthly", freq: "monthly", rule: "FREQ=MONTHLY" },
  { label: "Yearly", freq: "yearly", rule: "FREQ=YEARLY" },
];

const weekdays = [
  { label: "S", value: "SU" },
  { label: "M", value: "MO" },
  { label: "T", value: "TU" },
  { label: "W", value: "WE" },
  { label: "T", value: "TH" },
  { label: "F", value: "FR" },
  { label: "S", value: "SA" },
];

function parseRule(rule: string | null): { freq: Frequency; interval: number; byDay: string[]; count: number | null } {
  if (!rule) return { freq: "none", interval: 1, byDay: [], count: null };

  const parts = rule.split(";");
  let freq: Frequency = "none";
  let interval = 1;
  let byDay: string[] = [];
  let count: number | null = null;

  for (const part of parts) {
    const [key, val] = part.split("=");
    switch (key) {
      case "FREQ":
        freq = (val?.toLowerCase() as Frequency) ?? "none";
        break;
      case "INTERVAL":
        interval = Number(val) || 1;
        break;
      case "BYDAY":
        byDay = val?.split(",") ?? [];
        break;
      case "COUNT":
        count = Number(val) || null;
        break;
    }
  }

  // Check if it matches a preset or is custom
  if (interval > 1 || byDay.length > 0 || count) {
    freq = "custom";
  }

  return { freq, interval, byDay, count };
}

function buildRule(freq: Frequency, interval: number, byDay: string[], count: number | null): string | null {
  if (freq === "none") return null;

  const actualFreq = freq === "custom" ? "WEEKLY" : freq.toUpperCase();
  const parts = [`FREQ=${actualFreq}`];

  if (interval > 1) parts.push(`INTERVAL=${interval}`);
  if (byDay.length > 0) parts.push(`BYDAY=${byDay.join(",")}`);
  if (count && count > 0) parts.push(`COUNT=${count}`);

  return parts.join(";");
}

export function RecurrencePicker({ value, onChange, className }: RecurrencePickerProps) {
  const parsed = parseRule(value);
  const [freq, setFreq] = useState<Frequency>(parsed.freq);
  const [interval, setInterval] = useState(parsed.interval);
  const [byDay, setByDay] = useState<string[]>(parsed.byDay);
  const [count, setCount] = useState<number | null>(parsed.count);
  const [showCustom, setShowCustom] = useState(parsed.freq === "custom");

  useEffect(() => {
    const p = parseRule(value);
    setFreq(p.freq);
    setInterval(p.interval);
    setByDay(p.byDay);
    setCount(p.count);
    setShowCustom(p.freq === "custom");
  }, [value]);

  const handlePresetSelect = (preset: typeof presets[number]) => {
    setFreq(preset.freq);
    setShowCustom(false);
    setInterval(1);
    setByDay([]);
    setCount(null);
    onChange(preset.rule);
  };

  const handleCustomToggle = () => {
    setShowCustom(true);
    setFreq("custom");
  };

  const updateCustom = (newInterval: number, newByDay: string[], newCount: number | null) => {
    setInterval(newInterval);
    setByDay(newByDay);
    setCount(newCount);
    onChange(buildRule("custom", newInterval, newByDay, newCount));
  };

  const toggleDay = (day: string) => {
    const newDays = byDay.includes(day) ? byDay.filter((d) => d !== day) : [...byDay, day];
    updateCustom(interval, newDays, count);
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Preset chips */}
      <div className="flex flex-wrap gap-1.5">
        {presets.map((preset) => (
          <button
            key={preset.freq}
            type="button"
            onClick={() => handlePresetSelect(preset)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors touch-manipulation",
              freq === preset.freq && !showCustom
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground hover:bg-accent"
            )}
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          onClick={handleCustomToggle}
          className={cn(
            "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors touch-manipulation",
            showCustom
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground hover:bg-accent"
          )}
        >
          Custom
        </button>
      </div>

      {/* Custom options */}
      {showCustom && (
        <div className="space-y-3 p-3 bg-muted/30 rounded-xl">
          {/* Interval */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Every</span>
            <input
              type="number"
              min={1}
              max={99}
              value={interval}
              onChange={(e) => updateCustom(Math.max(1, Number(e.target.value)), byDay, count)}
              className="w-16 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <span className="text-sm font-medium">week(s)</span>
          </div>

          {/* Day selection */}
          <div>
            <span className="text-xs font-medium text-muted-foreground mb-1.5 block">On these days</span>
            <div className="flex gap-1">
              {weekdays.map((day, i) => (
                <button
                  key={`${day.value}-${i}`}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-sm font-semibold transition-colors touch-manipulation",
                    byDay.includes(day.value)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground hover:bg-accent"
                  )}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          {/* End after N occurrences */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">End after</span>
            <input
              type="number"
              min={1}
              max={999}
              value={count ?? ""}
              placeholder="∞"
              onChange={(e) => {
                const v = e.target.value ? Number(e.target.value) : null;
                updateCustom(interval, byDay, v);
              }}
              className="w-16 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <span className="text-sm font-medium">times</span>
          </div>
        </div>
      )}
    </div>
  );
}
