import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { X, Loader2, Save } from "lucide-react";
import { api, type RemarkableAgendaSettings } from "../../services/api";
import { Button } from "../ui/Button";

interface RemarkableSettingsProps {
  settings: RemarkableAgendaSettings;
  onClose: () => void;
  onSave: () => void;
}

export function RemarkableSettings({
  settings,
  onClose,
  onSave,
}: RemarkableSettingsProps) {
  const [enabled, setEnabled] = useState(settings.enabled);
  const [pushTime, setPushTime] = useState(settings.pushTime);
  const [folderPath, setFolderPath] = useState(settings.folderPath);
  const [showLocation, setShowLocation] = useState(settings.showLocation);
  const [showDescription, setShowDescription] = useState(settings.showDescription);
  const [notesLines, setNotesLines] = useState(settings.notesLines);
  const [templateStyle, setTemplateStyle] = useState(settings.templateStyle);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>(
    settings.includeCalendarIds || []
  );

  // Fetch calendars for selection
  const { data: calendars = [] } = useQuery({
    queryKey: ["calendars"],
    queryFn: () => api.getCalendars(),
  });

  const visibleCalendars = calendars.filter((c) => c.isVisible);

  const updateSettings = useMutation({
    mutationFn: () =>
      api.updateRemarkableSettings({
        enabled,
        pushTime,
        folderPath,
        includeCalendarIds: selectedCalendarIds.length > 0 ? selectedCalendarIds : null,
        showLocation,
        showDescription,
        notesLines,
        templateStyle,
      }),
    onSuccess: () => {
      onSave();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings.mutate();
  };

  const toggleCalendar = (calendarId: string) => {
    setSelectedCalendarIds((prev) =>
      prev.includes(calendarId)
        ? prev.filter((id) => id !== calendarId)
        : [...prev, calendarId]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">reMarkable Settings</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-6">
          {/* Auto-push enabled */}
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium">Daily Agenda Push</label>
              <p className="text-sm text-muted-foreground">
                Automatically push agenda each morning
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                enabled ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Push time */}
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
            <p className="text-xs text-muted-foreground mt-1">
              Time when agenda is pushed to your tablet
            </p>
          </div>

          {/* Folder path */}
          <div>
            <label htmlFor="folderPath" className="block font-medium mb-1">
              Folder Path
            </label>
            <input
              id="folderPath"
              type="text"
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md bg-background font-mono text-sm"
              placeholder="/Calendar/Daily Agenda"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Folder in reMarkable where agendas will be saved
            </p>
          </div>

          {/* Calendars to include */}
          <div>
            <label className="block font-medium mb-2">
              Calendars to Include
            </label>
            <div className="space-y-2 max-h-40 overflow-y-auto border border-input rounded-md p-2">
              {visibleCalendars.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">
                  No visible calendars
                </p>
              ) : (
                <>
                  <label className="flex items-center gap-2 p-1 hover:bg-muted rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCalendarIds.length === 0}
                      onChange={() => setSelectedCalendarIds([])}
                      className="rounded"
                    />
                    <span className="text-sm">All visible calendars</span>
                  </label>
                  <hr className="my-1" />
                  {visibleCalendars.map((cal) => (
                    <label
                      key={cal.id}
                      className="flex items-center gap-2 p-1 hover:bg-muted rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCalendarIds.includes(cal.id)}
                        onChange={() => toggleCalendar(cal.id)}
                        className="rounded"
                        disabled={selectedCalendarIds.length === 0}
                      />
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: cal.color }}
                      />
                      <span className="text-sm truncate">{cal.name}</span>
                    </label>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Template options */}
          <div className="space-y-3">
            <label className="block font-medium">Agenda Content</label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showLocation}
                onChange={(e) => setShowLocation(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Show event location</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showDescription}
                onChange={(e) => setShowDescription(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Show event description</span>
            </label>
          </div>

          {/* Notes lines */}
          <div>
            <label htmlFor="notesLines" className="block font-medium mb-1">
              Notes Lines: {notesLines}
            </label>
            <input
              id="notesLines"
              type="range"
              min="0"
              max="50"
              value={notesLines}
              onChange={(e) => setNotesLines(parseInt(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Number of lined rows in the notes section
            </p>
          </div>

          {/* Template style */}
          <div>
            <label className="block font-medium mb-2">Template Style</label>
            <div className="grid grid-cols-3 gap-2">
              {(["default", "minimal", "detailed"] as const).map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => setTemplateStyle(style)}
                  className={`px-3 py-2 rounded-md border text-sm capitalize transition-colors ${
                    templateStyle === style
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input hover:bg-muted"
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>

          {/* Save button */}
          <div className="flex gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={updateSettings.isPending}
            >
              {updateSettings.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Settings
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
