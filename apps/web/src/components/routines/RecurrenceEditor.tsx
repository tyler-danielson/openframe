import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { format, getDay, getDate } from "date-fns";
import { X } from "lucide-react";
import { Button } from "../ui/Button";
import type { RecurrenceRule } from "@openframe/shared";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ORDINALS = ["first", "second", "third", "fourth", "last"];
const FREQ_LABELS: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  custom: "Custom",
};

function describeRecurrence(rule: RecurrenceRule): string {
  const { frequency, interval } = rule;

  let base = "";
  if (interval === 1) {
    base = frequency === "daily" ? "Every day"
      : frequency === "weekly" ? "Every week"
      : frequency === "monthly" ? "Every month"
      : "Every year";
  } else {
    const unitLabel = frequency === "daily" ? "days"
      : frequency === "weekly" ? "weeks"
      : frequency === "monthly" ? "months"
      : "years";
    base = `Every ${interval} ${unitLabel}`;
  }

  if (frequency === "weekly" && rule.daysOfWeek?.length) {
    const sorted = [...rule.daysOfWeek].sort((a, b) => a - b);
    const dayNames = sorted.map(d => DAY_LABELS[d]);
    base += ` on ${dayNames.join(", ")}`;
  }

  if (frequency === "monthly") {
    if (rule.monthlyMode === "dayOfMonth" && rule.dayOfMonth) {
      base += ` on day ${rule.dayOfMonth}`;
    } else if (rule.monthlyMode === "dayOfWeek" && rule.weekOfMonth != null && rule.dayOfWeekForMonth != null) {
      const ordinal = ORDINALS[rule.weekOfMonth - 1] ?? `${rule.weekOfMonth}th`;
      const dayName = DAY_NAMES[rule.dayOfWeekForMonth];
      base += ` on the ${ordinal} ${dayName}`;
    }
  }

  if (rule.endType === "after" && rule.endAfterCount) {
    base += `, ${rule.endAfterCount} times`;
  } else if (rule.endType === "onDate" && rule.endDate) {
    base += `, until ${format(new Date(rule.endDate), "MMM d, yyyy")}`;
  }

  return base;
}

interface RecurrenceEditorProps {
  value: RecurrenceRule;
  onChange: (rule: RecurrenceRule) => void;
  referenceDate?: Date;
}

type PresetKey = "daily" | "weekly" | "monthly" | "custom";

export function RecurrenceEditor({ value, onChange, referenceDate }: RecurrenceEditorProps) {
  const ref = referenceDate ?? new Date();
  const [showCustom, setShowCustom] = useState(false);
  const customBtnRef = useRef<HTMLButtonElement>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);

  const updatePopoverPos = useCallback(() => {
    if (!customBtnRef.current) return;
    const rect = customBtnRef.current.getBoundingClientRect();
    setPopoverPos({ top: rect.top, left: rect.right + 12 });
  }, []);

  useEffect(() => {
    if (showCustom) {
      updatePopoverPos();
    }
  }, [showCustom, updatePopoverPos]);

  // Determine which preset is active
  const activePreset = useMemo((): PresetKey => {
    if (value.frequency === "daily" && value.interval === 1 && value.endType === "never") return "daily";
    if (value.frequency === "weekly" && value.interval === 1 && value.endType === "never") return "weekly";
    if (value.frequency === "monthly" && value.interval === 1 && value.endType === "never") return "monthly";
    return "custom";
  }, [value]);

  const handlePreset = (preset: PresetKey) => {
    if (preset === "daily") {
      onChange({ frequency: "daily", interval: 1, endType: "never" });
      setShowCustom(false);
    } else if (preset === "weekly") {
      onChange({
        frequency: "weekly",
        interval: 1,
        daysOfWeek: value.daysOfWeek?.length ? value.daysOfWeek : [getDay(ref)],
        endType: "never",
      });
      setShowCustom(false);
    } else if (preset === "monthly") {
      onChange({
        frequency: "monthly",
        interval: 1,
        monthlyMode: "dayOfMonth",
        dayOfMonth: getDate(ref),
        endType: "never",
      });
      setShowCustom(false);
    } else {
      setShowCustom(true);
    }
  };

  const toggleDay = (day: number) => {
    const current = value.daysOfWeek ?? [];
    const next = current.includes(day) ? current.filter(d => d !== day) : [...current, day];
    onChange({ ...value, daysOfWeek: next });
  };

  return (
    <div className="space-y-3">
      {/* Preset chips */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Frequency</label>
        <div className="flex gap-2">
          {(["daily", "weekly", "monthly", "custom"] as PresetKey[]).map(p => (
            <button
              key={p}
              ref={p === "custom" ? customBtnRef : undefined}
              type="button"
              onClick={() => handlePreset(p)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                activePreset === p
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {FREQ_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Weekly: day picker + optional interval */}
      {value.frequency === "weekly" && !showCustom && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Days</label>
          <div className="flex gap-1.5">
            {DAY_LABELS.map((label, i) => (
              <button
                key={i}
                type="button"
                onClick={() => toggleDay(i)}
                className={`flex h-9 w-9 items-center justify-center rounded-md text-xs font-medium transition-colors ${
                  (value.daysOfWeek ?? []).includes(i)
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Monthly: mode picker */}
      {value.frequency === "monthly" && !showCustom && (
        <MonthlyModeSelector value={value} onChange={onChange} referenceDate={ref} />
      )}

      {/* Custom dialog — pops out to the right */}
      {showCustom && popoverPos && (
        <CustomRecurrenceDialog
          value={value}
          onChange={onChange}
          referenceDate={ref}
          onClose={() => setShowCustom(false)}
          position={popoverPos}
        />
      )}

      {/* Summary */}
      <div className="text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
        {describeRecurrence(value)}
      </div>
    </div>
  );
}

function MonthlyModeSelector({
  value,
  onChange,
  referenceDate,
}: {
  value: RecurrenceRule;
  onChange: (rule: RecurrenceRule) => void;
  referenceDate: Date;
}) {
  const dayOfMonth = getDate(referenceDate);
  const dayOfWeek = getDay(referenceDate);
  const weekNum = Math.ceil(dayOfMonth / 7);
  const dayName = DAY_NAMES[dayOfWeek];
  const ordinalLabel = ORDINALS[weekNum - 1] ?? `${weekNum}th`;

  return (
    <div className="space-y-2">
      <label
        className={`flex items-center gap-3 rounded-md border px-3 py-2.5 cursor-pointer transition-colors ${
          value.monthlyMode === "dayOfMonth" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
        }`}
        onClick={() =>
          onChange({
            ...value,
            monthlyMode: "dayOfMonth",
            dayOfMonth: value.dayOfMonth ?? dayOfMonth,
            weekOfMonth: undefined,
            dayOfWeekForMonth: undefined,
          })
        }
      >
        <input
          type="radio"
          checked={value.monthlyMode === "dayOfMonth"}
          readOnly
          className="accent-primary"
        />
        <span className="text-sm">
          On day{" "}
          <input
            type="number"
            min={1}
            max={31}
            value={value.dayOfMonth ?? dayOfMonth}
            onChange={(e) =>
              onChange({ ...value, monthlyMode: "dayOfMonth", dayOfMonth: parseInt(e.target.value) || dayOfMonth })
            }
            onClick={(e) => e.stopPropagation()}
            className="w-12 text-center rounded border border-border bg-background px-1 py-0.5 text-sm"
          />
        </span>
      </label>

      <label
        className={`flex items-center gap-3 rounded-md border px-3 py-2.5 cursor-pointer transition-colors ${
          value.monthlyMode === "dayOfWeek" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
        }`}
        onClick={() =>
          onChange({
            ...value,
            monthlyMode: "dayOfWeek",
            weekOfMonth: value.weekOfMonth ?? weekNum,
            dayOfWeekForMonth: value.dayOfWeekForMonth ?? dayOfWeek,
            dayOfMonth: undefined,
          })
        }
      >
        <input
          type="radio"
          checked={value.monthlyMode === "dayOfWeek"}
          readOnly
          className="accent-primary"
        />
        <span className="text-sm">
          On the{" "}
          <select
            value={value.weekOfMonth ?? weekNum}
            onChange={(e) => {
              e.stopPropagation();
              onChange({ ...value, monthlyMode: "dayOfWeek", weekOfMonth: parseInt(e.target.value) });
            }}
            onClick={(e) => e.stopPropagation()}
            className="rounded border border-border bg-background px-1 py-0.5 text-sm"
          >
            {ORDINALS.map((label, i) => (
              <option key={i} value={i + 1}>{label}</option>
            ))}
          </select>{" "}
          <select
            value={value.dayOfWeekForMonth ?? dayOfWeek}
            onChange={(e) => {
              e.stopPropagation();
              onChange({ ...value, monthlyMode: "dayOfWeek", dayOfWeekForMonth: parseInt(e.target.value) });
            }}
            onClick={(e) => e.stopPropagation()}
            className="rounded border border-border bg-background px-1 py-0.5 text-sm"
          >
            {DAY_NAMES.map((name, i) => (
              <option key={i} value={i}>{name}</option>
            ))}
          </select>
        </span>
      </label>
    </div>
  );
}

function CustomRecurrenceDialog({
  value,
  onChange,
  referenceDate,
  onClose,
  position,
}: {
  value: RecurrenceRule;
  onChange: (rule: RecurrenceRule) => void;
  referenceDate: Date;
  onClose: () => void;
  position: { top: number; left: number };
}) {
  const [draft, setDraft] = useState<RecurrenceRule>({ ...value });

  const updateDraft = (partial: Partial<RecurrenceRule>) => {
    setDraft(prev => ({ ...prev, ...partial }));
  };

  const toggleDay = (day: number) => {
    const current = draft.daysOfWeek ?? [];
    const next = current.includes(day) ? current.filter(d => d !== day) : [...current, day];
    setDraft(prev => ({ ...prev, daysOfWeek: next }));
  };

  const handleDone = () => {
    onChange(draft);
    onClose();
  };

  const unitOptions = [
    { value: "daily", label: "days" },
    { value: "weekly", label: "weeks" },
    { value: "monthly", label: "months" },
    { value: "yearly", label: "years" },
  ] as const;

  return (
    <div
      className="fixed z-[60] w-80 rounded-lg border border-border bg-card p-4 space-y-4 shadow-xl"
      style={{ top: position.top, left: position.left }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Custom recurrence</h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-accent">
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Repeat every X [unit] */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-foreground">Repeat every</span>
        <input
          type="number"
          min={1}
          max={99}
          value={draft.interval}
          onChange={(e) => updateDraft({ interval: Math.max(1, parseInt(e.target.value) || 1) })}
          className="w-14 text-center rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        />
        <select
          value={draft.frequency}
          onChange={(e) => {
            const freq = e.target.value as RecurrenceRule["frequency"];
            updateDraft({
              frequency: freq,
              // Reset frequency-specific fields when switching
              daysOfWeek: freq === "weekly" ? (draft.daysOfWeek?.length ? draft.daysOfWeek : [getDay(referenceDate)]) : undefined,
              monthlyMode: freq === "monthly" ? "dayOfMonth" : undefined,
              dayOfMonth: freq === "monthly" ? getDate(referenceDate) : undefined,
            });
          }}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        >
          {unitOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Weekly: day picker */}
      {draft.frequency === "weekly" && (
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Repeat on</label>
          <div className="flex gap-1.5">
            {DAY_LABELS.map((label, i) => (
              <button
                key={i}
                type="button"
                onClick={() => toggleDay(i)}
                className={`flex h-9 w-9 items-center justify-center rounded-md text-xs font-medium transition-colors ${
                  (draft.daysOfWeek ?? []).includes(i)
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Monthly: mode picker */}
      {draft.frequency === "monthly" && (
        <MonthlyModeSelector value={draft} onChange={setDraft} referenceDate={referenceDate} />
      )}

      {/* End condition */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">Ends</label>
        <div className="space-y-2">
          <label
            className={`flex items-center gap-3 rounded-md border px-3 py-2.5 cursor-pointer transition-colors ${
              draft.endType === "never" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
            }`}
            onClick={() => updateDraft({ endType: "never", endAfterCount: undefined, endDate: undefined })}
          >
            <input type="radio" checked={draft.endType === "never"} readOnly className="accent-primary" />
            <span className="text-sm">Never</span>
          </label>

          <label
            className={`flex items-center gap-3 rounded-md border px-3 py-2.5 cursor-pointer transition-colors ${
              draft.endType === "onDate" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
            }`}
            onClick={() => updateDraft({ endType: "onDate", endDate: draft.endDate || format(new Date(), "yyyy-MM-dd") })}
          >
            <input type="radio" checked={draft.endType === "onDate"} readOnly className="accent-primary" />
            <span className="text-sm flex items-center gap-2">
              On{" "}
              <input
                type="date"
                value={draft.endDate || ""}
                onChange={(e) => updateDraft({ endType: "onDate", endDate: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                className="rounded border border-border bg-background px-2 py-0.5 text-sm"
              />
            </span>
          </label>

          <label
            className={`flex items-center gap-3 rounded-md border px-3 py-2.5 cursor-pointer transition-colors ${
              draft.endType === "after" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
            }`}
            onClick={() => updateDraft({ endType: "after", endAfterCount: draft.endAfterCount || 10 })}
          >
            <input type="radio" checked={draft.endType === "after"} readOnly className="accent-primary" />
            <span className="text-sm flex items-center gap-2">
              After{" "}
              <input
                type="number"
                min={1}
                max={999}
                value={draft.endAfterCount ?? 10}
                onChange={(e) => updateDraft({ endType: "after", endAfterCount: parseInt(e.target.value) || 10 })}
                onClick={(e) => e.stopPropagation()}
                className="w-16 text-center rounded border border-border bg-background px-1 py-0.5 text-sm"
              />{" "}
              occurrences
            </span>
          </label>
        </div>
      </div>

      {/* Summary */}
      <div className="text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
        {describeRecurrence(draft)}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={handleDone}>
          Done
        </Button>
      </div>
    </div>
  );
}
