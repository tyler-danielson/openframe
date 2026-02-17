import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, MessageCircle } from "lucide-react";
import { api } from "../../services/api";
import { useChatStore } from "../../stores/chat";
import { cn } from "../../lib/utils";

interface ConversationListProps {
  onSelect?: () => void;
}

export function ConversationList({ onSelect }: ConversationListProps) {
  const queryClient = useQueryClient();
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);
  const setConversations = useChatStore((s) => s.setConversations);
  const setMessages = useChatStore((s) => s.setMessages);
  const startNewConversation = useChatStore((s) => s.startNewConversation);
  const removeConversation = useChatStore((s) => s.removeConversation);

  const { data: conversations = [] } = useQuery({
    queryKey: ["chat-conversations"],
    queryFn: () => api.getChatConversations(),
    refetchInterval: 30000,
  });

  // Sync to store
  useEffect(() => {
    setConversations(conversations);
  }, [conversations, setConversations]);

  const handleSelect = async (id: string) => {
    setActiveConversation(id);
    onSelect?.();
    try {
      const conv = await api.getChatConversation(id);
      setMessages(conv.messages);
    } catch (error) {
      console.error("Failed to load conversation:", error);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await api.deleteChatConversation(id);
      removeConversation(id);
      queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    }
  };

  const handleNew = () => {
    startNewConversation();
    onSelect?.();
  };

  return (
    <div className="flex flex-col h-full">
      {/* New conversation button */}
      <div className="p-3 border-b border-border">
        <button
          onClick={handleNew}
          className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-primary hover:bg-primary/10 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New conversation
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No conversations yet
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => handleSelect(conv.id)}
                className={cn(
                  "group flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors",
                  activeConversationId === conv.id
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-accent"
                )}
              >
                <MessageCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">
                  {conv.title || "New conversation"}
                </span>
                <button
                  onClick={(e) => handleDelete(e, conv.id)}
                  className="hidden group-hover:flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-destructive transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
