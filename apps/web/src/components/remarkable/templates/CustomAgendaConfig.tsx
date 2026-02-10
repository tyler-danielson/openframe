import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { X, Loader2, Save, Plus, Trash2 } from "lucide-react";
import { api, type RemarkableTemplate } from "../../../services/api";
import { Button } from "../../ui/Button";

interface CustomAgendaConfigProps {
  template?: RemarkableTemplate;
  onClose: () => void;
  onSave: () => void;
}

type LayoutType = "timeline" | "list" | "blocks";

interface CustomSection {
  name: string;
  position: "top" | "bottom";
}

export function CustomAgendaConfig({
  template,
  onClose,
  onSave,
}: CustomAgendaConfigProps) {
  const isEditing = !!template;

  const [name, setName] = useState(template?.name || "Custom Agenda");
  const [folderPath, setFolderPath] = useState(template?.folderPath || "/Calendar/Custom Agenda");
  const [layout, setLayout] = useState<LayoutType>(
    (template?.config?.layout as LayoutType) ?? "list"
  );
  const [showLocation, setShowLocation] = useState<boolean>(
    (template?.config?.showLocation as boolean) ?? true
  );
  const [showDescription, setShowDescription] = useState<boolean>(
    (template?.config?.showDescription as boolean) ?? false
  );
  const [customSections, setCustomSections] = useState<CustomSection[]>(
    (template?.config?.customSections as CustomSection[]) || []
  );
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>(
    (template?.config?.includeCalendarIds as string[]) || []
  );
  const [newSectionName, setNewSectionName] = useState("");

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
        layout,
        showLocation,
        showDescription,
        customSections,
        includeCalendarIds: selectedCalendarIds.length > 0 ? selectedCalendarIds : undefined,
      };

      if (isEditing && template) {
        return api.updateRemarkableTemplate(template.id, { name, folderPath, config });
      } else {
        return api.createRemarkableTemplate({
          name,
          templateType: "custom_agenda",
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

  const addSection = (position: "top" | "bottom") => {
    if (newSectionName.trim()) {
      setCustomSections([...customSections, { name: newSectionName.trim(), position }]);
      setNewSectionName("");
    }
  };

  const removeSection = (index: number) => {
    setCustomSections(customSections.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {isEditing ? "Edit Custom Agenda" : "Create Custom Agenda"}
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
              placeholder="My Custom Agenda"
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
              placeholder="/Calendar/Custom Agenda"
            />
          </div>

          {/* Layout */}
          <div>
            <label className="block font-medium mb-2">Layout Style</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "list", label: "List", description: "Simple vertical list" },
                { value: "timeline", label: "Timeline", description: "Hour-by-hour view" },
                { value: "blocks", label: "Blocks", description: "Time block cards" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setLayout(option.value as LayoutType)}
                  className={`p-3 rounded-md border text-left transition-colors ${
                    layout === option.value
                      ? "border-primary bg-primary/10"
                      : "border-input hover:bg-muted"
                  }`}
                >
                  <div className="font-medium text-sm">{option.label}</div>
                  <div className="text-xs text-muted-foreground">{option.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Display options */}
          <div className="space-y-3">
            <label className="block font-medium">Display Options</label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showLocation === true}
                onChange={(e) => setShowLocation(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Show event location</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showDescription === true}
                onChange={(e) => setShowDescription(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Show event description</span>
            </label>
          </div>

          {/* Custom sections */}
          <div>
            <label className="block font-medium mb-2">Custom Sections</label>
            <p className="text-sm text-muted-foreground mb-2">
              Add custom sections above or below the agenda
            </p>

            {customSections.length > 0 && (
              <div className="space-y-2 mb-3">
                {customSections.map((section, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 bg-muted rounded">
                        {section.position}
                      </span>
                      <span className="text-sm">{section.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSection(index)}
                      className="p-1 hover:bg-muted rounded text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                className="flex-1 px-3 py-1.5 border border-input rounded-md bg-background text-sm"
                placeholder="Section name..."
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addSection("top")}
                disabled={!newSectionName.trim()}
              >
                + Top
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addSection("bottom")}
                disabled={!newSectionName.trim()}
              >
                + Bottom
              </Button>
            </div>
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
