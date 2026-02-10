import { X, Trash2 } from "lucide-react";
import type { PlannerWidgetInstance } from "@openframe/shared";
import { Button } from "../ui/Button";
import { PLANNER_WIDGET_REGISTRY } from "../../lib/planner/widget-registry";
import { CalendarMultiSelect } from "./CalendarMultiSelect";
import { TaskListMultiSelect } from "./TaskListMultiSelect";
import { NewsFeedCategoryMultiSelect } from "./NewsFeedCategoryMultiSelect";

interface WidgetConfigPopoverProps {
  widget: PlannerWidgetInstance;
  position: { x: number; y: number };
  onUpdate: (updates: Partial<PlannerWidgetInstance>) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function WidgetConfigPopover({
  widget,
  position,
  onUpdate,
  onDelete,
  onClose,
}: WidgetConfigPopoverProps) {
  const definition = PLANNER_WIDGET_REGISTRY[widget.type];

  const updateConfig = (key: string, value: unknown) => {
    onUpdate({ config: { ...widget.config, [key]: value } });
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Popover */}
      <div
        className="fixed z-50 w-72 bg-card border border-border rounded-lg shadow-lg overflow-hidden"
        style={{
          left: Math.min(position.x, window.innerWidth - 300),
          top: Math.min(position.y, window.innerHeight - 400),
        }}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="font-medium text-sm capitalize">
            {definition?.name || widget.type.replace("-", " ")}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={onDelete}
              className="p-1 hover:bg-destructive/10 rounded text-destructive"
              title="Delete widget"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button onClick={onClose} className="p-1 hover:bg-muted rounded">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-3 max-h-80 overflow-auto space-y-3">
          {/* Type-specific config */}
          {widget.type === "text" && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-medium">Text</label>
                <input
                  type="text"
                  value={(widget.config.text as string) || ""}
                  onChange={(e) => updateConfig("text", e.target.value)}
                  placeholder="Enter text..."
                  className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm"
                />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Use date tokens in placeholders:</p>
                  <ul className="list-none space-y-0.5 text-[10px] font-mono bg-muted/50 rounded p-1.5">
                    <li><code>W/WW</code> → 06 (week number)</li>
                    <li><code>D</code> → 9 | <code>DD</code> → 09 (day)</li>
                    <li><code>M</code> → 2 | <code>MM</code> → 02 (month)</li>
                    <li><code>MMM</code> → Feb | <code>MMMM</code> → February</li>
                    <li><code>YY</code> → 26 | <code>YYYY</code> → 2026</li>
                    <li><code>ddd</code> → Mon | <code>dddd</code> → Monday</li>
                  </ul>
                  <p className="text-[10px]">Combine tokens: <code>{"{{date:W MMMM YYYY}}"}</code> → 06 February 2026</p>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Font Size</label>
                <select
                  value={(widget.config.fontSize as string) || "lg"}
                  onChange={(e) => updateConfig("fontSize", e.target.value)}
                  className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm"
                >
                  <option value="sm">Small</option>
                  <option value="base">Normal</option>
                  <option value="lg">Large</option>
                  <option value="xl">X-Large</option>
                  <option value="2xl">2X-Large</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Alignment</label>
                <select
                  value={(widget.config.alignment as string) || "center"}
                  onChange={(e) => updateConfig("alignment", e.target.value)}
                  className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm"
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Background</label>
                <select
                  value={(widget.config.background as string) || "none"}
                  onChange={(e) => updateConfig("background", e.target.value)}
                  className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm"
                >
                  <option value="none">None</option>
                  <option value="light">Light Gray</option>
                  <option value="accent">Accent Color</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Border</label>
                <select
                  value={(widget.config.border as string) || "none"}
                  onChange={(e) => updateConfig("border", e.target.value)}
                  className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm"
                >
                  <option value="none">None</option>
                  <option value="solid">Solid</option>
                  <option value="dashed">Dashed</option>
                  <option value="double">Double</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Border Radius</label>
                <select
                  value={(widget.config.borderRadius as string) || "none"}
                  onChange={(e) => updateConfig("borderRadius", e.target.value)}
                  className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm"
                >
                  <option value="none">None</option>
                  <option value="sm">Small</option>
                  <option value="md">Medium</option>
                  <option value="lg">Large</option>
                  <option value="full">Pill</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Padding</label>
                <select
                  value={(widget.config.padding as string) || "md"}
                  onChange={(e) => updateConfig("padding", e.target.value)}
                  className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm"
                >
                  <option value="none">None</option>
                  <option value="sm">Small</option>
                  <option value="md">Medium</option>
                  <option value="lg">Large</option>
                </select>
              </div>
            </>
          )}

          {widget.type === "notes" && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-medium">Title</label>
                <input
                  type="text"
                  value={(widget.config.title as string) || "Notes"}
                  onChange={(e) => updateConfig("title", e.target.value)}
                  placeholder="Brain Dump, Ideas, etc."
                  className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Line Style</label>
                <select
                  value={(widget.config.lineStyle as string) || "ruled"}
                  onChange={(e) => updateConfig("lineStyle", e.target.value)}
                  className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm"
                >
                  <option value="ruled">Ruled</option>
                  <option value="dotted">Dotted</option>
                  <option value="grid">Grid</option>
                  <option value="blank">Blank</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  Background pattern for the note area
                </p>
              </div>
            </>
          )}

          {widget.type === "tasks" && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-medium">Title</label>
                <input
                  type="text"
                  value={(widget.config.title as string) || "Tasks"}
                  onChange={(e) => updateConfig("title", e.target.value)}
                  placeholder="Tasks, To-Do, Priorities, etc."
                  className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Max Items</label>
                <input
                  type="number"
                  value={(widget.config.maxItems as number) || 10}
                  onChange={(e) => updateConfig("maxItems", parseInt(e.target.value) || 10)}
                  min={1}
                  max={50}
                  className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Number of task lines to display
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showCheckboxes"
                  checked={(widget.config.showCheckboxes as boolean) !== false}
                  onChange={(e) => updateConfig("showCheckboxes", e.target.checked)}
                  className="rounded border-border"
                />
                <label htmlFor="showCheckboxes" className="text-xs">
                  Show checkboxes
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showDueDate"
                  checked={(widget.config.showDueDate as boolean) !== false}
                  onChange={(e) => updateConfig("showDueDate", e.target.checked)}
                  className="rounded border-border"
                />
                <label htmlFor="showDueDate" className="text-xs">
                  Show due dates
                </label>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Task Lists</label>
                <TaskListMultiSelect
                  selectedIds={(widget.config.taskListIds as string[]) || []}
                  onChange={(ids) => updateConfig("taskListIds", ids)}
                />
                <p className="text-xs text-muted-foreground">
                  Select lists to show synced tasks, or leave empty for manual entry
                </p>
              </div>
            </>
          )}

          {widget.type === "calendar-day" && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-medium">Title</label>
                <input
                  type="text"
                  value={(widget.config.title as string) || "Schedule"}
                  onChange={(e) => updateConfig("title", e.target.value)}
                  placeholder="Schedule, Today, etc."
                  className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Start Hour</label>
                  <input
                    type="number"
                    value={(widget.config.startHour as number) ?? 6}
                    onChange={(e) => updateConfig("startHour", parseInt(e.target.value) || 0)}
                    min={0}
                    max={23}
                    className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">End Hour</label>
                  <input
                    type="number"
                    value={(widget.config.endHour as number) ?? 22}
                    onChange={(e) => updateConfig("endHour", parseInt(e.target.value) || 24)}
                    min={1}
                    max={24}
                    className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                24-hour format (e.g., 6 = 6am, 22 = 10pm)
              </p>
              <div className="space-y-1">
                <label className="text-xs font-medium">Calendars</label>
                <CalendarMultiSelect
                  selectedIds={(widget.config.calendarIds as string[]) || []}
                  onChange={(ids) => updateConfig("calendarIds", ids)}
                />
              </div>
            </>
          )}

          {widget.type === "habits" && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-medium">Title</label>
                <input
                  type="text"
                  value={(widget.config.title as string) || "Self-Care"}
                  onChange={(e) => updateConfig("title", e.target.value)}
                  placeholder="Self-Care, Habits, etc."
                  className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Habits (one per line)</label>
                <textarea
                  value={((widget.config.habits as string[]) || []).join("\n")}
                  onChange={(e) =>
                    updateConfig(
                      "habits",
                      e.target.value.split("\n").filter(Boolean)
                    )
                  }
                  rows={4}
                  placeholder={"Exercise\nMeditate\nRead"}
                  className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Use emoji or text: 🚶 Exercise, 🧘 Meditate
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showLabels"
                  checked={(widget.config.showLabels as boolean) === true}
                  onChange={(e) => updateConfig("showLabels", e.target.checked)}
                  className="rounded border-border"
                />
                <label htmlFor="showLabels" className="text-xs">
                  Show text labels
                </label>
              </div>
            </>
          )}

          {widget.type === "news-headlines" && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-medium">Title</label>
                <input
                  type="text"
                  value={(widget.config.title as string) || "Headlines"}
                  onChange={(e) => updateConfig("title", e.target.value)}
                  className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Max Items</label>
                <input
                  type="number"
                  value={(widget.config.maxItems as number) || 5}
                  onChange={(e) => updateConfig("maxItems", parseInt(e.target.value) || 5)}
                  min={1}
                  max={20}
                  className="w-full px-2 py-1 border border-border rounded-md bg-background text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showSource"
                  checked={(widget.config.showSource as boolean) !== false}
                  onChange={(e) => updateConfig("showSource", e.target.checked)}
                  className="rounded border-border"
                />
                <label htmlFor="showSource" className="text-xs">
                  Show source name
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showTime"
                  checked={(widget.config.showTime as boolean) !== false}
                  onChange={(e) => updateConfig("showTime", e.target.checked)}
                  className="rounded border-border"
                />
                <label htmlFor="showTime" className="text-xs">
                  Show time ago
                </label>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Categories</label>
                <NewsFeedCategoryMultiSelect
                  selectedCategories={(widget.config.categories as string[]) || []}
                  onChange={(categories) => updateConfig("categories", categories)}
                />
                <p className="text-xs text-muted-foreground">
                  Filter by category or leave empty for all
                </p>
              </div>
            </>
          )}

          {/* Delete button at bottom */}
          <div className="pt-2 border-t border-border">
            <Button
              variant="destructive"
              size="sm"
              onClick={onDelete}
              className="w-full"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Widget
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
