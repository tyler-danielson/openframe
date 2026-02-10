import { SectionTitle, type EditableWidgetProps } from "./types";

export function EditableWeather({ widget, isSelected, onSelect, colors }: EditableWidgetProps) {
  const config = widget.config;
  const title = (config.title as string) || "Weather";

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
      <SectionTitle colors={colors}>{title}</SectionTitle>
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: colors.inkFaint,
          fontSize: 13,
        }}
      >
        <span style={{ fontSize: 24, marginRight: 8 }}>🌤️</span>
        Weather forecast will appear here
      </div>
    </div>
  );
}
