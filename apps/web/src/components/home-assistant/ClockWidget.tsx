import { useState, useEffect } from "react";
import { format } from "date-fns";

interface ClockWidgetProps {
  showDate?: boolean;
  showSeconds?: boolean;
  className?: string;
}

export function ClockWidget({
  showDate = true,
  showSeconds = false,
  className,
}: ClockWidgetProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const timeFormat = showSeconds ? "h:mm:ss a" : "h:mm a";

  return (
    <div className={className}>
      <p className="text-5xl font-light tracking-tight">
        {format(time, timeFormat)}
      </p>
      {showDate && (
        <p className="mt-1 text-lg text-muted-foreground">
          {format(time, "EEEE, MMMM d, yyyy")}
        </p>
      )}
    </div>
  );
}
