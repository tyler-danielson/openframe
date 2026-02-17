import { useEffect, useRef } from "react";
import { ChatMessage } from "./ChatMessage";
import { useChatStore } from "../../stores/chat";
import { Loader2 } from "lucide-react";

export function ChatMessageList() {
  const messages = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const streamingContent = useChatStore((s) => s.streamingContent);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages or streaming content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center">
        <div className="space-y-2">
          <p className="text-lg font-medium text-primary">
            Ask me anything
          </p>
          <p className="text-sm text-muted-foreground max-w-xs">
            I can help with your schedule, tasks, weather, sports scores, news,
            and smart home.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
      {messages.map((msg) => (
        <ChatMessage key={msg.id} role={msg.role} content={msg.content} />
      ))}

      {/* Streaming assistant message */}
      {isStreaming && streamingContent && (
        <ChatMessage role="assistant" content={streamingContent} isStreaming />
      )}

      {/* Loading indicator when streaming hasn't started yet */}
      {isStreaming && !streamingContent && (
        <div className="flex gap-3 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
          <div className="flex items-center">
            <span className="text-sm text-muted-foreground">Thinking...</span>
          </div>
        </div>
      )}
    </div>
  );
}
