import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, PenTool, Send, Folder, Clock, Calendar } from "lucide-react";
import { api } from "../../services/api";
import { Button } from "../ui/Button";
import type { ProfileRemarkableSettings as RemarkableSettings } from "@openframe/shared";

interface ProfileRemarkableSettingsProps {
  profileId: string;
}

const SCHEDULE_TYPES = [
  { value: "daily", label: "Daily", description: "Push every day" },
  { value: "weekly", label: "Weekly", description: "Push once a week" },
  { value: "monthly", label: "Monthly", description: "Push once a month" },
  { value: "manual", label: "Manual", description: "Push on demand only" },
];

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export function ProfileRemarkableSettings({ profileId }: ProfileRemarkableSettingsProps) {
  const queryClient = useQueryClient();
  const [localSettings, setLocalSettings] = useState<Partial<RemarkableSettings>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ["profile-remarkable", profileId],
    queryFn: () => api.getProfileRemarkable(profileId),
    enabled: !!profileId,
  });

  // Update when settings load
  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
      setHasChanges(false);
    }
  }, [settings]);

  // Update mutation
  const updateSettings = useMutation({
    mutationFn: (updates: Partial<RemarkableSettings>) =>
      api.updateProfileRemarkable(profileId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-remarkable", profileId] });
      setHasChanges(false);
    },
  });

  // Push mutation
  const pushPlanner = useMutation({
    mutationFn: () => api.pushProfilePlanner(profileId),
  });

  const handleChange = (key: keyof RemarkableSettings, value: unknown) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateSettings.mutate(localSettings);
  };

  const handlePush = () => {
    pushPlanner.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PenTool className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-medium">reMarkable Delivery</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handlePush}
          disabled={pushPlanner.isPending}
        >
          {pushPlanner.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Pushing...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Push Now
            </>
          )}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Configure automatic delivery of this profile's planner to your reMarkable device.
      </p>

      {/* Enable toggle */}
      <label className="flex items-center gap-3 p-3 rounded-md border border-border">
        <input
          type="checkbox"
          checked={localSettings.enabled ?? true}
          onChange={(e) => handleChange("enabled", e.target.checked)}
          className="rounded border-border"
        />
        <div className="flex-1">
          <span className="font-medium">Enable automatic delivery</span>
          <p className="text-sm text-muted-foreground">
            Automatically push the planner according to the schedule below
          </p>
        </div>
      </label>

      {/* Folder path */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <Folder className="h-4 w-4" />
          Folder Path
        </label>
        <input
          type="text"
          value={localSettings.folderPath ?? "/Calendar"}
          onChange={(e) => handleChange("folderPath", e.target.value)}
          placeholder="/Calendar/ProfileName"
          className="w-full px-3 py-2 border border-border rounded-md bg-background"
        />
        <p className="text-xs text-muted-foreground">
          Where to save the planner on your reMarkable device
        </p>
      </div>

      {/* Schedule type */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <Calendar className="h-4 w-4" />
          Schedule
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SCHEDULE_TYPES.map((type) => (
            <button
              key={type.value}
              onClick={() => handleChange("scheduleType", type.value)}
              className={`p-3 rounded-md border text-left transition-colors ${
                localSettings.scheduleType === type.value
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <span className="font-medium text-sm">{type.label}</span>
              <p className="text-xs text-muted-foreground">{type.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Push time */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <Clock className="h-4 w-4" />
          Push Time
        </label>
        <input
          type="time"
          value={localSettings.pushTime ?? "06:00"}
          onChange={(e) => handleChange("pushTime", e.target.value)}
          className="px-3 py-2 border border-border rounded-md bg-background"
        />
        <p className="text-xs text-muted-foreground">
          Time of day to push the planner (in your local timezone)
        </p>
      </div>

      {/* Day selector for weekly */}
      {localSettings.scheduleType === "weekly" && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Day of Week</label>
          <select
            value={localSettings.pushDay ?? 0}
            onChange={(e) => handleChange("pushDay", parseInt(e.target.value))}
            className="px-3 py-2 border border-border rounded-md bg-background"
          >
            {DAYS_OF_WEEK.map((day) => (
              <option key={day.value} value={day.value}>
                {day.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Day selector for monthly */}
      {localSettings.scheduleType === "monthly" && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Day of Month</label>
          <select
            value={localSettings.pushDay ?? 1}
            onChange={(e) => handleChange("pushDay", parseInt(e.target.value))}
            className="px-3 py-2 border border-border rounded-md bg-background"
          >
            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Timezone */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Timezone</label>
        <select
          value={localSettings.timezone ?? "America/New_York"}
          onChange={(e) => handleChange("timezone", e.target.value)}
          className="px-3 py-2 border border-border rounded-md bg-background"
        >
          <option value="America/New_York">Eastern Time</option>
          <option value="America/Chicago">Central Time</option>
          <option value="America/Denver">Mountain Time</option>
          <option value="America/Los_Angeles">Pacific Time</option>
          <option value="America/Anchorage">Alaska Time</option>
          <option value="Pacific/Honolulu">Hawaii Time</option>
          <option value="Europe/London">London</option>
          <option value="Europe/Paris">Paris</option>
          <option value="Europe/Berlin">Berlin</option>
          <option value="Asia/Tokyo">Tokyo</option>
          <option value="Asia/Shanghai">Shanghai</option>
          <option value="Australia/Sydney">Sydney</option>
        </select>
      </div>

      {/* Save button */}
      {hasChanges && (
        <div className="flex justify-end pt-4 border-t border-border">
          <Button
            onClick={handleSave}
            disabled={updateSettings.isPending}
          >
            {updateSettings.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      )}

      {/* Last push info */}
      {settings?.lastPushAt && (
        <p className="text-xs text-muted-foreground">
          Last pushed: {new Date(settings.lastPushAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
