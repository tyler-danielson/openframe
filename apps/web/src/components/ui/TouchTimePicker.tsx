import { useState, useEffect } from "react";
import { cn } from "../../lib/utils";

interface TouchTimePickerProps {
  value: string; // HH:mm format
  onChange: (value: string) => void;
  onSelect?: () => void;
  className?: string;
}

// 12-chip grid: every 1 hour from 12–11
const hourChips = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

// Minute chips: 00, 05, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55
const minuteChips = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export function TouchTimePicker({ value, onChange, onSelect, className }: TouchTimePickerProps) {
  const [hours, setHours] = useState(12);
  const [minutes, setMinutes] = useState(0);
  const [isPM, setIsPM] = useState(false);
  const [showMinutes, setShowMinutes] = useState(false);

  // Parse initial value
  useEffect(() => {
    if (value) {
      const [h, m] = value.split(":").map(Number);
      const hour24 = h ?? 0;
      const min = m ?? 0;

      setMinutes(min);
      if (hour24 === 0) {
        setHours(12);
        setIsPM(false);
      } else if (hour24 === 12) {
        setHours(12);
        setIsPM(true);
      } else if (hour24 > 12) {
        setHours(hour24 - 12);
        setIsPM(true);
      } else {
        setHours(hour24);
        setIsPM(false);
      }
    }
  }, []);

  const updateTime = (newHours: number, newMinutes: number, newIsPM: boolean) => {
    let hour24 = newHours;
    if (newIsPM && newHours !== 12) {
      hour24 = newHours + 12;
    } else if (!newIsPM && newHours === 12) {
      hour24 = 0;
    }
    const timeString = `${hour24.toString().padStart(2, "0")}:${newMinutes.toString().padStart(2, "0")}`;
    onChange(timeString);
  };

  const selectHour = (hour12: number) => {
    setHours(hour12);
    updateTime(hour12, minutes, isPM);
    // Auto-advance to minute selection
    setShowMinutes(true);
  };

  const selectMinute = (minute: number) => {
    setMinutes(minute);
    updateTime(hours, minute, isPM);
    onSelect?.();
  };

  const togglePeriod = (pm: boolean) => {
    setIsPM(pm);
    updateTime(hours, minutes, pm);
  };

  // Format the currently selected time for the header
  const displayTime = () => {
    const period = isPM ? "PM" : "AM";
    return `${hours}:${minutes.toString().padStart(2, "0")} ${period}`;
  };

  return (
    <div className={cn("p-3 bg-muted/30 rounded-xl", className)}>
      {/* Header: selected time + AM/PM segmented control */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setShowMinutes(false)}
          className={cn(
            "text-lg font-bold transition-colors",
            !showMinutes ? "text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {displayTime()}
        </button>

        {/* AM/PM segmented control */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => togglePeriod(false)}
            className={cn(
              "px-4 py-1.5 text-sm font-semibold transition-colors touch-manipulation",
              !isPM
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-accent"
            )}
          >
            AM
          </button>
          <button
            type="button"
            onClick={() => togglePeriod(true)}
            className={cn(
              "px-4 py-1.5 text-sm font-semibold transition-colors touch-manipulation",
              isPM
                ? "bg-primary text-primary-foreground"
                : "bg-background text-muted-foreground hover:bg-accent"
            )}
          >
            PM
          </button>
        </div>
      </div>

      {/* Tab indicator */}
      <div className="flex gap-1 mb-2">
        <button
          type="button"
          onClick={() => setShowMinutes(false)}
          className={cn(
            "flex-1 py-1 text-xs font-medium rounded transition-colors touch-manipulation",
            !showMinutes ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Hour
        </button>
        <button
          type="button"
          onClick={() => setShowMinutes(true)}
          className={cn(
            "flex-1 py-1 text-xs font-medium rounded transition-colors touch-manipulation",
            showMinutes ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Minute
        </button>
      </div>

      {/* Hour grid: 4 columns x 3 rows */}
      {!showMinutes && (
        <div className="grid grid-cols-4 gap-1.5">
          {hourChips.map((hour) => (
            <button
              key={hour}
              type="button"
              onClick={() => selectHour(hour)}
              className={cn(
                "py-2.5 rounded-lg text-sm font-semibold transition-colors touch-manipulation",
                hours === hour
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-accent text-foreground"
              )}
            >
              {hour}
            </button>
          ))}
        </div>
      )}

      {/* Minute grid: 4 columns x 3 rows */}
      {showMinutes && (
        <div className="grid grid-cols-4 gap-1.5">
          {minuteChips.map((minute) => (
            <button
              key={minute}
              type="button"
              onClick={() => selectMinute(minute)}
              className={cn(
                "py-2.5 rounded-lg text-sm font-semibold transition-colors touch-manipulation",
                minutes === minute
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-accent text-foreground"
              )}
            >
              :{minute.toString().padStart(2, "0")}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
