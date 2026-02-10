import type { PlannerWidgetInstance } from "@openframe/shared";

export interface EditableWidgetProps {
  widget: PlannerWidgetInstance;
  isSelected: boolean;
  onSelect: () => void;
  onConfigChange: (config: Record<string, unknown>) => void;
  colors: typeof plannerColors;
}

// Color scheme matching the reference planner (from PlannerPreview)
export const plannerColors = {
  paper: "#f5f2ed",
  paperDark: "#ebe7e0",
  ink: "#2c2a27",
  inkLight: "#6b6761",
  inkFaint: "#a8a39c",
  ruleLine: "#d4cfc8",
  ruleLineLight: "#e4e0da",
  accent: "#5a7a8a",
  rewardBg: "#f0ece5",
  checkGreen: "#5a8a6a",
};

// Section title component for consistency
export function SectionTitle({ children, colors }: { children: React.ReactNode; colors: typeof plannerColors }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 2,
        textTransform: "uppercase",
        color: colors.inkLight,
        marginBottom: 8,
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {children}
      <span style={{ flex: 1, height: 1, backgroundColor: colors.ruleLine }} />
    </div>
  );
}
