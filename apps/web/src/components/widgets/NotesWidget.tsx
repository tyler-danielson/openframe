import type { WidgetStyle } from "../../stores/screensaver";
import { getFontSizeConfig } from "../../lib/font-size";
import { cn } from "../../lib/utils";

interface NotesWidgetProps {
  config: Record<string, unknown>;
  style?: WidgetStyle;
  isBuilder?: boolean;
}

export function NotesWidget({ config, style, isBuilder }: NotesWidgetProps) {
  const content = (config.content as string) || "";
  const showCheckboxes = config.showCheckboxes as boolean ?? false;
  const headerText = config.headerText as string;

  const { isCustom, customValue } = getFontSizeConfig(style);

  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0 && !isBuilder) {
    return null;
  }

  return (
    <div
      className="flex flex-col h-full rounded-lg bg-black/40 backdrop-blur-sm p-4 overflow-hidden"
      style={{
        color: style?.textColor || "#ffffff",
        ...(isCustom && customValue ? { fontSize: customValue } : {}),
      }}
    >
      {/* Header */}
      {headerText && (
        <div className="text-xs uppercase tracking-widest opacity-50 font-medium mb-3">
          {headerText}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {lines.length === 0 ? (
          <div className="text-sm opacity-40 italic">
            Add notes in the widget settings...
          </div>
        ) : (
          lines.map((line, i) => {
            // Parse markdown-style links: [text](url)
            const linkMatch = line.match(/^(.*?)\[([^\]]+)\]\(([^)]+)\)(.*)$/);
            // Parse checkbox: - [ ] or - [x]
            const checkMatch = line.match(/^-\s*\[([ xX])\]\s*(.*)$/);

            if (checkMatch) {
              const checked = (checkMatch[1] ?? "").toLowerCase() === "x";
              const text = checkMatch[2] ?? "";
              return (
                <div key={i} className="flex items-start gap-2.5">
                  <div className={cn(
                    "shrink-0 w-4 h-4 mt-0.5 rounded border-2 flex items-center justify-center",
                    checked ? "bg-primary/30 border-primary" : "border-white/30"
                  )}>
                    {checked && <span className="text-[10px] text-primary">✓</span>}
                  </div>
                  <span className={cn(
                    "text-sm leading-relaxed",
                    checked && "line-through opacity-50"
                  )}>
                    {renderLineContent(text)}
                  </span>
                </div>
              );
            }

            if (showCheckboxes) {
              return (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="shrink-0 w-4 h-4 mt-0.5 rounded border-2 border-white/30" />
                  <span className="text-sm leading-relaxed">{renderLineContent(line)}</span>
                </div>
              );
            }

            // Bullet point for lines starting with - or *
            const bulletMatch = line.match(/^[-*]\s+(.*)$/);
            if (bulletMatch) {
              return (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="shrink-0 text-primary mt-0.5">•</span>
                  <span className="text-sm leading-relaxed">{renderLineContent(bulletMatch[1] ?? "")}</span>
                </div>
              );
            }

            return (
              <div key={i} className="text-sm leading-relaxed">
                {renderLineContent(line)}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// Render inline links and badges
function renderLineContent(text: string): React.ReactNode {
  // Match [text](url) and date badges like 📅 or [date]
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch && linkMatch.index !== undefined) {
      // Text before link
      if (linkMatch.index > 0) {
        parts.push(<span key={key++}>{remaining.slice(0, linkMatch.index)}</span>);
      }
      // The link itself
      parts.push(
        <a
          key={key++}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:text-primary/80"
        >
          {linkMatch[1]}
        </a>
      );
      remaining = remaining.slice(linkMatch.index + linkMatch[0].length);
    } else {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }
  }

  return <>{parts}</>;
}
