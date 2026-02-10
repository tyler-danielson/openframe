import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { X, Loader2, Save } from "lucide-react";
import { api, type RemarkableTemplate } from "../../../services/api";
import { Button } from "../../ui/Button";

interface WeeklyPlannerConfigProps {
  template?: RemarkableTemplate;
  onClose: () => void;
  onSave: () => void;
}

export function WeeklyPlannerConfig({
  template,
  onClose,
  onSave,
}: WeeklyPlannerConfigProps) {
  const isEditing = !!template;

  const [name, setName] = useState(template?.name || "Weekly Planner");
  const [folderPath, setFolderPath] = useState(template?.folderPath || "/Calendar/Weekly Planner");
  const [weekStartsOn, setWeekStartsOn] = useState<0 | 1 | 6>(
    (template?.config?.weekStartsOn as 0 | 1 | 6) ?? 1
  );
  const [showNotes, setShowNotes] = useState<boolean>(
    (template?.config?.showNotes as boolean) ?? true
  );
  const [notesPosition, setNotesPosition] = useState<"per-day" | "shared">(
    (template?.config?.notesPosition as "per-day" | "shared") ?? "shared"
  );
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>(
    (template?.config?.includeCalendarIds as string[]) || []
  );

  // Fetch calendars
  const { data: calendars = [] } = useQuery({
    queryKey: ["calendars"],
    queryFn: () => api.getCalendars(),
  });

  const visibleCalendars = calendars.filter((c) => c.isVisible);

  // Create/Update template
  const saveTemplate = useMutation({
    mutationFn: async () => {
      const config = {
        weekStartsOn,
        showNotes,
        notesPosition,
        includeCalendarIds: selectedCalendarIds.length > 0 ? selectedCalendarIds : undefined,
      };

      if (isEditing && template) {
        return api.updateRemarkableTemplate(template.id, { name, folderPath, config });
      } else {
        return api.createRemarkableTemplate({
          name,
          templateType: "weekly_planner",
          folderPath,
          config,
        });
      }
    },
    onSuccess: () => {
      onSave();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveTemplate.mutate();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {isEditing ? "Edit Weekly Planner" : "Create Weekly Planner"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-6">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block font-medium mb-1">
              Template Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
              placeholder="My Weekly Planner"
              required
            />
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
              placeholder="/Calendar/Weekly Planner"
            />
          </div>

          {/* Week starts on */}
          <div>
            <label className="block font-medium mb-2">Week Starts On</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 0, label: "Sunday" },
                { value: 1, label: "Monday" },
                { value: 6, label: "Saturday" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setWeekStartsOn(option.value as 0 | 1 | 6)}
                  className={`px-3 py-2 rounded-md border text-sm transition-colors ${
                    weekStartsOn === option.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input hover:bg-muted"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showNotes === true}
                onChange={(e) => setShowNotes(e.target.checked)}
                className="rounded"
              />
              <span className="font-medium">Show Notes Section</span>
            </label>

            {showNotes && (
              <div className="ml-6">
                <label className="block text-sm mb-2">Notes Position</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNotesPosition("per-day")}
                    className={`px-3 py-1.5 rounded-md border text-sm transition-colors ${
                      notesPosition === "per-day"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-input hover:bg-muted"
                    }`}
                  >
                    Per Day
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotesPosition("shared")}
                    className={`px-3 py-1.5 rounded-md border text-sm transition-colors ${
                      notesPosition === "shared"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-input hover:bg-muted"
                    }`}
                  >
                    Shared Area
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Calendars */}
          <div>
            <label className="block font-medium mb-2">Calendars to Include</label>
            <div className="space-y-2 max-h-40 overflow-y-auto border border-input rounded-md p-2">
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
                    onChange={() => {
                      setSelectedCalendarIds((prev) =>
                        prev.includes(cal.id)
                          ? prev.filter((id) => id !== cal.id)
                          : [...prev, cal.id]
                      );
                    }}
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
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={saveTemplate.isPending}>
              {saveTemplate.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {isEditing ? "Save Changes" : "Create Template"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
