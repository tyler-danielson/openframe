import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Send,
  Trash2,
  Copy,
  MessageCircle,
  Bell,
  Clock,
} from "lucide-react";
import { api } from "../../services/api";
import { Button } from "../ui/Button";

interface TelegramSettingsProps {
  onClose: () => void;
}

export function TelegramSettings({ onClose }: TelegramSettingsProps) {
  const queryClient = useQueryClient();
  const [botToken, setBotToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [testMessage, setTestMessage] = useState("");
  const [copied, setCopied] = useState(false);

  // Fetch status
  const {
    data: status,
    isLoading,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ["telegram-status"],
    queryFn: () => api.getTelegramStatus(),
  });

  // Connect mutation
  const connectMutation = useMutation({
    mutationFn: (token: string) => api.connectTelegram(token),
    onSuccess: () => {
      setBotToken("");
      queryClient.invalidateQueries({ queryKey: ["telegram-status"] });
    },
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: () => api.disconnectTelegram(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["telegram-status"] });
    },
  });

  // Test connection mutation
  const testMutation = useMutation({
    mutationFn: () => api.testTelegramConnection(),
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: (settings: {
      dailyAgendaEnabled?: boolean;
      dailyAgendaTime?: string;
      eventRemindersEnabled?: boolean;
      eventReminderMinutes?: number;
    }) => api.updateTelegramSettings(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["telegram-status"] });
    },
  });

  // Unlink chat mutation
  const unlinkChatMutation = useMutation({
    mutationFn: (chatId: string) => api.unlinkTelegramChat(chatId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["telegram-status"] });
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (message: string) => api.sendTelegramMessage(message),
    onSuccess: () => {
      setTestMessage("");
    },
  });

  // Get link code
  const { data: linkData } = useQuery({
    queryKey: ["telegram-link-code"],
    queryFn: () => api.getTelegramLinkCode(),
    enabled: status?.connected === true,
  });

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (botToken.trim()) {
      connectMutation.mutate(botToken.trim());
    }
  };

  const handleDisconnect = () => {
    if (confirm("Are you sure you want to disconnect your Telegram bot?")) {
      disconnectMutation.mutate();
    }
  };

  const copyLink = async () => {
    if (linkData?.startLink) {
      await navigator.clipboard.writeText(linkData.startLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-background rounded-lg shadow-xl p-8">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center">
              <Send className="h-4 w-4 text-white" />
            </div>
            <h2 className="text-lg font-semibold">Telegram Bot</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* Connection Status */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              {status?.connected ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-500" />
              )}
              <div>
                <p className="font-medium">
                  {status?.connected
                    ? `@${status.botUsername}`
                    : "Not Connected"}
                </p>
                {status?.connected && (
                  <p className="text-xs text-muted-foreground">
                    {status.chats.length} chat(s) linked
                  </p>
                )}
              </div>
            </div>
            {status?.connected && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => testMutation.mutate()}
                disabled={testMutation.isPending}
              >
                {testMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Test"
                )}
              </Button>
            )}
          </div>

          {testMutation.isSuccess && (
            <div
              className={`p-3 rounded-lg text-sm ${
                testMutation.data.connected
                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
              }`}
            >
              {testMutation.data.message}
            </div>
          )}

          {!status?.connected ? (
            <>
              {/* Connect Form */}
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">Connect Your Bot</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Create a bot with{" "}
                    <a
                      href="https://t.me/BotFather"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      @BotFather
                      <ExternalLink className="h-3 w-3" />
                    </a>{" "}
                    and paste the bot token here.
                  </p>
                </div>

                <form onSubmit={handleConnect} className="space-y-3">
                  <div>
                    <label
                      htmlFor="botToken"
                      className="block text-sm font-medium mb-1"
                    >
                      Bot Token
                    </label>
                    <div className="relative">
                      <input
                        id="botToken"
                        type={showToken ? "text" : "password"}
                        value={botToken}
                        onChange={(e) => setBotToken(e.target.value)}
                        className="w-full px-3 py-2 border border-input rounded-md bg-background pr-20 font-mono text-sm"
                        placeholder="123456789:ABC..."
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                      >
                        {showToken ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>

                  {connectMutation.isError && (
                    <div className="p-3 rounded-lg bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 text-sm">
                      {connectMutation.error instanceof Error
                        ? connectMutation.error.message
                        : "Failed to connect"}
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={!botToken.trim() || connectMutation.isPending}
                  >
                    {connectMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    Connect Bot
                  </Button>
                </form>
              </div>

              {/* Features */}
              <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                <h4 className="font-medium text-sm">Features:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li className="flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Event reminders & daily agenda
                  </li>
                  <li className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    Commands: /today, /tomorrow, /tasks
                  </li>
                  <li className="flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    Quick notifications from OpenFrame
                  </li>
                </ul>
              </div>
            </>
          ) : (
            <>
              {/* Link Code */}
              {linkData && (
                <div className="space-y-2">
                  <h3 className="font-medium">Link a Chat</h3>
                  <p className="text-sm text-muted-foreground">
                    Send /start to your bot to link a new chat:
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={linkData.startLink}
                      className="flex-1 px-3 py-2 border border-input rounded-md bg-muted text-sm"
                    />
                    <Button variant="outline" onClick={copyLink}>
                      {copied ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Linked Chats */}
              <div className="space-y-3">
                <h3 className="font-medium">Linked Chats</h3>
                {status.chats.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No chats linked yet. Send /start to your bot.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {status.chats.map((chat) => (
                      <div
                        key={chat.id}
                        className="flex items-center justify-between p-3 border border-input rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <MessageCircle className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium text-sm">{chat.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {chat.chatType} {chat.username && `@${chat.username}`}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm("Unlink this chat?")) {
                              unlinkChatMutation.mutate(chat.id);
                            }
                          }}
                          disabled={unlinkChatMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notification Settings */}
              <div className="space-y-4">
                <h3 className="font-medium">Notification Settings</h3>

                {/* Daily Agenda */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Daily Agenda</p>
                    <p className="text-xs text-muted-foreground">
                      Send daily schedule each morning
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      updateSettingsMutation.mutate({
                        dailyAgendaEnabled: !status.settings.dailyAgendaEnabled,
                      })
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      status.settings.dailyAgendaEnabled
                        ? "bg-primary"
                        : "bg-muted"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        status.settings.dailyAgendaEnabled
                          ? "translate-x-6"
                          : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                {status.settings.dailyAgendaEnabled && (
                  <div className="pl-4 border-l-2 border-muted">
                    <label className="block text-sm mb-1">Send at:</label>
                    <input
                      type="time"
                      value={status.settings.dailyAgendaTime}
                      onChange={(e) =>
                        updateSettingsMutation.mutate({
                          dailyAgendaTime: e.target.value,
                        })
                      }
                      className="px-3 py-1 border border-input rounded-md bg-background text-sm"
                    />
                  </div>
                )}

                {/* Event Reminders */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Event Reminders</p>
                    <p className="text-xs text-muted-foreground">
                      Get notified before events start
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      updateSettingsMutation.mutate({
                        eventRemindersEnabled:
                          !status.settings.eventRemindersEnabled,
                      })
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      status.settings.eventRemindersEnabled
                        ? "bg-primary"
                        : "bg-muted"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        status.settings.eventRemindersEnabled
                          ? "translate-x-6"
                          : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                {status.settings.eventRemindersEnabled && (
                  <div className="pl-4 border-l-2 border-muted">
                    <label className="block text-sm mb-1">
                      Remind me before:
                    </label>
                    <select
                      value={status.settings.eventReminderMinutes}
                      onChange={(e) =>
                        updateSettingsMutation.mutate({
                          eventReminderMinutes: parseInt(e.target.value),
                        })
                      }
                      className="px-3 py-1 border border-input rounded-md bg-background text-sm"
                    >
                      <option value={5}>5 minutes</option>
                      <option value={10}>10 minutes</option>
                      <option value={15}>15 minutes</option>
                      <option value={30}>30 minutes</option>
                      <option value={60}>1 hour</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Test Message */}
              {status.chats.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium">Send Test Message</h3>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 px-3 py-2 border border-input rounded-md bg-background text-sm"
                    />
                    <Button
                      onClick={() => sendMessageMutation.mutate(testMessage)}
                      disabled={
                        !testMessage.trim() || sendMessageMutation.isPending
                      }
                    >
                      {sendMessageMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {sendMessageMutation.isSuccess && (
                    <p className="text-xs text-green-600">
                      Sent to {sendMessageMutation.data.sent} chat(s)
                    </p>
                  )}
                </div>
              )}

              {/* Disconnect */}
              <div className="pt-4 border-t">
                <Button
                  variant="outline"
                  className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                  onClick={handleDisconnect}
                  disabled={disconnectMutation.isPending}
                >
                  {disconnectMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Disconnect Bot
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
