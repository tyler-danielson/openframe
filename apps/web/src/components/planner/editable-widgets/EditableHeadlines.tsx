import { usePlannerHeadlines, formatHeadlineTime } from "../../../hooks/usePlannerHeadlines";
import { SectionTitle, type EditableWidgetProps } from "./types";

export function EditableHeadlines({ widget, onSelect, colors }: EditableWidgetProps) {
  const config = widget.config;
  const title = (config.title as string) || "Headlines";
  const maxItems = (config.maxItems as number) || 5;
  const showSource = (config.showSource as boolean) !== false;
  const showTime = (config.showTime as boolean) !== false;
  const categories = (config.categories as string[]) || [];

  const { data: headlines = [], isLoading, error } = usePlannerHeadlines({
    limit: maxItems,
    categories,
  });

  // Check if we have real headlines or need to show placeholder
  const hasHeadlines = headlines.length > 0;

  // Sample updates for placeholder mode
  const sampleUpdates = [
    { icon: "📰", label: "Headlines", text: "Top news stories will appear here" },
    { icon: "🌍", label: "World", text: "International news and events" },
    { icon: "💻", label: "Technology", text: "Tech updates and innovations" },
    { icon: "📈", label: "Business", text: "Market news and analysis" },
    { icon: "🎬", label: "Entertainment", text: "Movies, music, and more" },
  ];

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

      {isLoading && (
        <div
          style={{
            padding: "12px 0",
            fontSize: 11,
            color: colors.inkFaint,
            textAlign: "center",
          }}
        >
          Loading headlines...
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "12px 0",
            fontSize: 11,
            color: colors.inkFaint,
            textAlign: "center",
          }}
        >
          Unable to load headlines
        </div>
      )}

      {!isLoading && !error && !hasHeadlines && categories.length > 0 && (
        <div
          style={{
            padding: "12px 0",
            fontSize: 11,
            color: colors.inkFaint,
            textAlign: "center",
          }}
        >
          No headlines in selected categories
        </div>
      )}

      {!isLoading && !error && hasHeadlines && (
        <>
          {headlines.map((headline) => {
            const timeAgo = formatHeadlineTime(headline.publishedAt);
            return (
              <div
                key={headline.id}
                style={{
                  padding: "6px 0",
                  borderBottom: `1px solid ${colors.ruleLineLight}`,
                  fontSize: 12,
                  lineHeight: 1.45,
                  color: colors.inkLight,
                }}
              >
                <div
                  style={{
                    fontWeight: 500,
                    marginBottom: showSource || showTime ? 2 : 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {headline.title}
                </div>
                {(showSource || showTime) && (
                  <div
                    style={{
                      fontSize: 10,
                      color: colors.inkFaint,
                      display: "flex",
                      gap: 6,
                      alignItems: "center",
                    }}
                  >
                    {showSource && headline.feedName && (
                      <span>{headline.feedName}</span>
                    )}
                    {showSource && showTime && timeAgo && (
                      <span style={{ opacity: 0.6 }}>·</span>
                    )}
                    {showTime && timeAgo && <span>{timeAgo}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* Placeholder mode when no feeds configured */}
      {!isLoading && !error && !hasHeadlines && categories.length === 0 && (
        <>
          {sampleUpdates.slice(0, maxItems).map((update, i) => (
            <div
              key={i}
              style={{
                padding: "6px 0",
                borderBottom: `1px solid ${colors.ruleLineLight}`,
                fontSize: 12,
                lineHeight: 1.45,
                color: colors.inkLight,
                display: "flex",
                gap: 8,
                alignItems: "flex-start",
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  width: 20,
                  textAlign: "center",
                  fontSize: 13,
                  paddingTop: 1,
                }}
              >
                {update.icon}
              </span>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    color: colors.inkFaint,
                    marginBottom: 2,
                  }}
                >
                  {update.label}
                </div>
                <span>{update.text}</span>
              </div>
            </div>
          ))}
          <div
            style={{
              padding: "8px 0 4px",
              fontSize: 10,
              color: colors.inkFaint,
              textAlign: "center",
              fontStyle: "italic",
            }}
          >
            Configure news feeds in Settings
          </div>
        </>
      )}
    </div>
  );
}
