import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Menu, MessageCircle } from "lucide-react";
import { ChatMessageList } from "../components/chat/ChatMessageList";
import { ChatInput } from "../components/chat/ChatInput";
import { ConversationList } from "../components/chat/ConversationList";
import { useChatStore } from "../stores/chat";
import { api } from "../services/api";
import { cn } from "../lib/utils";

export function ChatPage() {
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const setStreaming = useChatStore((s) => s.setStreaming);
  const addMessage = useChatStore((s) => s.addMessage);
  const setStreamingContent = useChatStore((s) => s.setStreamingContent);
  const appendStreamingContent = useChatStore((s) => s.appendStreamingContent);

  const handleSend = useCallback(
    async (message: string) => {
      const tempId = `temp-${Date.now()}`;
      addMessage({
        id: tempId,
        conversationId: activeConversationId || "",
        role: "user",
        content: message,
        provider: null,
        model: null,
        tokenUsage: null,
        createdAt: new Date().toISOString(),
      });

      setStreaming(true);
      setStreamingContent("");

      try {
        const response = await api.sendChatMessage({
          message,
          conversationId: activeConversationId || undefined,
        });

        const reader = response.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder();
        let buffer = "";
        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("event: ")) continue;
            if (!trimmed.startsWith("data: ")) continue;

            const dataStr = trimmed.slice(6);
            try {
              const data = JSON.parse(dataStr);

              if (data.conversationId && !activeConversationId) {
                setActiveConversation(data.conversationId);
              }

              if (data.token) {
                fullContent += data.token;
                appendStreamingContent(data.token);
              }

              if (data.messageId) {
                addMessage({
                  id: data.messageId,
                  conversationId: data.conversationId || activeConversationId || "",
                  role: "assistant",
                  content: fullContent,
                  provider: null,
                  model: null,
                  tokenUsage: null,
                  createdAt: new Date().toISOString(),
                });
                setStreamingContent("");
                queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
              }

              if (data.error) {
                console.error("Chat stream error:", data.error);
              }
            } catch {
              /* skip */
            }
          }
        }
      } catch (error) {
        console.error("Chat send error:", error);
      } finally {
        setStreaming(false);
      }
    },
    [
      activeConversationId,
      addMessage,
      setStreaming,
      setStreamingContent,
      appendStreamingContent,
      setActiveConversation,
      queryClient,
    ]
  );

  return (
    <div className="flex h-full">
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 right-4 z-30 p-2 rounded-lg bg-card border border-border"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-20 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Conversation sidebar */}
      <aside
        className={cn(
          "fixed lg:relative z-30 lg:z-auto h-full w-72 border-r border-border bg-card transform transition-transform lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <ConversationList onSelect={() => setSidebarOpen(false)} />
      </aside>

      {/* Main chat area */}
      <div className="flex flex-1 flex-col h-full min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <MessageCircle className="h-5 w-5 text-primary" />
          <h1 className="font-semibold text-foreground">Chat Assistant</h1>
        </div>

        {/* Messages */}
        <ChatMessageList />

        {/* Input */}
        <ChatInput onSend={handleSend} disabled={isStreaming} />
      </div>
    </div>
  );
}
