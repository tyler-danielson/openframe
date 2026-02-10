import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Calendar } from "lucide-react";
import { api } from "../../services/api";
import { Button } from "../ui/Button";

interface ProfileCalendarSettingsProps {
  profileId: string;
}

export function ProfileCalendarSettings({ profileId }: ProfileCalendarSettingsProps) {
  const queryClient = useQueryClient();

  // Fetch calendar visibility settings
  const { data: calendarSettings = [], isLoading } = useQuery({
    queryKey: ["profile-calendars", profileId],
    queryFn: () => api.getProfileCalendars(profileId),
    enabled: !!profileId,
  });

  // Update visibility mutation
  const updateVisibility = useMutation({
    mutationFn: (updates: Array<{ calendarId: string; isVisible: boolean }>) =>
      api.updateProfileCalendars(profileId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-calendars", profileId] });
    },
  });

  const handleToggle = (calendarId: string, currentlyVisible: boolean) => {
    updateVisibility.mutate([{ calendarId, isVisible: !currentlyVisible }]);
  };

  const handleSelectAll = () => {
    const updates = calendarSettings.map((s) => ({
      calendarId: s.calendar.id,
      isVisible: true,
    }));
    updateVisibility.mutate(updates);
  };

  const handleSelectNone = () => {
    const updates = calendarSettings.map((s) => ({
      calendarId: s.calendar.id,
      isVisible: false,
    }));
    updateVisibility.mutate(updates);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-medium">Calendars</h3>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={handleSelectAll}>
            Select All
          </Button>
          <Button variant="ghost" size="sm" onClick={handleSelectNone}>
            Select None
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Choose which calendars to include in this profile's planner.
      </p>

      {calendarSettings.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-4">
          No calendars available. Connect a calendar provider in Settings.
        </p>
      ) : (
        <div className="space-y-2">
          {calendarSettings.map(({ calendar, isVisible }) => (
            <label
              key={calendar.id}
              className="flex items-center gap-3 p-3 rounded-md border border-border hover:bg-muted/50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={isVisible}
                onChange={() => handleToggle(calendar.id, isVisible)}
                className="rounded border-border"
              />
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: calendar.color }}
              />
              <div className="flex-1">
                <span className="font-medium">{calendar.name}</span>
                {calendar.description && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {calendar.description}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground capitalize">
                {calendar.provider}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
