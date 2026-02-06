import { useState } from "react";
import { format } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { HandwritingCanvas } from "../ui/HandwritingCanvas";
import { parseEventText } from "../../utils/parseEventText";
import { api } from "../../services/api";
import type { Calendar } from "@openframe/shared";

interface HandwritingOverlayProps {
  targetDate: Date;
  calendars: Calendar[];
  onClose: () => void;
  onSuccess?: () => void;
}

export function HandwritingOverlay({
  targetDate,
  calendars,
  onClose,
  onSuccess,
}: HandwritingOverlayProps) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"drawing" | "creating" | "success" | "error">("drawing");
  const [recognizedText, setRecognizedText] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Find primary writable calendar, or fall back to any writable visible calendar
  // Filter out read-only calendars since we can't create events on them
  const writableCalendars = calendars.filter((c) => !c.isReadOnly);
  const primaryCalendar = writableCalendars.find((c) => c.isPrimary && c.isVisible)
    || writableCalendars.find((c) => c.isPrimary)
    || writableCalendars.find((c) => c.isVisible)
    || writableCalendars[0];

  const createEventMutation = useMutation({
    mutationFn: async (data: {
      calendarId: string;
      title: string;
      startTime: Date;
      endTime: Date;
      isAllDay?: boolean;
    }) => {
      return api.createEvent(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      setStatus("success");
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1500);
    },
    onError: (error: Error) => {
      setErrorMessage(error.message || "Failed to create event");
      setStatus("error");
    },
  });

  const handleRecognized = (text: string) => {
    setRecognizedText(text);
    setStatus("creating");

    // Parse the recognized text
    const parsed = parseEventText(text, targetDate);

    if (!primaryCalendar) {
      setErrorMessage("No calendar available to create event");
      setStatus("error");
      return;
    }

    // Create the event
    if (parsed.startTime && parsed.endTime) {
      // Timed event
      createEventMutation.mutate({
        calendarId: primaryCalendar.id,
        title: parsed.title,
        startTime: parsed.startTime,
        endTime: parsed.endTime,
        isAllDay: false,
      });
    } else {
      // All-day event (no time specified)
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      createEventMutation.mutate({
        calendarId: primaryCalendar.id,
        title: parsed.title,
        startTime: startOfDay,
        endTime: endOfDay,
        isAllDay: true,
      });
    }
  };

  const handleRetry = () => {
    setStatus("drawing");
    setRecognizedText("");
    setErrorMessage("");
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">
            Write Event for {format(targetDate, "EEEE, MMMM d")}
          </h2>
          {primaryCalendar && (
            <p className="text-sm text-muted-foreground mt-1">
              Will be added to: {primaryCalendar.name}
            </p>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {status === "drawing" && (
            <HandwritingCanvas
              onRecognized={handleRecognized}
              onCancel={onClose}
              placeholder="Write your event here... (e.g., 'dinner at 7pm')"
              className="h-64"
            />
          )}

          {status === "creating" && (
            <div className="h-64 flex flex-col items-center justify-center">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mb-4" />
              <p className="text-muted-foreground">Creating event...</p>
              {recognizedText && (
                <p className="mt-2 text-sm">
                  Recognized: <span className="font-medium">"{recognizedText}"</span>
                </p>
              )}
            </div>
          )}

          {status === "success" && (
            <div className="h-64 flex flex-col items-center justify-center">
              <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                <svg
                  className="h-8 w-8 text-green-600 dark:text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <p className="font-medium text-green-600 dark:text-green-400">Event created!</p>
              {recognizedText && (
                <p className="mt-2 text-sm text-muted-foreground">
                  "{recognizedText}"
                </p>
              )}
            </div>
          )}

          {status === "error" && (
            <div className="h-64 flex flex-col items-center justify-center">
              <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                <svg
                  className="h-8 w-8 text-red-600 dark:text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <p className="font-medium text-red-600 dark:text-red-400">
                {errorMessage || "Something went wrong"}
              </p>
              {recognizedText && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Recognized: "{recognizedText}"
                </p>
              )}
              <div className="mt-4 flex gap-3">
                <button
                  onClick={handleRetry}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
