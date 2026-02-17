import { useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Minimize2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useChatStore } from "../../stores/chat";
import { api } from "../../services/api";
import { ChatMessageList } from "./ChatMessageList";
import { ChatInput } from "./ChatInput";
import { cn } from "../../lib/utils";

export function ChatDrawer() {
  const queryClient = useQueryClient();
  const isDrawerOpen = useChatStore((s) => s.isDrawerOpen);
  const toggleDrawer = useChatStore((s) => s.toggleDrawer);
  const setDrawerOpen = useChatStore((s) => s.setDrawerOpen);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const setStreaming = useChatStore((s) => s.setStreaming);
  const addMessage = useChatStore((s) => s.addMessage);
  const setStreamingContent = useChatStore((s) => s.setStreamingContent);
  const appendStreamingContent = useChatStore((s) => s.appendStreamingContent);

  const handleSend = useCallback(
    async (message: string) => {
      // Optimistically add user message
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
            if (trimmed.startsWith("event: ")) {
              // Store event type for next data line
              continue;
            }
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
                // Stream complete — add final message and clear streaming
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
              /* skip malformed JSON */
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
    <>
      {/* FAB button */}
      <button
        onClick={toggleDrawer}
        className={cn(
          "fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all",
          "bg-primary text-primary-foreground hover:bg-primary/90",
          isDrawerOpen && "scale-0 opacity-0"
        )}
        title="Chat assistant"
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      {/* Drawer panel */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            {/* Backdrop on mobile */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/30 lg:hidden"
              onClick={() => setDrawerOpen(false)}
            />

            {/* Drawer */}
            <motion.div
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className={cn(
                "fixed right-0 top-0 z-50 flex h-full w-full flex-col border-l border-border bg-card shadow-2xl",
                "sm:w-[400px] lg:w-[420px]"
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-primary" />
                  <h2 className="font-semibold text-foreground">Chat Assistant</h2>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setDrawerOpen(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent transition-colors"
                    title="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <ChatMessageList />

              {/* Input */}
              <ChatInput onSend={handleSend} disabled={isStreaming} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
