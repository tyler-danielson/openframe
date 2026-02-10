import { SectionTitle, type EditableWidgetProps } from "./types";

export function EditableHabits({ widget, isSelected, onSelect, onConfigChange, colors }: EditableWidgetProps) {
  const config = widget.config;
  const title = (config.title as string) || "Self-Care";
  const habits = (config.habits as string[]) || ["Habit 1", "Habit 2", "Habit 3"];
  const columns = (config.columns as number) || 2;
  const showLabels = config.showLabels === true;

  // Get or initialize habit completion state
  const completedHabits = (config.completedHabits as Record<number, boolean>) || {};

  const handleToggleHabit = (index: number) => {
    const newCompleted = { ...completedHabits, [index]: !completedHabits[index] };
    onConfigChange({ ...config, completedHabits: newCompleted });
  };

  return (
    <div
      style={{
        padding: "12px 14px",
        height: "100%",
        fontFamily: "'DM Sans', sans-serif",
        color: colors.ink,
      }}
      onClick={onSelect}
    >
      <SectionTitle colors={colors}>{title}</SectionTitle>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: showLabels ? 6 : 4,
        }}
      >
        {habits.slice(0, 10).map((habit, i) =>
          showLabels ? (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                handleToggleHabit(i);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 6px",
                borderRadius: 6,
                border: `1px solid ${completedHabits[i] ? colors.checkGreen : colors.ruleLineLight}`,
                backgroundColor: completedHabits[i] ? `${colors.checkGreen}15` : "transparent",
                color: completedHabits[i] ? colors.checkGreen : colors.inkLight,
                fontSize: 11,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <span style={{ fontSize: 14 }}>{getHabitIcon(habit)}</span>
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                  textAlign: "left",
                }}
              >
                {habit}
              </span>
            </button>
          ) : (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                handleToggleHabit(i);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                borderRadius: 8,
                border: `1px solid ${completedHabits[i] ? colors.checkGreen : colors.ruleLineLight}`,
                backgroundColor: completedHabits[i] ? `${colors.checkGreen}15` : "transparent",
                color: completedHabits[i] ? colors.checkGreen : colors.inkLight,
                fontSize: 17,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              title={habit}
            >
              {getHabitIcon(habit)}
            </button>
          )
        )}
      </div>
    </div>
  );
}

// Get emoji icon for habit name
function getHabitIcon(habit: string): string {
  const lower = habit.toLowerCase();
  if (lower.includes("water") || lower.includes("hydra")) return "💧";
  if (lower.includes("food") || lower.includes("nutri") || lower.includes("eat")) return "🍎";
  if (lower.includes("move") || lower.includes("exercise") || lower.includes("walk")) return "🚶";
  if (lower.includes("sleep") || lower.includes("rest")) return "😴";
  if (lower.includes("sun") || lower.includes("outside")) return "☀️";
  if (lower.includes("mind") || lower.includes("meditat")) return "🧘";
  if (lower.includes("social") || lower.includes("friend")) return "👥";
  if (lower.includes("creat") || lower.includes("art")) return "🎨";
  if (lower.includes("screen") || lower.includes("break")) return "📵";
  if (lower.includes("caffeine") || lower.includes("coffee")) return "☕";
  return "✓";
}
