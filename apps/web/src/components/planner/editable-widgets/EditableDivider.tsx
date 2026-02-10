import { type EditableWidgetProps } from "./types";

export function EditableDivider({ widget, isSelected, onSelect, colors }: EditableWidgetProps) {
  const config = widget.config;
  const style = (config.style as string) || "solid";
  const thickness = (config.thickness as number) || 1;

  const borderStyle = style === "dashed" ? "dashed" : style === "dotted" ? "dotted" : "solid";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        padding: "0 16px",
      }}
      onClick={onSelect}
    >
      <div
        style={{
          flex: 1,
          height: thickness * 2,
          borderTop: `${thickness}px ${borderStyle} ${colors.ruleLine}`,
        }}
      />
    </div>
  );
}
