import { create } from "zustand";
import type { ChatConversationSummary, ChatMessageData } from "../services/api";

interface ChatState {
  // State
  conversations: ChatConversationSummary[];
  activeConversationId: string | null;
  messages: ChatMessageData[];
  isStreaming: boolean;
  isDrawerOpen: boolean;
  streamingContent: string;

  // Actions
  toggleDrawer: () => void;
  setDrawerOpen: (open: boolean) => void;
  setActiveConversation: (id: string | null) => void;
  setConversations: (conversations: ChatConversationSummary[]) => void;
  setMessages: (messages: ChatMessageData[]) => void;
  addMessage: (message: ChatMessageData) => void;
  setStreaming: (streaming: boolean) => void;
  setStreamingContent: (content: string) => void;
  appendStreamingContent: (token: string) => void;
  startNewConversation: () => void;
  removeConversation: (id: string) => void;
}

export const useChatStore = create<ChatState>()((set) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  isStreaming: false,
  isDrawerOpen: false,
  streamingContent: "",

  toggleDrawer: () => set((state) => ({ isDrawerOpen: !state.isDrawerOpen })),

  setDrawerOpen: (open) => set({ isDrawerOpen: open }),

  setActiveConversation: (id) =>
    set({ activeConversationId: id, messages: [], streamingContent: "" }),

  setConversations: (conversations) => set({ conversations }),

  setMessages: (messages) => set({ messages }),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  setStreaming: (streaming) => set({ isStreaming: streaming }),

  setStreamingContent: (content) => set({ streamingContent: content }),

  appendStreamingContent: (token) =>
    set((state) => ({ streamingContent: state.streamingContent + token })),

  startNewConversation: () =>
    set({
      activeConversationId: null,
      messages: [],
      streamingContent: "",
    }),

  removeConversation: (id) =>
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== id),
      ...(state.activeConversationId === id
        ? { activeConversationId: null, messages: [], streamingContent: "" }
        : {}),
    })),
}));
