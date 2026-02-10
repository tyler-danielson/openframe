import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  CheckSquare,
  Layout,
  FileText,
  Plus,
  Trash2,
  Edit,
  Eye,
  Upload,
  Loader2,
  MoreVertical,
} from "lucide-react";
import { api, type RemarkableTemplate } from "../../services/api";
import { Button } from "../ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/Card";
import { WeeklyPlannerConfig } from "./templates/WeeklyPlannerConfig";
import { HabitTrackerConfig } from "./templates/HabitTrackerConfig";
import { CustomAgendaConfig } from "./templates/CustomAgendaConfig";
import { UserTemplateConfig } from "./templates/UserTemplateConfig";

const TEMPLATE_TYPES = [
  {
    type: "weekly_planner",
    name: "Weekly Planner",
    description: "7-day layout with events and notes",
    icon: Calendar,
  },
  {
    type: "habit_tracker",
    name: "Habit Tracker",
    description: "Monthly habit tracking grid",
    icon: CheckSquare,
  },
  {
    type: "custom_agenda",
    name: "Custom Agenda",
    description: "Customizable daily agenda layouts",
    icon: Layout,
  },
  {
    type: "user_designed",
    name: "Custom PDF",
    description: "Upload your own PDF template",
    icon: FileText,
  },
] as const;

type TemplateType = (typeof TEMPLATE_TYPES)[number]["type"];

interface TemplateManagerProps {
  onClose: () => void;
}

export function TemplateManager({ onClose }: TemplateManagerProps) {
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState<TemplateType | "all">("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTemplateType, setNewTemplateType] = useState<TemplateType | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<RemarkableTemplate | null>(null);
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);

  // Fetch templates
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["remarkable", "templates"],
    queryFn: () => api.getRemarkableTemplates(),
  });

  // Delete template
  const deleteTemplate = useMutation({
    mutationFn: (id: string) => api.deleteRemarkableTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["remarkable", "templates"] });
    },
  });

  // Push template
  const pushTemplate = useMutation({
    mutationFn: (id: string) => api.pushRemarkableTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["remarkable"] });
    },
  });

  const filteredTemplates =
    selectedTab === "all"
      ? templates
      : templates.filter((t) => t.templateType === selectedTab);

  const getTemplateIcon = (type: string) => {
    const templateType = TEMPLATE_TYPES.find((t) => t.type === type);
    return templateType?.icon || FileText;
  };

  const handleCreateTemplate = (type: TemplateType) => {
    setNewTemplateType(type);
    setShowCreateModal(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <div>
            <h2 className="text-lg font-semibold">Template Manager</h2>
            <p className="text-sm text-muted-foreground">
              Create and manage reMarkable templates
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              New Template
            </Button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-muted rounded-lg transition-colors"
            >
              <span className="sr-only">Close</span>
              &times;
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-4 shrink-0 overflow-x-auto">
          <button
            onClick={() => setSelectedTab("all")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              selectedTab === "all"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            All Templates
          </button>
          {TEMPLATE_TYPES.map((type) => {
            const Icon = type.icon;
            return (
              <button
                key={type.type}
                onClick={() => setSelectedTab(type.type)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                  selectedTab === type.type
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {type.name}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-3" />
              <p className="text-muted-foreground">No templates yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create a template to get started
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Create Template
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredTemplates.map((template) => {
                const Icon = getTemplateIcon(template.templateType);
                return (
                  <Card key={template.id} className="relative">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-muted rounded-lg">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <CardTitle className="text-base">
                              {template.name}
                            </CardTitle>
                            <CardDescription className="text-xs capitalize">
                              {template.templateType.replace("_", " ")}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setPreviewTemplateId(template.id)}
                            className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                            title="Preview"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setEditingTemplate(template)}
                            className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deleteTemplate.mutate(template.id)}
                            className="p-1.5 hover:bg-muted rounded-lg transition-colors text-destructive"
                            title="Delete"
                            disabled={deleteTemplate.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-xs text-muted-foreground mb-3">
                        <span className="font-mono">{template.folderPath}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => pushTemplate.mutate(template.id)}
                          disabled={pushTemplate.isPending}
                        >
                          {pushTemplate.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <Upload className="h-3 w-3 mr-1" />
                          )}
                          Push Now
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg shadow-xl max-w-md w-full mx-4 p-4">
            <h3 className="text-lg font-semibold mb-4">Choose Template Type</h3>
            <div className="space-y-2">
              {TEMPLATE_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.type}
                    onClick={() => handleCreateTemplate(type.type)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors text-left"
                  >
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{type.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {type.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Template Config Modals */}
      {newTemplateType === "weekly_planner" && (
        <WeeklyPlannerConfig
          onClose={() => setNewTemplateType(null)}
          onSave={() => {
            setNewTemplateType(null);
            queryClient.invalidateQueries({ queryKey: ["remarkable", "templates"] });
          }}
        />
      )}
      {newTemplateType === "habit_tracker" && (
        <HabitTrackerConfig
          onClose={() => setNewTemplateType(null)}
          onSave={() => {
            setNewTemplateType(null);
            queryClient.invalidateQueries({ queryKey: ["remarkable", "templates"] });
          }}
        />
      )}
      {newTemplateType === "custom_agenda" && (
        <CustomAgendaConfig
          onClose={() => setNewTemplateType(null)}
          onSave={() => {
            setNewTemplateType(null);
            queryClient.invalidateQueries({ queryKey: ["remarkable", "templates"] });
          }}
        />
      )}
      {newTemplateType === "user_designed" && (
        <UserTemplateConfig
          onClose={() => setNewTemplateType(null)}
          onSave={() => {
            setNewTemplateType(null);
            queryClient.invalidateQueries({ queryKey: ["remarkable", "templates"] });
          }}
        />
      )}

      {/* Edit modals */}
      {editingTemplate?.templateType === "weekly_planner" && (
        <WeeklyPlannerConfig
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSave={() => {
            setEditingTemplate(null);
            queryClient.invalidateQueries({ queryKey: ["remarkable", "templates"] });
          }}
        />
      )}
      {editingTemplate?.templateType === "habit_tracker" && (
        <HabitTrackerConfig
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSave={() => {
            setEditingTemplate(null);
            queryClient.invalidateQueries({ queryKey: ["remarkable", "templates"] });
          }}
        />
      )}
      {editingTemplate?.templateType === "custom_agenda" && (
        <CustomAgendaConfig
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSave={() => {
            setEditingTemplate(null);
            queryClient.invalidateQueries({ queryKey: ["remarkable", "templates"] });
          }}
        />
      )}
      {editingTemplate?.templateType === "user_designed" && (
        <UserTemplateConfig
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSave={() => {
            setEditingTemplate(null);
            queryClient.invalidateQueries({ queryKey: ["remarkable", "templates"] });
          }}
        />
      )}

      {/* Preview Modal */}
      {previewTemplateId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Template Preview</h3>
              <button
                onClick={() => setPreviewTemplateId(null)}
                className="p-1 hover:bg-muted rounded-lg"
              >
                &times;
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <iframe
                src={api.getRemarkableTemplatePreviewUrl(previewTemplateId)}
                className="w-full h-[70vh] border rounded-lg"
                title="Template Preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
