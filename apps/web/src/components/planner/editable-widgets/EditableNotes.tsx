import { SectionTitle, type EditableWidgetProps } from "./types";

export function EditableNotes({ widget, isSelected, onSelect, onConfigChange, colors }: EditableWidgetProps) {
  const config = widget.config;
  const title = (config.title as string) || "";
  const lineStyle = (config.lineStyle as string) || "ruled";
  const lineSpacing = (config.lineSpacing as number) || 20;
  const noteContent = (config.noteContent as string) || "";

  const handleChange = (value: string) => {
    onConfigChange({ ...config, noteContent: value });
  };

  // Background pattern for different line styles
  const getBackgroundStyle = () => {
    switch (lineStyle) {
      case "dotted":
        return {
          background: `radial-gradient(circle, ${colors.ruleLineLight} 1px, transparent 1px)`,
          backgroundSize: `${lineSpacing}px ${lineSpacing}px`,
        };
      case "grid":
        return {
          background: `linear-gradient(to right, ${colors.ruleLineLight} 1px, transparent 1px), linear-gradient(to bottom, ${colors.ruleLineLight} 1px, transparent 1px)`,
          backgroundSize: `${lineSpacing}px ${lineSpacing}px`,
        };
      case "ruled":
        return {
          background: `repeating-linear-gradient(
            to bottom,
            transparent,
            transparent ${lineSpacing - 1}px,
            ${colors.ruleLineLight} ${lineSpacing - 1}px,
            ${colors.ruleLineLight} ${lineSpacing}px
          )`,
        };
      default:
        return {};
    }
  };

  return (
    <div
      style={{
        padding: "12px 14px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'DM Sans', sans-serif",
        color: colors.ink,
      }}
      onClick={onSelect}
    >
      {title && <SectionTitle colors={colors}>{title}</SectionTitle>}
      <div
        style={{
          flex: 1,
          position: "relative",
          ...getBackgroundStyle(),
        }}
      >
        <textarea
          value={noteContent}
          onChange={(e) => handleChange(e.target.value)}
          placeholder=""
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            outline: "none",
            background: "transparent",
            resize: "none",
            fontSize: 12,
            fontFamily: "'DM Sans', sans-serif",
            color: colors.ink,
            lineHeight: `${lineSpacing}px`,
            padding: 0,
          }}
        />
      </div>
    </div>
  );
}
