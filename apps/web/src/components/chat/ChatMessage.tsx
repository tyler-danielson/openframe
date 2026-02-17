import { useMemo } from "react";
import { Bot, User } from "lucide-react";
import { cn } from "../../lib/utils";

interface ChatMessageProps {
  role: "user" | "assistant" | "system";
  content: string;
  isStreaming?: boolean;
}

export function ChatMessage({ role, content, isStreaming }: ChatMessageProps) {
  const isUser = role === "user";

  // Simple markdown-to-html: bold, italic, code blocks, inline code, lists
  const formattedContent = useMemo(() => {
    if (!content) return "";

    let html = content
      // Code blocks
      .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre class="bg-muted rounded-md p-3 my-2 overflow-x-auto text-sm"><code>$2</code></pre>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-sm">$1</code>')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      // Italic
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      // Line breaks
      .replace(/\n/g, "<br />");

    return html;
  }, [content]);

  return (
    <div
      className={cn(
        "flex gap-3 py-3",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary/10 text-primary" : "bg-accent text-accent-foreground"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Message bubble */}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-accent text-accent-foreground"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div
            className="prose prose-sm dark:prose-invert max-w-none [&_pre]:my-2 [&_code]:text-inherit"
            dangerouslySetInnerHTML={{ __html: formattedContent }}
          />
        )}
        {isStreaming && (
          <span className="inline-block w-1.5 h-4 bg-current animate-pulse ml-0.5 align-text-bottom" />
        )}
      </div>
    </div>
  );
}
