import type { PlannerWidgetType, PlannerWidgetInstance } from "@openframe/shared";
import { EditableSchedule } from "./EditableSchedule";
import { EditableTasks } from "./EditableTasks";
import { EditableNotes } from "./EditableNotes";
import { EditableText } from "./EditableText";
import { EditableHabits } from "./EditableHabits";
import { EditableHeadlines } from "./EditableHeadlines";
import { EditableWeather } from "./EditableWeather";
import { EditableDivider } from "./EditableDivider";
import { EditableBriefing } from "./EditableBriefing";
import { EditableEmails } from "./EditableEmails";
import { plannerColors, type EditableWidgetProps } from "./types";

export { plannerColors };
export type { EditableWidgetProps };

// Map widget types to their editable components
type EditableWidgetComponent = React.ComponentType<EditableWidgetProps>;

const EDITABLE_WIDGET_REGISTRY: Record<PlannerWidgetType, EditableWidgetComponent> = {
  "calendar-day": EditableSchedule,
  "calendar-week": EditableSchedule, // Use schedule for now
  "calendar-month": EditableSchedule, // Use schedule for now
  tasks: EditableTasks,
  "news-headlines": EditableHeadlines,
  weather: EditableWeather,
  notes: EditableNotes,
  text: EditableText,
  divider: EditableDivider,
  habits: EditableHabits,
  "ai-briefing": EditableBriefing,
  "email-highlights": EditableEmails,
};

export function getEditableWidgetComponent(type: PlannerWidgetType): EditableWidgetComponent {
  return EDITABLE_WIDGET_REGISTRY[type];
}

export function renderEditableWidget(
  widget: PlannerWidgetInstance,
  isSelected: boolean,
  onSelect: () => void,
  onConfigChange: (config: Record<string, unknown>) => void
): React.ReactNode {
  const Component = getEditableWidgetComponent(widget.type);
  return (
    <Component
      widget={widget}
      isSelected={isSelected}
      onSelect={onSelect}
      onConfigChange={onConfigChange}
      colors={plannerColors}
    />
  );
}

// Re-export individual components for direct use
export { EditableSchedule } from "./EditableSchedule";
export { EditableTasks } from "./EditableTasks";
export { EditableNotes } from "./EditableNotes";
export { EditableText } from "./EditableText";
export { EditableHabits } from "./EditableHabits";
export { EditableHeadlines } from "./EditableHeadlines";
export { EditableWeather } from "./EditableWeather";
export { EditableDivider } from "./EditableDivider";
export { EditableBriefing } from "./EditableBriefing";
export { EditableEmails } from "./EditableEmails";
