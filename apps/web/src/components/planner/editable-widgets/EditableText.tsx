import { type EditableWidgetProps } from "./types";

export function EditableText({ widget, isSelected, onSelect, onConfigChange, colors }: EditableWidgetProps) {
  const config = widget.config;
  const configFontSize = (config.fontSize as string) || "lg";
  const configFontWeight = (config.fontWeight as string) || "bold";
  const configBackground = (config.background as string) || "none";
  const configBorder = (config.border as string) || "none";
  const configBorderRadius = (config.borderRadius as string) || "none";
  const configPadding = (config.padding as string) || "md";
  const configAlignment = (config.alignment as string) || "center";

  // Get raw text and format date placeholders for display
  const rawText = (config.text as string) || "";
  const displayText = formatDatePlaceholders(rawText);

  // Font size mapping
  const fontSizeMap: Record<string, number> = { sm: 12, base: 14, lg: 18, xl: 24, "2xl": 30 };
  const fontWeightMap: Record<string, number> = { normal: 400, medium: 500, semibold: 600, bold: 700 };
  const fontSize = fontSizeMap[configFontSize] || 18;
  const fontWeight = fontWeightMap[configFontWeight] || 700;

  // Background mapping
  const backgroundMap: Record<string, { bg: string; textColor: string }> = {
    none: { bg: "transparent", textColor: colors.inkLight },
    light: { bg: colors.ruleLineLight, textColor: colors.ink },
    accent: { bg: colors.accent, textColor: "white" },
    dark: { bg: colors.ink, textColor: colors.paper },
  };
  const bgStyle = backgroundMap[configBackground] ?? { bg: "transparent", textColor: colors.inkLight };
  const backgroundColor = bgStyle.bg;
  const textColor = bgStyle.textColor;

  // Border mapping
  const borderMap: Record<string, string> = {
    none: "none",
    solid: `2px solid ${colors.inkLight}`,
    dashed: `2px dashed ${colors.inkLight}`,
    double: `4px double ${colors.inkLight}`,
  };
  const border = borderMap[configBorder] || "none";

  // Border radius mapping
  const borderRadiusMap: Record<string, number | string> = {
    none: 0,
    sm: 4,
    md: 8,
    lg: 16,
    full: "9999px",
  };
  const borderRadius = borderRadiusMap[configBorderRadius] || 0;

  // Padding mapping
  const paddingMap: Record<string, number> = {
    none: 0,
    sm: 8,
    md: 16,
    lg: 24,
  };
  const padding = paddingMap[configPadding] || 16;

  // Alignment mapping
  const alignmentMap: Record<string, { justify: string; text: string }> = {
    left: { justify: "flex-start", text: "left" },
    center: { justify: "center", text: "center" },
    right: { justify: "flex-end", text: "right" },
  };
  const alignment = alignmentMap[configAlignment] ?? { justify: "center", text: "center" };

  const handleTextChange = (value: string) => {
    onConfigChange({ ...config, text: value });
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: alignment.justify,
        height: "100%",
        padding: 8,
        fontFamily: "'DM Sans', sans-serif",
      }}
      onClick={onSelect}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: alignment.justify,
          backgroundColor,
          border,
          borderRadius,
          padding,
          width: configBackground !== "none" || configBorder !== "none" ? "auto" : "100%",
          minWidth: configBackground !== "none" || configBorder !== "none" ? "auto" : undefined,
        }}
      >
        <span
          style={{
            textAlign: alignment.text as "left" | "center" | "right",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize,
            fontWeight,
            color: textColor,
            letterSpacing: 1,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          {displayText || "Enter text..."}
        </span>
      </div>
    </div>
  );
}

// Get ISO week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Format date placeholders for display
function formatDatePlaceholders(text: string): string {
  const now = new Date();
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayNamesShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthNamesShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const weekNumber = getWeekNumber(now);

  // Token replacements (order matters - longer tokens first)
  const tokens: [RegExp, string][] = [
    [/YYYY/g, now.getFullYear().toString()],
    [/YY/g, now.getFullYear().toString().slice(-2)],
    [/MMMM/g, monthNames[now.getMonth()] || "January"],
    [/MMM/g, monthNamesShort[now.getMonth()] || "Jan"],
    [/MM/g, (now.getMonth() + 1).toString().padStart(2, "0")],
    [/M/g, (now.getMonth() + 1).toString()],
    [/dddd/g, dayNames[now.getDay()] || "Sunday"],
    [/ddd/g, dayNamesShort[now.getDay()] || "Sun"],
    [/DD/g, now.getDate().toString().padStart(2, "0")],
    [/D/g, now.getDate().toString()],
    [/WW/g, weekNumber.toString().padStart(2, "0")],
    [/W/g, weekNumber.toString().padStart(2, "0")],
  ];

  // Replace all {{date:format}} placeholders
  return text.replace(/\{\{date:([^}]+)\}\}/g, (match, format) => {
    let result = format;
    for (const [pattern, replacement] of tokens) {
      result = result.replace(pattern, replacement);
    }
    return result;
  });
}
