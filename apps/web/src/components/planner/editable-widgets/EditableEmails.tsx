import { useEmailHighlights, useGmailStatus, formatEmailTime } from "../../../hooks/useEmailHighlights";
import { SectionTitle, type EditableWidgetProps } from "./types";
import { Mail, Circle } from "lucide-react";

export function EditableEmails({ widget, onSelect, colors }: EditableWidgetProps) {
  const config = widget.config;
  const title = (config.title as string) || "Email";
  const maxItems = (config.maxItems as number) || 5;
  const showSnippet = (config.showSnippet as boolean) || false;
  const showTime = (config.showTime as boolean) !== false;

  const { data: statusData } = useGmailStatus();
  const { data: emails = [], isLoading, error } = useEmailHighlights({ limit: maxItems });

  // Check if Gmail is connected
  const isConnected = statusData?.hasGmailScope;
  const hasEmails = emails.length > 0;

  // Sample emails for placeholder mode
  const sampleEmails = [
    { icon: "📧", from: "Team Lead", subject: "Project update for Q1", time: "2h ago", unread: true },
    { icon: "📬", from: "HR Department", subject: "Benefits enrollment reminder", time: "4h ago", unread: false },
    { icon: "📩", from: "Client Services", subject: "Meeting confirmed for Tuesday", time: "Yesterday", unread: false },
    { icon: "📨", from: "Newsletter", subject: "Weekly digest: Top stories", time: "Yesterday", unread: false },
    { icon: "📮", from: "IT Support", subject: "Password expiration notice", time: "2 days ago", unread: false },
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
      <SectionTitle colors={colors}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Mail size={12} style={{ opacity: 0.7 }} />
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
          Loading emails...
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
          Unable to load emails
        </div>
      )}

      {/* Show real emails when available */}
      {!isLoading && !error && hasEmails && (
        <>
          {emails.slice(0, maxItems).map((email) => {
            const timeAgo = formatEmailTime(email.receivedAt);
            return (
              <div
                key={email.id}
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
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                  }}
                >
                  {email.isUnread && (
                    <Circle
                      size={6}
                      fill={colors.accent}
                      color={colors.accent}
                      style={{ marginTop: 5, flexShrink: 0 }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          fontWeight: email.isUnread ? 600 : 500,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          flex: 1,
                        }}
                      >
                        {email.from}
                      </span>
                      {showTime && (
                        <span
                          style={{
                            fontSize: 10,
                            color: colors.inkFaint,
                            flexShrink: 0,
                          }}
                        >
                          {timeAgo}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontWeight: email.isUnread ? 500 : 400,
                        marginTop: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {email.subject}
                    </div>
                    {showSnippet && email.snippet && (
                      <div
                        style={{
                          fontSize: 10,
                          color: colors.inkFaint,
                          marginTop: 2,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "-webkit-box",
                          WebkitLineClamp: 1,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {email.snippet}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Placeholder mode when not connected */}
      {!isLoading && !error && !hasEmails && (
        <>
          {sampleEmails.slice(0, maxItems).map((email, i) => (
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
                {email.icon}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      fontWeight: email.unread ? 600 : 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                    }}
                  >
                    {email.from}
                  </span>
                  {showTime && (
                    <span style={{ fontSize: 10, color: colors.inkFaint, flexShrink: 0 }}>
                      {email.time}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontWeight: email.unread ? 500 : 400,
                    marginTop: 2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {email.subject}
                </div>
              </div>
            </div>
          ))}

          {!isConnected && (
            <div
              style={{
                padding: "8px 0 4px",
                fontSize: 10,
                color: colors.inkFaint,
                textAlign: "center",
                fontStyle: "italic",
              }}
            >
              Re-authenticate with Google to enable Gmail
            </div>
          )}
        </>
      )}
    </div>
  );
}
