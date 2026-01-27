import { type ReactNode, useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, MapPin, Calendar, Clock, Users, Repeat, CircleDot, Car, Pencil, Home } from "lucide-react";
import { format } from "date-fns";
import type { CalendarEvent, Calendar as CalendarType } from "@openframe/shared";
import { Button } from "../ui/Button";
import { PlacesAutocomplete } from "../ui/PlacesAutocomplete";
import { useCalendarStore } from "../../stores/calendar";
import { api } from "../../services/api";

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

// Format date for datetime-local input
function formatDateTimeLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Format date for date input
function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function EventModal({ event, open, onClose, onDelete, onUpdate }: EventModalProps) {
  const calendars = useCalendarStore((state) => state.calendars);
  const homeAddress = useCalendarStore((state) => state.homeAddress);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIsAllDay, setEditIsAllDay] = useState(false);

  const [drivingTime, setDrivingTime] = useState<{
    duration: string;
    durationInTraffic: string | null;
    distance: string;
  } | null>(null);
  const [drivingTimeLoading, setDrivingTimeLoading] = useState(false);
  const [showRoutes, setShowRoutes] = useState(false);

  // Reset edit state when modal opens/closes or event changes
  useEffect(() => {
    if (event && open) {
      setEditTitle(event.title);
      setEditLocation(event.location ?? "");
      setEditDescription(event.description ?? "");
      setEditIsAllDay(event.isAllDay ?? false);

      const start = new Date(event.startTime);
      const end = new Date(event.endTime);

      if (event.isAllDay) {
        setEditStartTime(formatDateLocal(start));
        setEditEndTime(formatDateLocal(end));
      } else {
        setEditStartTime(formatDateTimeLocal(start));
        setEditEndTime(formatDateTimeLocal(end));
      }
    }
    if (!open) {
      setIsEditing(false);
      setShowRoutes(false);
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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let startTime: Date;
      let endTime: Date;

      if (editIsAllDay) {
        startTime = new Date(editStartTime + "T00:00:00");
        endTime = new Date(editEndTime + "T23:59:59");
      } else {
        startTime = new Date(editStartTime);
        endTime = new Date(editEndTime);
      }

      const updatedEvent = await api.updateEvent(event.id, {
        title: editTitle,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        location: editLocation || undefined,
        description: editDescription || undefined,
        isAllDay: editIsAllDay,
      });

      onUpdate?.(updatedEvent);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to update event:", error);
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

    if (event.isAllDay) {
      setEditStartTime(formatDateLocal(start));
      setEditEndTime(formatDateLocal(end));
    } else {
      setEditStartTime(formatDateTimeLocal(start));
      setEditEndTime(formatDateTimeLocal(end));
    }

    setIsEditing(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 max-h-[85vh] w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-xl border border-border bg-card p-6 shadow-xl data-[state=open]:animate-slide-up">
          <div className="mb-4 flex items-start justify-between">
            {isEditing ? (
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="flex-1 text-xl font-semibold bg-transparent border-b border-border focus:border-primary focus:outline-none"
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
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="allDay"
                    checked={editIsAllDay}
                    onChange={(e) => {
                      setEditIsAllDay(e.target.checked);
                      // Convert times when toggling
                      if (e.target.checked) {
                        setEditStartTime(formatDateLocal(new Date(editStartTime)));
                        setEditEndTime(formatDateLocal(new Date(editEndTime)));
                      } else {
                        const start = new Date(editStartTime);
                        start.setHours(9, 0, 0, 0);
                        const end = new Date(editEndTime);
                        end.setHours(10, 0, 0, 0);
                        setEditStartTime(formatDateTimeLocal(start));
                        setEditEndTime(formatDateTimeLocal(end));
                      }
                    }}
                    className="rounded"
                  />
                  <label htmlFor="allDay" className="text-sm">All day</label>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 space-y-2">
                    <input
                      type={editIsAllDay ? "date" : "datetime-local"}
                      value={editStartTime}
                      onChange={(e) => setEditStartTime(e.target.value)}
                      className="w-full rounded border border-border bg-background px-2 py-1 text-sm focus:border-primary focus:outline-none"
                    />
                    <input
                      type={editIsAllDay ? "date" : "datetime-local"}
                      value={editEndTime}
                      onChange={(e) => setEditEndTime(e.target.value)}
                      className="w-full rounded border border-border bg-background px-2 py-1 text-sm focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
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
              <div className="flex items-start gap-3">
                <MapPin className="mt-2 h-4 w-4 text-muted-foreground" />
                <PlacesAutocomplete
                  value={editLocation}
                  onChange={setEditLocation}
                  placeholder="Search for a location"
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
                    className="flex items-center justify-center gap-2 w-full ml-7 py-2 px-4 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
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
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">Description</label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Add description"
                  rows={4}
                  className="w-full rounded border border-border bg-background px-2 py-1 text-sm focus:border-primary focus:outline-none resize-none"
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
          <div className="mt-6 flex justify-end gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" size="sm" onClick={handleCancel} disabled={isSaving}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </>
            ) : (
              <>
                {onDelete && (
                  <Button
                    variant="destructive"
                    size="sm"
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
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" onClick={onClose}>
                  Close
                </Button>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
