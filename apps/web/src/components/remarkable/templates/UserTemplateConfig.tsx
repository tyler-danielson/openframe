import { useState, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { X, Loader2, Save, Upload, FileText, Plus, Trash2, MousePointer } from "lucide-react";
import { api, type RemarkableTemplate, type RemarkableMergeField } from "../../../services/api";
import { Button } from "../../ui/Button";

interface UserTemplateConfigProps {
  template?: RemarkableTemplate;
  onClose: () => void;
  onSave: () => void;
}

type MergeFieldType = "date" | "events" | "weather" | "text" | "custom";

const FIELD_TYPES: { value: MergeFieldType; label: string; description: string }[] = [
  { value: "date", label: "Date", description: "Current date (customizable format)" },
  { value: "events", label: "Events", description: "List of calendar events" },
  { value: "weather", label: "Weather", description: "Current weather conditions" },
  { value: "text", label: "Static Text", description: "Fixed text content" },
  { value: "custom", label: "Custom", description: "Custom content field" },
];

export function UserTemplateConfig({
  template,
  onClose,
  onSave,
}: UserTemplateConfigProps) {
  const isEditing = !!template;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(template?.name || "Custom PDF Template");
  const [folderPath, setFolderPath] = useState(template?.folderPath || "/Calendar/Custom");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [mergeFields, setMergeFields] = useState<RemarkableMergeField[]>(
    template?.mergeFields || []
  );
  const [pdfDimensions, setPdfDimensions] = useState<{ width: number; height: number } | null>(
    null
  );

  // For adding new fields
  const [showAddField, setShowAddField] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<MergeFieldType>("date");
  const [newFieldFormat, setNewFieldFormat] = useState("");

  // Create/Update template
  const saveTemplate = useMutation({
    mutationFn: async () => {
      if (isEditing && template) {
        return api.updateRemarkableTemplate(template.id, {
          name,
          folderPath,
          mergeFields,
        });
      } else {
        const created = await api.createRemarkableTemplate({
          name,
          templateType: "user_designed",
          folderPath,
          config: {},
        });

        // Upload PDF if provided
        if (pdfFile) {
          const base64 = await fileToBase64(pdfFile);
          await api.uploadRemarkablePdfTemplate(created.id, base64);
        }

        // Update merge fields
        if (mergeFields.length > 0) {
          await api.updateRemarkableTemplate(created.id, { mergeFields });
        }

        return created;
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Please select a PDF file");
      return;
    }

    setPdfFile(file);
    setPdfPreviewUrl(URL.createObjectURL(file));

    // Get PDF dimensions (mock for now - would need pdf-lib in browser)
    setPdfDimensions({ width: 612, height: 792 }); // Letter size
  };

  const addMergeField = () => {
    if (!newFieldName.trim()) return;

    const newField: RemarkableMergeField = {
      name: newFieldName.trim(),
      type: newFieldType,
      x: 50,
      y: 50,
      fontSize: 12,
      format: newFieldFormat || undefined,
    };

    setMergeFields([...mergeFields, newField]);
    setNewFieldName("");
    setNewFieldFormat("");
    setShowAddField(false);
  };

  const updateField = (index: number, updates: Partial<RemarkableMergeField>) => {
    const updated = [...mergeFields];
    const existing = updated[index];
    if (existing) {
      updated[index] = { ...existing, ...updates };
      setMergeFields(updated);
    }
  };

  const removeField = (index: number) => {
    setMergeFields(mergeFields.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {isEditing ? "Edit Custom PDF Template" : "Create Custom PDF Template"}
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
              placeholder="My Custom Template"
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
              placeholder="/Calendar/Custom"
            />
          </div>

          {/* PDF Upload */}
          <div>
            <label className="block font-medium mb-2">PDF Template</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="hidden"
            />

            {pdfPreviewUrl || template?.hasPdfTemplate ? (
              <div className="border border-input rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium">
                      {pdfFile?.name || "Template uploaded"}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Replace
                  </Button>
                </div>
                {pdfDimensions && (
                  <div className="text-xs text-muted-foreground">
                    Dimensions: {pdfDimensions.width} x {pdfDimensions.height} pt
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-input rounded-lg p-8 hover:border-primary/50 transition-colors text-center"
              >
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Click to upload PDF</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Your PDF will be used as a background template
                </p>
              </button>
            )}
          </div>

          {/* Merge Fields */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-medium">Merge Fields</label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAddField(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Field
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Define where dynamic content should be placed on your template
            </p>

            {mergeFields.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-input rounded-lg">
                <MousePointer className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No merge fields defined</p>
              </div>
            ) : (
              <div className="space-y-2">
                {mergeFields.map((field, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex-1 grid grid-cols-4 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground">Name</label>
                        <input
                          type="text"
                          value={field.name}
                          onChange={(e) => updateField(index, { name: e.target.value })}
                          className="w-full px-2 py-1 border border-input rounded text-sm bg-background"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Type</label>
                        <select
                          value={field.type}
                          onChange={(e) => updateField(index, { type: e.target.value as MergeFieldType })}
                          className="w-full px-2 py-1 border border-input rounded text-sm bg-background"
                        >
                          {FIELD_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">X, Y</label>
                        <div className="flex gap-1">
                          <input
                            type="number"
                            value={field.x}
                            onChange={(e) => updateField(index, { x: Number(e.target.value) })}
                            className="w-full px-2 py-1 border border-input rounded text-sm bg-background"
                            min="0"
                          />
                          <input
                            type="number"
                            value={field.y}
                            onChange={(e) => updateField(index, { y: Number(e.target.value) })}
                            className="w-full px-2 py-1 border border-input rounded text-sm bg-background"
                            min="0"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Font Size</label>
                        <input
                          type="number"
                          value={field.fontSize || 12}
                          onChange={(e) => updateField(index, { fontSize: Number(e.target.value) })}
                          className="w-full px-2 py-1 border border-input rounded text-sm bg-background"
                          min="6"
                          max="72"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeField(index)}
                      className="p-1.5 hover:bg-muted rounded text-destructive shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Field Modal */}
          {showAddField && (
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50">
              <div className="bg-background rounded-lg shadow-xl max-w-sm w-full mx-4 p-4">
                <h3 className="font-semibold mb-4">Add Merge Field</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Field Name</label>
                    <input
                      type="text"
                      value={newFieldName}
                      onChange={(e) => setNewFieldName(e.target.value)}
                      className="w-full px-3 py-2 border border-input rounded-md bg-background"
                      placeholder="e.g., title, date, notes"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Field Type</label>
                    <select
                      value={newFieldType}
                      onChange={(e) => setNewFieldType(e.target.value as MergeFieldType)}
                      className="w-full px-3 py-2 border border-input rounded-md bg-background"
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label} - {t.description}
                        </option>
                      ))}
                    </select>
                  </div>
                  {(newFieldType === "date" || newFieldType === "text") && (
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        {newFieldType === "date" ? "Date Format" : "Text Content"}
                      </label>
                      <input
                        type="text"
                        value={newFieldFormat}
                        onChange={(e) => setNewFieldFormat(e.target.value)}
                        className="w-full px-3 py-2 border border-input rounded-md bg-background"
                        placeholder={newFieldType === "date" ? "MMMM d, yyyy" : "Static text..."}
                      />
                    </div>
                  )}
                </div>
                <div className="flex gap-2 mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddField(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={addMergeField}
                    className="flex-1"
                    disabled={!newFieldName.trim()}
                  >
                    Add Field
                  </Button>
                </div>
              </div>
            </div>
          )}

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

// Helper function to convert File to base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix
      const base64 = result.split(",")[1] ?? "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
