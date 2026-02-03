import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Loader2, Calendar, Check } from "lucide-react";
import { api } from "../../services/api";
import { Button } from "../ui/Button";

interface HACalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubscribe: (entityId: string, name?: string) => Promise<void>;
}

export function HACalendarModal({
  isOpen,
  onClose,
  onSubscribe,
}: HACalendarModalProps) {
  const [isSubscribing, setIsSubscribing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: haCalendars = [], isLoading, refetch } = useQuery({
    queryKey: ["ha-calendars"],
    queryFn: () => api.getHomeAssistantCalendars(),
    enabled: isOpen,
  });

  const handleSubscribe = async (entityId: string, name: string) => {
    setError(null);
    setIsSubscribing(entityId);
    try {
      await onSubscribe(entityId, name);
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to subscribe");
    } finally {
      setIsSubscribing(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-card rounded-xl shadow-xl border border-border max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Home Assistant Calendars</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : haCalendars.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No calendars found in Home Assistant</p>
              <p className="text-sm mt-1">
                Make sure you have calendar integrations set up in Home Assistant
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {haCalendars.map((cal) => (
                <div
                  key={cal.entityId}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{cal.name}</p>
                      <p className="text-xs text-muted-foreground">{cal.entityId}</p>
                    </div>
                  </div>
                  {cal.isSubscribed ? (
                    <span className="flex items-center gap-1 text-sm text-green-600">
                      <Check className="h-4 w-4" />
                      Subscribed
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSubscribe(cal.entityId, cal.name)}
                      disabled={isSubscribing === cal.entityId}
                    >
                      {isSubscribing === cal.entityId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Subscribe"
                      )}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <Button variant="outline" className="w-full" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
