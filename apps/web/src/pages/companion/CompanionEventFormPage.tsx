import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2, ChevronDown } from "lucide-react";
import { api } from "../../services/api";
import { Button } from "../../components/ui/Button";
import { CompanionPageHeader } from "./components/CompanionPageHeader";
import { useCompanion } from "./CompanionContext";
import { TouchDatePicker } from "../../components/ui/TouchDatePicker";
import { TouchTimePicker } from "../../components/ui/TouchTimePicker";

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toTimeStr(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function combineDateAndTime(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min] = timeStr.split(":").map(Number);
  return new Date(y!, m! - 1, d!, h, min);
}

export function CompanionEventFormPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const companion = useCompanion();
  const isEdit = !!eventId;

  // Block access if no edit permission
  if (!companion.canEditCalendar && !isEdit) {
    navigate("/companion/calendar", { replace: true });
  }

  const defaultDate = searchParams.get("date") || toDateStr(new Date());
  const now = new Date();
  const nextHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1);

  const [title, setTitle] = useState("");
  const [calendarId, setCalendarId] = useState("");
  const [isAllDay, setIsAllDay] = useState(false);
  const [startDate, setStartDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState(toTimeStr(nextHour));
  const [endDate, setEndDate] = useState(defaultDate);
  const [endTime, setEndTime] = useState(toTimeStr(new Date(nextHour.getTime() + 3600000)));
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [showStartDate, setShowStartDate] = useState(false);
  const [showStartTime, setShowStartTime] = useState(false);
  const [showEndDate, setShowEndDate] = useState(false);
  const [showEndTime, setShowEndTime] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const { data: calendars } = useQuery({
    queryKey: ["companion-calendars"],
    queryFn: () => api.getCompanionCalendars(),
    staleTime: 300_000,
  });

  // Set default calendar
  useEffect(() => {
    if (calendars && calendars.length > 0 && !calendarId) {
      const primary = calendars.find((c: any) => c.isPrimary) || calendars[0]!;
      setCalendarId(primary.id);
    }
  }, [calendars, calendarId]);

  // Load event for editing
  const { data: existingEvent, isLoading: eventLoading } = useQuery({
    queryKey: ["companion-event", eventId],
    queryFn: async () => {
      const start = new Date(2000, 0, 1);
      const end = new Date(2100, 0, 1);
      const events = await api.getCompanionEvents(start, end);
      return events.find((e: any) => e.id === eventId);
    },
    enabled: isEdit,
  });

  useEffect(() => {
    if (existingEvent) {
      setTitle(existingEvent.title || "");
      setCalendarId(existingEvent.calendarId || "");
      setIsAllDay(existingEvent.isAllDay || false);
      const s = new Date(existingEvent.startTime);
      const e = new Date(existingEvent.endTime);
      setStartDate(toDateStr(s));
      setStartTime(toTimeStr(s));
      setEndDate(toDateStr(e));
      setEndTime(toTimeStr(e));
      setLocation(existingEvent.location || "");
      setDescription(existingEvent.description || "");
    }
  }, [existingEvent]);

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createCompanionEvent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companion-calendar-events"] });
      queryClient.invalidateQueries({ queryKey: ["companion-today-events"] });
      navigate(-1);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.updateCompanionEvent(eventId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companion-calendar-events"] });
      queryClient.invalidateQueries({ queryKey: ["companion-today-events"] });
      navigate(-1);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteCompanionEvent(eventId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companion-calendar-events"] });
      queryClient.invalidateQueries({ queryKey: ["companion-today-events"] });
      navigate("/companion/calendar", { replace: true });
    },
  });

  const handleSubmit = () => {
    if (!title.trim()) return;

    const startDT = isAllDay
      ? new Date(startDate + "T00:00:00")
      : combineDateAndTime(startDate, startTime);
    const endDT = isAllDay
      ? new Date(endDate + "T23:59:59")
      : combineDateAndTime(endDate, endTime);

    const data = {
      calendarId,
      title: title.trim(),
      startTime: startDT,
      endTime: endDT,
      isAllDay,
      location: location.trim() || undefined,
      description: description.trim() || undefined,
    };

    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (isEdit && eventLoading) {
    return (
      <div className="flex flex-col h-full">
        <CompanionPageHeader title="Edit Event" />
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const formatDisplayDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y!, m! - 1, d!).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const formatDisplayTime = (timeStr: string) => {
    const [h, m] = timeStr.split(":").map(Number);
    const d = new Date(2000, 0, 1, h, m);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  return (
    <div className="flex flex-col h-full">
      <CompanionPageHeader
        title={isEdit ? "Edit Event" : "New Event"}
        rightAction={
          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || isSaving}
            size="sm"
            className="rounded-lg"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Title */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Event title"
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-base font-medium focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
          autoFocus={!isEdit}
        />

        {/* Calendar selector */}
        {calendars && calendars.length > 1 && (
          <div className="relative">
            <select
              value={calendarId}
              onChange={(e) => setCalendarId(e.target.value)}
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm appearance-none focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
            >
              {calendars.map((cal: any) => (
                <option key={cal.id} value={cal.id}>
                  {cal.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
        )}

        {/* All-day toggle */}
        <div className="flex items-center justify-between px-1">
          <span className="text-sm font-medium text-foreground">All day</span>
          <button
            type="button"
            onClick={() => setIsAllDay(!isAllDay)}
            className={`w-11 h-6 rounded-full transition-colors relative ${
              isAllDay ? "bg-primary" : "bg-muted"
            }`}
          >
            <div
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                isAllDay ? "translate-x-[22px]" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {/* Start date/time */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground px-1">Start</label>
          <button
            onClick={() => setShowStartDate(!showStartDate)}
            className="w-full text-left px-4 py-3 rounded-xl border border-border bg-card text-sm"
          >
            {formatDisplayDate(startDate)}
          </button>
          {showStartDate && (
            <TouchDatePicker
              value={startDate}
              onChange={setStartDate}
              onSelect={() => setShowStartDate(false)}
            />
          )}
          {!isAllDay && (
            <>
              <button
                onClick={() => setShowStartTime(!showStartTime)}
                className="w-full text-left px-4 py-3 rounded-xl border border-border bg-card text-sm"
              >
                {formatDisplayTime(startTime)}
              </button>
              {showStartTime && (
                <TouchTimePicker
                  value={startTime}
                  onChange={setStartTime}
                  onSelect={() => setShowStartTime(false)}
                />
              )}
            </>
          )}
        </div>

        {/* End date/time */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground px-1">End</label>
          <button
            onClick={() => setShowEndDate(!showEndDate)}
            className="w-full text-left px-4 py-3 rounded-xl border border-border bg-card text-sm"
          >
            {formatDisplayDate(endDate)}
          </button>
          {showEndDate && (
            <TouchDatePicker
              value={endDate}
              onChange={setEndDate}
              onSelect={() => setShowEndDate(false)}
            />
          )}
          {!isAllDay && (
            <>
              <button
                onClick={() => setShowEndTime(!showEndTime)}
                className="w-full text-left px-4 py-3 rounded-xl border border-border bg-card text-sm"
              >
                {formatDisplayTime(endTime)}
              </button>
              {showEndTime && (
                <TouchTimePicker
                  value={endTime}
                  onChange={setEndTime}
                  onSelect={() => setShowEndTime(false)}
                />
              )}
            </>
          )}
        </div>

        {/* Location */}
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Location"
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
        />

        {/* Description */}
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          rows={3}
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"
        />

        {/* Delete button (edit mode) */}
        {isEdit && (
          <div className="pt-4">
            {showDelete ? (
              <div className="space-y-2">
                <p className="text-sm text-center text-muted-foreground">Delete this event?</p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 rounded-xl"
                    onClick={() => setShowDelete(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1 rounded-xl gap-2"
                    onClick={() => deleteMutation.mutate()}
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Delete
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowDelete(true)}
                className="w-full flex items-center justify-center gap-2 h-12 rounded-xl text-destructive border border-destructive/30 text-sm font-medium hover:bg-destructive/5 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Delete Event
              </button>
            )}
          </div>
        )}

        {/* Error display */}
        {(createMutation.error || updateMutation.error) && (
          <p className="text-sm text-destructive text-center">
            {(createMutation.error as any)?.message || (updateMutation.error as any)?.message || "Failed to save event"}
          </p>
        )}
      </div>
    </div>
  );
}
