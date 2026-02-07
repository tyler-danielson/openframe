import { type ReactNode, useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Popover from "@radix-ui/react-popover";
import { X, MapPin, Calendar, Clock, Users, Repeat, CircleDot, Car, Pencil, Home, Timer } from "lucide-react";
import { format } from "date-fns";
import type { CalendarEvent, Calendar as CalendarType } from "@openframe/shared";
import { Button } from "../ui/Button";
import { PlacesAutocomplete } from "../ui/PlacesAutocomplete";
import { TouchDatePicker } from "../ui/TouchDatePicker";
import { TouchTimePicker } from "../ui/TouchTimePicker";
import { useCalendarStore } from "../../stores/calendar";
import { api } from "../../services/api";
import { CountdownPlaceholderPicker } from "./CountdownPlaceholderPicker";

interface EventModalProps {
  event: CalendarEvent | null;
  open: boolean;
  onClose: () => void;
  onDelete?: (id: string) => void;
  onUpdate?: (event: CalendarEvent) => void;
}

// Parse description text and convert URLs and HTML links to clickable elements
function parseDescriptionWithLinks(text: string): ReactNode[] {
  // First, handle HTML anchor tags: <a href="url">text</a>
  // Then handle plain URLs
  const parts: ReactNode[] = [];

  // Regex to match HTML anchor tags or plain URLs
  const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>|https?:\/\/[^\s<]+/gi;

  let lastIndex = 0;
  let match;
  let keyIndex = 0;

  while ((match = linkRegex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    // Check if it's an HTML anchor tag or plain URL
    if (match[1]) {
      // HTML anchor tag - use the href and display text
      parts.push(
        <a
          key={keyIndex++}
          href={match[1]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline break-all"
        >
          {match[2] || match[1]}
        </a>
      );
    } else {
      // Plain URL
      parts.push(
        <a
          key={keyIndex++}
          href={match[0]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline break-all"
        >
          {match[0]}
        </a>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

export function EventModal({ event, open, onClose, onDelete, onUpdate }: EventModalProps) {
  const calendars = useCalendarStore((state) => state.calendars);
  const homeAddress = useCalendarStore((state) => state.homeAddress);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIsAllDay, setEditIsAllDay] = useState(false);
  const [editIsMultiDay, setEditIsMultiDay] = useState(false);

  // Touch picker visibility
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const [drivingTime, setDrivingTime] = useState<{
    duration: string;
    durationInTraffic: string | null;
    distance: string;
  } | null>(null);
  const [drivingTimeLoading, setDrivingTimeLoading] = useState(false);
  const [showRoutes, setShowRoutes] = useState(false);
  const [showCountdownPicker, setShowCountdownPicker] = useState(false);

  // Reset edit state when modal opens/closes or event changes
  useEffect(() => {
    if (event && open) {
      setEditTitle(event.title);
      setEditLocation(event.location ?? "");
      setEditDescription(event.description ?? "");
      setEditIsAllDay(event.isAllDay ?? false);

      const start = new Date(event.startTime);
      const end = new Date(event.endTime);

      const startDateStr = format(start, "yyyy-MM-dd");
      const endDateStr = format(end, "yyyy-MM-dd");

      setEditStartDate(startDateStr);
      setEditEndDate(endDateStr);
      setEditStartTime(format(start, "HH:mm"));
      setEditEndTime(format(end, "HH:mm"));

      // Detect if event spans multiple days
      setEditIsMultiDay(startDateStr !== endDateStr);
    }
    if (open && event) {
      setIsEditing(true);
    } else if (!open) {
      setIsEditing(false);
      setShowRoutes(false);
      setShowStartDatePicker(false);
      setShowStartTimePicker(false);
      setShowEndDatePicker(false);
      setShowEndTimePicker(false);
      setShowCountdownPicker(false);
    }
  }, [event, open]);

  // Fetch driving time when event has location and home address is set
  useEffect(() => {
    if (!event?.location || !homeAddress || !open || isEditing) {
      setDrivingTime(null);
      return;
    }

    async function fetchDrivingTime() {
      setDrivingTimeLoading(true);
      try {
        const result = await api.getDrivingDistance(homeAddress, event!.location!);
        setDrivingTime({
          duration: result.duration.text,
          durationInTraffic: result.durationInTraffic?.text ?? null,
          distance: result.distance.text,
        });
      } catch (error) {
        console.error("Failed to fetch driving time:", error);
        setDrivingTime(null);
      } finally {
        setDrivingTimeLoading(false);
      }
    }

    fetchDrivingTime();
  }, [event?.location, homeAddress, open, isEditing]);

  if (!event) return null;

  const startDate = new Date(event.startTime);
  const endDate = new Date(event.endTime);
  const calendar = calendars.find((c) => c.id === event.calendarId);

  const formatEventTime = () => {
    if (event.isAllDay) {
      return "All day";
    }
    return `${format(startDate, "h:mm a")} - ${format(endDate, "h:mm a")}`;
  };

  // Format time for display (12-hour format)
  const formatTimeDisplay = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    const hour = h ?? 0;
    const minute = m ?? 0;
    const period = hour >= 12 ? "PM" : "AM";
    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${hour12}:${minute.toString().padStart(2, "0")} ${period}`;
  };

  // Format date for display (parse as local date, not UTC)
  const formatDateDisplay = (dateStr: string) => {
    const parts = dateStr.split("-").map(Number);
    const year = parts[0] ?? 2026;
    const month = parts[1] ?? 1;
    const day = parts[2] ?? 1;
    const localDate = new Date(year, month - 1, day);
    return format(localDate, "EEE, MMM d");
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let startDateTime: Date;
      let endDateTime: Date;

      // Use start date for end date if not multi-day
      const effectiveEndDate = editIsMultiDay ? editEndDate : editStartDate;

      if (editIsAllDay) {
        startDateTime = new Date(editStartDate + "T00:00:00");
        endDateTime = new Date(effectiveEndDate + "T23:59:59");
      } else {
        startDateTime = new Date(`${editStartDate}T${editStartTime}`);
        endDateTime = new Date(`${effectiveEndDate}T${editEndTime}`);
      }

      const updatedEvent = await api.updateEvent(event.id, {
        title: editTitle,
        startTime: startDateTime,
        endTime: endDateTime,
        location: editLocation || undefined,
        description: editDescription || undefined,
        isAllDay: editIsAllDay,
      });

      onUpdate?.(updatedEvent);
      onClose(); // Close modal after successful save
    } catch (error) {
      console.error("Failed to update event:", error);
      alert("Failed to save event. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form to original values
    setEditTitle(event.title);
    setEditLocation(event.location ?? "");
    setEditDescription(event.description ?? "");
    setEditIsAllDay(event.isAllDay ?? false);

    const start = new Date(event.startTime);
    const end = new Date(event.endTime);

    const startDateStr = format(start, "yyyy-MM-dd");
    const endDateStr = format(end, "yyyy-MM-dd");

    setEditStartDate(startDateStr);
    setEditEndDate(endDateStr);
    setEditStartTime(format(start, "HH:mm"));
    setEditEndTime(format(end, "HH:mm"));
    setEditIsMultiDay(startDateStr !== endDateStr);

    setIsEditing(false);
    setShowStartDatePicker(false);
    setShowStartTimePicker(false);
    setShowEndDatePicker(false);
    setShowEndTimePicker(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 max-h-[90vh] w-full max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-xl border border-border bg-card p-4 shadow-xl data-[state=open]:animate-slide-up">
          <div className="mb-3 flex items-start justify-between">
            {isEditing ? (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="flex-1 text-xl font-semibold bg-transparent border-b border-border focus:border-primary focus:outline-none py-2 touch-manipulation"
                placeholder="Event title"
              />
            ) : (
              <Dialog.Title className="text-xl font-semibold">
                {event.title}
              </Dialog.Title>
            )}
            <Dialog.Close asChild>
              <button className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground ml-2">
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            {/* Calendar */}
            {calendar && (
              <div className="flex items-center gap-3 text-sm">
                <div
                  className="h-4 w-4 rounded-full"
                  style={{ backgroundColor: calendar.color }}
                />
                <p>{calendar.name}</p>
              </div>
            )}

            {/* Date and time */}
            {isEditing ? (
              <div className="space-y-3">
                {/* Toggles row */}
                <div className="flex items-center gap-4">
                  {/* All day toggle */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditIsAllDay(!editIsAllDay)}
                      className={`relative w-10 h-6 rounded-full transition-colors touch-manipulation ${
                        editIsAllDay ? "bg-primary" : "bg-muted"
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                          editIsAllDay ? "translate-x-4" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                    <label className="text-sm">All day</label>
                  </div>
                  {/* Multi-day toggle */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditIsMultiDay(!editIsMultiDay);
                        setShowEndDatePicker(false);
                      }}
                      className={`relative w-10 h-6 rounded-full transition-colors touch-manipulation ${
                        editIsMultiDay ? "bg-primary" : "bg-muted"
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                          editIsMultiDay ? "translate-x-4" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                    <label className="text-sm">Multi-day</label>
                  </div>
                </div>

                {/* Date and Time row */}
                <div className="flex gap-2">
                  {/* Date picker */}
                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-1">
                      {editIsMultiDay ? "Start" : "Date"}
                    </label>
                    <Popover.Root open={showStartDatePicker} onOpenChange={setShowStartDatePicker}>
                      <Popover.Trigger asChild>
                        <button
                          type="button"
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-colors touch-manipulation ${
                            showStartDatePicker
                              ? "border-primary bg-primary/5"
                              : "border-border hover:bg-accent"
                          }`}
                        >
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{formatDateDisplay(editStartDate)}</span>
                        </button>
                      </Popover.Trigger>
                      <Popover.Portal>
                        <Popover.Content
                          className="z-[9999] bg-card border border-border rounded-xl shadow-xl"
                          sideOffset={4}
                          align="start"
                        >
                          <TouchDatePicker
                            value={editStartDate}
                            onChange={(value) => {
                              setEditStartDate(value);
                              if (editIsMultiDay && new Date(value) > new Date(editEndDate)) {
                                setEditEndDate(value);
                              }
                            }}
                            onSelect={() => setShowStartDatePicker(false)}
                          />
                        </Popover.Content>
                      </Popover.Portal>
                    </Popover.Root>
                  </div>

                  {/* End Date (only if multi-day) */}
                  {editIsMultiDay && (
                    <div className="flex-1">
                      <label className="block text-sm font-medium mb-1">End</label>
                      <Popover.Root open={showEndDatePicker} onOpenChange={setShowEndDatePicker}>
                        <Popover.Trigger asChild>
                          <button
                            type="button"
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-colors touch-manipulation ${
                              showEndDatePicker
                                ? "border-primary bg-primary/5"
                                : "border-border hover:bg-accent"
                            }`}
                          >
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{formatDateDisplay(editEndDate)}</span>
                          </button>
                        </Popover.Trigger>
                        <Popover.Portal>
                          <Popover.Content
                            className="z-[9999] bg-card border border-border rounded-xl shadow-xl"
                            sideOffset={4}
                            align="start"
                          >
                            <TouchDatePicker
                              value={editEndDate}
                              onChange={setEditEndDate}
                              onSelect={() => setShowEndDatePicker(false)}
                            />
                          </Popover.Content>
                        </Popover.Portal>
                      </Popover.Root>
                    </div>
                  )}
                </div>

                {/* Time pickers (only if not all-day) */}
                {!editIsAllDay && (
                  <div className="flex gap-2">
                    {/* Start Time */}
                    <div className="flex-1">
                      <label className="block text-sm font-medium mb-1">Start Time</label>
                      <Popover.Root open={showStartTimePicker} onOpenChange={setShowStartTimePicker}>
                        <Popover.Trigger asChild>
                          <button
                            type="button"
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors touch-manipulation ${
                              showStartTimePicker
                                ? "border-primary bg-primary/5"
                                : "border-border hover:bg-accent"
                            }`}
                          >
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{formatTimeDisplay(editStartTime)}</span>
                          </button>
                        </Popover.Trigger>
                        <Popover.Portal>
                          <Popover.Content
                            className="z-[9999] bg-card border border-border rounded-xl shadow-xl"
                            sideOffset={4}
                            align="start"
                          >
                            <TouchTimePicker
                              value={editStartTime}
                              onChange={setEditStartTime}
                              onSelect={() => setShowStartTimePicker(false)}
                            />
                          </Popover.Content>
                        </Popover.Portal>
                      </Popover.Root>
                    </div>
                    {/* End Time */}
                    <div className="flex-1">
                      <label className="block text-sm font-medium mb-1">End Time</label>
                      <Popover.Root open={showEndTimePicker} onOpenChange={setShowEndTimePicker}>
                        <Popover.Trigger asChild>
                          <button
                            type="button"
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors touch-manipulation ${
                              showEndTimePicker
                                ? "border-primary bg-primary/5"
                                : "border-border hover:bg-accent"
                            }`}
                          >
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{formatTimeDisplay(editEndTime)}</span>
                          </button>
                        </Popover.Trigger>
                        <Popover.Portal>
                          <Popover.Content
                            className="z-[9999] bg-card border border-border rounded-xl shadow-xl"
                            sideOffset={4}
                            align="end"
                          >
                            <TouchTimePicker
                              value={editEndTime}
                              onChange={setEditEndTime}
                              onSelect={() => setShowEndTimePicker(false)}
                            />
                          </Popover.Content>
                        </Popover.Portal>
                      </Popover.Root>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-start gap-3 text-sm">
                <Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">
                    {format(startDate, "EEEE, MMMM d, yyyy")}
                  </p>
                  <p className="text-muted-foreground">{formatEventTime()}</p>
                </div>
              </div>
            )}

            {/* Recurring */}
            {event.recurrenceRule && !isEditing && (
              <div className="flex items-center gap-3 text-sm">
                <Repeat className="h-4 w-4 text-muted-foreground" />
                <p className="text-muted-foreground">Recurring event</p>
              </div>
            )}

            {/* Status */}
            {event.status && event.status !== "confirmed" && !isEditing && (
              <div className="flex items-center gap-3 text-sm">
                <CircleDot className="h-4 w-4 text-muted-foreground" />
                <p className="capitalize text-muted-foreground">{event.status}</p>
              </div>
            )}

            {/* Location */}
            {isEditing ? (
              <div>
                <label className="block text-sm font-medium mb-2">Location</label>
                <PlacesAutocomplete
                  value={editLocation}
                  onChange={setEditLocation}
                  placeholder="Search for a location"
                  className="rounded-md px-3 py-3 text-base"
                />
              </div>
            ) : event.location ? (
              <div className="space-y-2">
                <div className="flex items-start gap-3 text-sm">
                  <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {event.location}
                  </a>
                </div>

                {/* Driving time from home */}
                {homeAddress && (
                  <div className="flex items-center gap-3 text-sm ml-7">
                    <Car className="h-4 w-4 text-muted-foreground" />
                    {drivingTimeLoading ? (
                      <span className="text-muted-foreground">Calculating...</span>
                    ) : drivingTime ? (
                      <div className="text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {drivingTime.durationInTraffic ?? drivingTime.duration}
                        </span>
                        {drivingTime.durationInTraffic && drivingTime.durationInTraffic !== drivingTime.duration && (
                          <span className="text-xs ml-1">(with traffic)</span>
                        )}
                        <span className="mx-1">·</span>
                        <span>{drivingTime.distance}</span>
                        <span className="text-xs ml-1">from home</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">Unable to calculate drive time</span>
                    )}
                  </div>
                )}

                <div className={`ml-7 rounded-lg overflow-hidden border border-border transition-all duration-300 ${showRoutes ? "h-80" : "h-[150px]"}`}>
                  <iframe
                    title="Event location map"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={
                      showRoutes && homeAddress
                        ? `https://www.google.com/maps/embed/v1/directions?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ""}&origin=${encodeURIComponent(homeAddress)}&destination=${encodeURIComponent(event.location)}&mode=driving`
                        : `https://www.google.com/maps?q=${encodeURIComponent(event.location)}&output=embed`
                    }
                  />
                </div>

                {homeAddress && (
                  <button
                    onClick={() => setShowRoutes(!showRoutes)}
                    className="flex items-center justify-center gap-2 w-full ml-7 py-2 px-4 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium touch-manipulation"
                    style={{ width: "calc(100% - 1.75rem)" }}
                  >
                    {showRoutes ? (
                      <>Hide Route</>
                    ) : (
                      <>
                        <Home className="h-4 w-4" />
                        <span>Show Route from</span>
                        <Car className="h-4 w-4" />
                      </>
                    )}
                  </button>
                )}
              </div>
            ) : null}

            {/* Description */}
            {isEditing ? (
              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Add description"
                  rows={4}
                  className="w-full rounded-md border border-border bg-background px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-primary resize-none touch-manipulation"
                />
              </div>
            ) : event.description ? (
              <div className="rounded-md bg-muted/50 p-3 text-sm">
                <p className="whitespace-pre-wrap">
                  {parseDescriptionWithLinks(event.description)}
                </p>
              </div>
            ) : null}

            {/* Attendees */}
            {event.attendees && event.attendees.length > 0 && !isEditing && (
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">Attendees ({event.attendees.length})</p>
                </div>
                <div className="space-y-1 ml-7">
                  {event.attendees.map((attendee, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-medium text-primary">
                        {(attendee.name ?? attendee.email)[0]?.toUpperCase()}
                      </div>
                      <span>{attendee.name ?? attendee.email}</span>
                      {attendee.organizer && (
                        <span className="text-xs">(Organizer)</span>
                      )}
                      {attendee.responseStatus && attendee.responseStatus !== "needsAction" && (
                        <span className="text-xs capitalize">({attendee.responseStatus})</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-4 flex gap-2">
            {isEditing ? (
              <>
                <Button
                  variant="outline"
                  className="flex-1 py-2 text-sm touch-manipulation"
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 py-2 text-sm touch-manipulation"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </>
            ) : (
              <>
                {onDelete && (
                  <Button
                    variant="destructive"
                    className="flex-1 py-2 text-sm touch-manipulation"
                    onClick={() => {
                      onDelete(event.id);
                      onClose();
                    }}
                  >
                    Delete
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="flex-1 py-2 text-sm touch-manipulation"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 py-2 text-sm touch-manipulation"
                  onClick={() => setShowCountdownPicker(true)}
                >
                  <Timer className="h-4 w-4 mr-2" />
                  Countdown
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 py-2 text-sm touch-manipulation"
                  onClick={onClose}
                >
                  Close
                </Button>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>

      {/* Countdown Placeholder Picker */}
      {showCountdownPicker && (
        <CountdownPlaceholderPicker
          event={event}
          open={showCountdownPicker}
          onClose={() => setShowCountdownPicker(false)}
        />
      )}
    </Dialog.Root>
  );
}
