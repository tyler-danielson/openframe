import { useDailyBriefing, useBriefingStatus } from "../../../hooks/useDailyBriefing";
import { SectionTitle, type EditableWidgetProps } from "./types";
import { Sparkles } from "lucide-react";

export function EditableBriefing({ widget, onSelect, colors }: EditableWidgetProps) {
  const config = widget.config;
  const title = (config.title as string) || "Daily Briefing";
  const showHighlights = (config.showHighlights as boolean) !== false;

  const { data: statusData } = useBriefingStatus();
  const { data: briefing, isLoading, error } = useDailyBriefing();

  // Check if configured
  const isConfigured = statusData?.configured;

  // Sample briefing for placeholder mode
  const sampleBriefing = {
    summary: "Good morning! You have a productive day ahead with 3 meetings and 2 tasks due. The weather looks pleasant for a midday walk.",
    highlights: [
      "Team standup at 9:00 AM",
      "Project review at 2:00 PM",
      "2 tasks due today",
      "Partly cloudy, 72°F",
    ],
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
      <SectionTitle colors={colors}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Sparkles size={12} style={{ opacity: 0.7 }} />
          {title}
        </span>
      </SectionTitle>

      {isLoading && (
        <div
          style={{
            padding: "12px 0",
            fontSize: 11,
            color: colors.inkFaint,
            textAlign: "center",
          }}
        >
          Generating briefing...
        </div>
      )}

      {error && !isLoading && (
        <div
          style={{
            padding: "12px 0",
            fontSize: 11,
            color: colors.inkFaint,
            textAlign: "center",
          }}
        >
          Unable to generate briefing
        </div>
      )}

      {/* Show real briefing when available */}
      {!isLoading && !error && briefing && (
        <>
          <div
            style={{
              fontSize: 12,
              lineHeight: 1.55,
              color: colors.inkLight,
              marginBottom: showHighlights ? 12 : 0,
            }}
          >
            {briefing.summary}
          </div>

          {showHighlights && briefing.highlights.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {briefing.highlights.map((highlight, i) => (
                <div
                  key={i}
                  style={{
                    padding: "4px 0",
                    paddingLeft: 12,
                    borderLeft: `2px solid ${colors.accent}`,
                    marginBottom: 6,
                    fontSize: 11,
                    lineHeight: 1.4,
                    color: colors.inkLight,
                  }}
                >
                  {highlight}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Placeholder mode when not configured */}
      {!isLoading && !error && !briefing && (
        <>
          <div
            style={{
              fontSize: 12,
              lineHeight: 1.55,
              color: colors.inkLight,
              marginBottom: showHighlights ? 12 : 0,
              fontStyle: isConfigured ? "normal" : "italic",
            }}
          >
            {sampleBriefing.summary}
          </div>

          {showHighlights && (
            <div style={{ marginTop: 8 }}>
              {sampleBriefing.highlights.map((highlight, i) => (
                <div
                  key={i}
                  style={{
                    padding: "4px 0",
                    paddingLeft: 12,
                    borderLeft: `2px solid ${colors.accent}`,
                    marginBottom: 6,
                    fontSize: 11,
                    lineHeight: 1.4,
                    color: colors.inkLight,
                  }}
                >
                  {highlight}
                </div>
              ))}
            </div>
          )}

          {!isConfigured && (
            <div
              style={{
                padding: "8px 0 4px",
                fontSize: 10,
                color: colors.inkFaint,
                textAlign: "center",
                fontStyle: "italic",
              }}
            >
              Configure Anthropic API key in Settings
            </div>
          )}
        </>
      )}
    </div>
  );
}
