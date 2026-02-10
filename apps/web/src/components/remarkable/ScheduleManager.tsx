import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Clock,
  Plus,
  Trash2,
  Edit,
  Loader2,
  Calendar,
  CheckSquare,
  Layout,
  FileText,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { api, type RemarkableSchedule } from "../../services/api";
import { Button } from "../ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/Card";

interface ScheduleManagerProps {
  onClose: () => void;
}

const SCHEDULE_TYPES = [
  { value: "daily", label: "Daily", description: "Every day" },
  { value: "weekly", label: "Weekly", description: "Once per week" },
  { value: "monthly", label: "Monthly", description: "Once per month" },
  { value: "manual", label: "Manual", description: "Push manually only" },
] as const;

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export function ScheduleManager({ onClose }: ScheduleManagerProps) {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<RemarkableSchedule | null>(null);

  // Fetch schedules
  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ["remarkable", "schedules"],
    queryFn: () => api.getRemarkableSchedules(),
  });

  // Fetch templates for selection
  const { data: templates = [] } = useQuery({
    queryKey: ["remarkable", "templates"],
    queryFn: () => api.getRemarkableTemplates(),
  });

  // Toggle schedule
  const toggleSchedule = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.updateRemarkableSchedule(id, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["remarkable", "schedules"] });
    },
  });

  // Delete schedule
  const deleteSchedule = useMutation({
    mutationFn: (id: string) => api.deleteRemarkableSchedule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["remarkable", "schedules"] });
    },
  });

  const getTemplateIcon = (type: string | null) => {
    switch (type) {
      case "weekly_planner":
        return Calendar;
      case "habit_tracker":
        return CheckSquare;
      case "custom_agenda":
        return Layout;
      case "user_designed":
        return FileText;
      default:
        return Calendar;
    }
  };

  const formatScheduleTime = (schedule: RemarkableSchedule) => {
    const time = schedule.pushTime || "06:00";
    const parts = time.split(":").map(Number);
    const hours = parts[0] ?? 6;
    const minutes = parts[1] ?? 0;
    const ampm = hours >= 12 ? "PM" : "AM";
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutes.toString().padStart(2, "0")} ${ampm}`;
  };

  const formatScheduleDescription = (schedule: RemarkableSchedule) => {
    switch (schedule.scheduleType) {
      case "daily":
        return `Every day at ${formatScheduleTime(schedule)}`;
      case "weekly":
        const dayName = DAYS_OF_WEEK.find((d) => d.value === schedule.pushDay)?.label || "Monday";
        return `Every ${dayName} at ${formatScheduleTime(schedule)}`;
      case "monthly":
        const day = schedule.pushDay || 1;
        const suffix = day === 1 ? "st" : day === 2 ? "nd" : day === 3 ? "rd" : "th";
        return `${day}${suffix} of every month at ${formatScheduleTime(schedule)}`;
      case "manual":
        return "Manual push only";
      default:
        return "";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <div>
            <h2 className="text-lg font-semibold">Schedule Manager</h2>
            <p className="text-sm text-muted-foreground">
              Automate when templates are pushed to your device
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              New Schedule
            </Button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-muted rounded-lg transition-colors"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : schedules.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-3" />
              <p className="text-muted-foreground">No schedules configured</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create a schedule to automatically push templates
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Create Schedule
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {schedules.map((schedule) => {
                const Icon = getTemplateIcon(schedule.templateType ?? null);
                return (
                  <Card key={schedule.id} className={!schedule.enabled ? "opacity-60" : ""}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-muted rounded-lg">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {schedule.templateName || "Default Agenda"}
                            </span>
                            <span className="text-xs px-2 py-0.5 bg-muted rounded capitalize">
                              {schedule.scheduleType}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {formatScheduleDescription(schedule)}
                          </p>
                          {schedule.lastPushAt && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Last push: {new Date(schedule.lastPushAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              toggleSchedule.mutate({
                                id: schedule.id,
                                enabled: !schedule.enabled,
                              })
                            }
                            className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                            title={schedule.enabled ? "Disable" : "Enable"}
                          >
                            {schedule.enabled ? (
                              <ToggleRight className="h-5 w-5 text-primary" />
                            ) : (
                              <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                            )}
                          </button>
                          <button
                            onClick={() => setEditingSchedule(schedule)}
                            className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deleteSchedule.mutate(schedule.id)}
                            className="p-1.5 hover:bg-muted rounded-lg transition-colors text-destructive"
                            title="Delete"
                            disabled={deleteSchedule.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingSchedule) && (
        <ScheduleConfigModal
          schedule={editingSchedule}
          templates={templates}
          onClose={() => {
            setShowCreateModal(false);
            setEditingSchedule(null);
          }}
          onSave={() => {
            setShowCreateModal(false);
            setEditingSchedule(null);
            queryClient.invalidateQueries({ queryKey: ["remarkable", "schedules"] });
          }}
        />
      )}
    </div>
  );
}

interface ScheduleConfigModalProps {
  schedule: RemarkableSchedule | null;
  templates: Array<{ id: string; name: string; templateType: string }>;
  onClose: () => void;
  onSave: () => void;
}

function ScheduleConfigModal({
  schedule,
  templates,
  onClose,
  onSave,
}: ScheduleConfigModalProps) {
  const isEditing = !!schedule;

  const [templateId, setTemplateId] = useState<string | "">(schedule?.templateId || "");
  const [scheduleType, setScheduleType] = useState<string>(schedule?.scheduleType || "daily");
  const [pushTime, setPushTime] = useState(schedule?.pushTime || "06:00");
  const [pushDay, setPushDay] = useState<number>(schedule?.pushDay ?? 1);

  const saveSchedule = useMutation({
    mutationFn: async () => {
      if (isEditing && schedule) {
        return api.updateRemarkableSchedule(schedule.id, {
          pushTime,
          pushDay: scheduleType === "weekly" || scheduleType === "monthly" ? pushDay : undefined,
        });
      } else {
        return api.createRemarkableSchedule({
          templateId: templateId || undefined,
          scheduleType,
          pushTime,
          pushDay: scheduleType === "weekly" || scheduleType === "monthly" ? pushDay : undefined,
        });
      }
    },
    onSuccess: () => {
      onSave();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveSchedule.mutate();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">
            {isEditing ? "Edit Schedule" : "Create Schedule"}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-6">
          {/* Template */}
          {!isEditing && (
            <div>
              <label className="block font-medium mb-2">Template</label>
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              >
                <option value="">Default Daily Agenda</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Schedule Type */}
          {!isEditing && (
            <div>
              <label className="block font-medium mb-2">Frequency</label>
              <div className="grid grid-cols-2 gap-2">
                {SCHEDULE_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => setScheduleType(type.value)}
                    className={`p-3 rounded-md border text-left transition-colors ${
                      scheduleType === type.value
                        ? "border-primary bg-primary/10"
                        : "border-input hover:bg-muted"
                    }`}
                  >
                    <div className="font-medium text-sm">{type.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {type.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Push Time */}
          {scheduleType !== "manual" && (
            <div>
              <label htmlFor="pushTime" className="block font-medium mb-1">
                Push Time
              </label>
              <input
                id="pushTime"
                type="time"
                value={pushTime}
                onChange={(e) => setPushTime(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              />
            </div>
          )}

          {/* Push Day (for weekly) */}
          {scheduleType === "weekly" && (
            <div>
              <label className="block font-medium mb-2">Day of Week</label>
              <select
                value={pushDay}
                onChange={(e) => setPushDay(Number(e.target.value))}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              >
                {DAYS_OF_WEEK.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Push Day (for monthly) */}
          {scheduleType === "monthly" && (
            <div>
              <label htmlFor="pushDay" className="block font-medium mb-1">
                Day of Month
              </label>
              <input
                id="pushDay"
                type="number"
                min="1"
                max="31"
                value={pushDay}
                onChange={(e) => setPushDay(Number(e.target.value))}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={saveSchedule.isPending}>
              {saveSchedule.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Clock className="h-4 w-4 mr-2" />
              )}
              {isEditing ? "Save Changes" : "Create Schedule"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
