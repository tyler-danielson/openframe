import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

interface TouchTimePickerProps {
  value: string; // HH:mm format
  onChange: (value: string) => void;
  onSelect?: () => void; // Called after a quick-select time is chosen
  className?: string;
}

// Common quick-select times
const quickTimes = [
  { label: "9 AM", hour: 9, minute: 0 },
  { label: "12 PM", hour: 12, minute: 0 },
  { label: "3 PM", hour: 15, minute: 0 },
  { label: "6 PM", hour: 18, minute: 0 },
];

export function TouchTimePicker({ value, onChange, onSelect, className }: TouchTimePickerProps) {
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [isPM, setIsPM] = useState(false);

  // For hold-to-repeat functionality
  const intervalRef = useRef<number | null>(null);

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

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Update parent when values change
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

  const incrementHours = () => {
    const newHours = hours >= 12 ? 1 : hours + 1;
    setHours(newHours);
    updateTime(newHours, minutes, isPM);
  };

  const decrementHours = () => {
    const newHours = hours <= 1 ? 12 : hours - 1;
    setHours(newHours);
    updateTime(newHours, minutes, isPM);
  };

  const incrementMinutes = () => {
    const newMinutes = (minutes + 5) % 60;
    setMinutes(newMinutes);
    updateTime(hours, newMinutes, isPM);
  };

  const decrementMinutes = () => {
    const newMinutes = minutes < 5 ? 55 : minutes - 5;
    setMinutes(newMinutes);
    updateTime(hours, newMinutes, isPM);
  };

  const togglePeriod = () => {
    const newIsPM = !isPM;
    setIsPM(newIsPM);
    updateTime(hours, minutes, newIsPM);
  };

  // Quick select a specific time
  const selectTime = (hour24: number, minute: number) => {
    const newIsPM = hour24 >= 12;
    let hour12 = hour24;
    if (hour24 === 0) hour12 = 12;
    else if (hour24 > 12) hour12 = hour24 - 12;

    setHours(hour12);
    setMinutes(minute);
    setIsPM(newIsPM);
    updateTime(hour12, minute, newIsPM);
    onSelect?.();
  };

  // Start repeating action while held
  const startRepeat = useCallback((action: () => void) => {
    action(); // Execute immediately
    intervalRef.current = window.setInterval(action, 120); // Repeat faster (120ms)
  }, []);

  // Stop repeating
  const stopRepeat = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const SpinnerButton = ({
    onAction,
    direction,
    label
  }: {
    onAction: () => void;
    direction: "up" | "down";
    label: string;
  }) => (
    <button
      type="button"
      onMouseDown={() => startRepeat(onAction)}
      onMouseUp={stopRepeat}
      onMouseLeave={stopRepeat}
      onTouchStart={() => startRepeat(onAction)}
      onTouchEnd={stopRepeat}
      className="w-full h-10 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent active:bg-accent/80 rounded-lg transition-colors touch-manipulation select-none"
      aria-label={label}
    >
      {direction === "up" ? (
        <ChevronUp className="h-7 w-7" />
      ) : (
        <ChevronDown className="h-7 w-7" />
      )}
    </button>
  );

  return (
    <div className={cn("p-3 bg-muted/30 rounded-xl", className)}>
      {/* Quick select times */}
      <div className="flex gap-2 mb-3">
        {quickTimes.map((qt) => (
          <button
            key={qt.label}
            type="button"
            onClick={() => selectTime(qt.hour, qt.minute)}
            className="flex-1 py-2 px-2 text-sm font-medium rounded-lg bg-muted hover:bg-accent transition-colors touch-manipulation"
          >
            {qt.label}
          </button>
        ))}
      </div>

      {/* Spinner controls */}
      <div className="flex items-center justify-center gap-1">
        {/* Hours */}
        <div className="flex flex-col items-center">
          <SpinnerButton onAction={incrementHours} direction="up" label="Increase hours" />
          <div className="w-14 h-12 flex items-center justify-center text-2xl font-bold">
            {hours}
          </div>
          <SpinnerButton onAction={decrementHours} direction="down" label="Decrease hours" />
        </div>

        {/* Separator */}
        <div className="text-2xl font-bold text-muted-foreground">:</div>

        {/* Minutes */}
        <div className="flex flex-col items-center">
          <SpinnerButton onAction={incrementMinutes} direction="up" label="Increase minutes" />
          <div className="w-14 h-12 flex items-center justify-center text-2xl font-bold">
            {minutes.toString().padStart(2, "0")}
          </div>
          <SpinnerButton onAction={decrementMinutes} direction="down" label="Decrease minutes" />
        </div>

        {/* AM/PM */}
        <div className="flex flex-col gap-1 ml-2">
          <button
            type="button"
            onClick={() => {
              if (isPM) togglePeriod();
            }}
            className={cn(
              "px-3 py-1.5 rounded-lg text-base font-semibold transition-colors touch-manipulation",
              !isPM
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent"
            )}
          >
            AM
          </button>
          <button
            type="button"
            onClick={() => {
              if (!isPM) togglePeriod();
            }}
            className={cn(
              "px-3 py-1.5 rounded-lg text-base font-semibold transition-colors touch-manipulation",
              isPM
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent"
            )}
          >
            PM
          </button>
        </div>
      </div>
    </div>
  );
}
