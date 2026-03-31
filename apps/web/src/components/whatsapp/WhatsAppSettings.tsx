import { useState, useEffect, useCallback, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  MessageCircle,
  Trash2,
  Bell,
  Clock,
  Smartphone,
} from "lucide-react";
import { api } from "../../services/api";
import { useAuthStore } from "../../stores/auth";
import { Button } from "../ui/Button";

interface WhatsAppSettingsProps {
  onClose: () => void;
}

export function WhatsAppSettings({ onClose }: WhatsAppSettingsProps) {
  const queryClient = useQueryClient();
  const [connecting, setConnecting] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState("");
  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch status
  const {
    data: status,
    isLoading,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ["whatsapp-status"],
    queryFn: () => api.getWhatsAppStatus(),
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: () => api.disconnectWhatsApp(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-status"] });
    },
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: (settings: {
      dailyAgendaEnabled?: boolean;
      dailyAgendaTime?: string;
      eventRemindersEnabled?: boolean;
      eventReminderMinutes?: number;
    }) => api.updateWhatsAppSettings(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-status"] });
    },
  });

  // Unlink chat mutation
  const unlinkChatMutation = useMutation({
    mutationFn: (chatId: string) => api.unlinkWhatsAppChat(chatId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-status"] });
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (message: string) => api.sendWhatsAppMessage(message),
    onSuccess: () => {
      setTestMessage("");
    },
  });

  // Clean up EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const handleConnect = useCallback(() => {
    setConnecting(true);
    setQrCode(null);
    setConnectError(null);

    // Close any existing EventSource
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const token = useAuthStore.getState().accessToken;
    const url = api.getWhatsAppConnectUrl(token || "");
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.addEventListener("qr", (event) => {
      try {
        const data = JSON.parse(event.data);
        setQrCode(data.qr);
      } catch {
        // ignore parse errors
      }
    });

    es.addEventListener("connected", (event) => {
      setConnecting(false);
      setQrCode(null);
      es.close();
      eventSourceRef.current = null;
      queryClient.invalidateQueries({ queryKey: ["whatsapp-status"] });
    });

    es.addEventListener("error", (event) => {
      // SSE error event
      if (event instanceof MessageEvent) {
        try {
          const data = JSON.parse(event.data);
          setConnectError(data.error || "Connection failed");
        } catch {
          setConnectError("Connection failed");
        }
      } else {
        setConnectError("Connection lost. Please try again.");
      }
      setConnecting(false);
      setQrCode(null);
      es.close();
      eventSourceRef.current = null;
    });
  }, [queryClient]);

  const handleDisconnect = () => {
    if (confirm("Are you sure you want to disconnect WhatsApp?")) {
      disconnectMutation.mutate();
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
            <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-lg flex items-center justify-center">
              <MessageCircle className="h-4 w-4 text-white" />
            </div>
            <h2 className="text-lg font-semibold">WhatsApp</h2>
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
                    ? `${status.displayName || status.phoneNumber || "Connected"}`
                    : "Not Connected"}
                </p>
                {status?.connected && status.phoneNumber && (
                  <p className="text-xs text-muted-foreground">
                    {status.phoneNumber} · {status.chats.length} chat(s)
                  </p>
                )}
              </div>
            </div>
          </div>

          {!status?.connected ? (
            <>
              {/* Connect via QR */}
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-2">Connect WhatsApp</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Scan the QR code with your WhatsApp app to connect.
                    Open WhatsApp on your phone, go to{" "}
                    <span className="font-medium text-foreground">
                      Settings &gt; Linked Devices &gt; Link a Device
                    </span>.
                  </p>
                </div>

                {connectError && (
                  <div className="p-3 rounded-lg bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 text-sm">
                    {connectError}
                  </div>
                )}

                {connecting && qrCode ? (
                  <div className="flex flex-col items-center gap-4">
                    <div className="p-4 bg-white rounded-xl shadow-sm">
                      <img
                        src={qrCode}
                        alt="WhatsApp QR Code"
                        className="w-64 h-64"
                      />
                    </div>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Waiting for scan...
                    </p>
                  </div>
                ) : connecting ? (
                  <div className="flex flex-col items-center gap-4 py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">
                      Generating QR code...
                    </p>
                  </div>
                ) : (
                  <Button onClick={handleConnect} className="w-full">
                    <Smartphone className="h-4 w-4 mr-2" />
                    Connect WhatsApp
                  </Button>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Linked Chats */}
              {status.chats.length > 0 && (
                <div>
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-primary" />
                    Linked Chats
                  </h3>
                  <div className="space-y-2">
                    {status.chats.map((chat) => (
                      <div
                        key={chat.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-sm">{chat.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {chat.chatType} ·{" "}
                            {chat.lastMessageAt
                              ? `Last active: ${new Date(chat.lastMessageAt).toLocaleDateString()}`
                              : "No messages yet"}
                          </p>
                        </div>
                        <button
                          onClick={() => unlinkChatMutation.mutate(chat.id)}
                          className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors text-muted-foreground hover:text-red-600"
                          title="Unlink chat"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notification Settings */}
              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Bell className="h-4 w-4 text-primary" />
                  Notification Settings
                </h3>
                <div className="space-y-3">
                  <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer">
                    <div>
                      <p className="font-medium text-sm">Daily Agenda</p>
                      <p className="text-xs text-muted-foreground">
                        Receive your daily schedule each morning
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={status.settings.dailyAgendaEnabled}
                      onChange={(e) =>
                        updateSettingsMutation.mutate({
                          dailyAgendaEnabled: e.target.checked,
                        })
                      }
                      className="h-4 w-4 accent-primary"
                    />
                  </label>

                  {status.settings.dailyAgendaEnabled && (
                    <div className="flex items-center gap-3 px-3">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <label className="text-sm text-muted-foreground">
                        Send at
                      </label>
                      <input
                        type="time"
                        value={status.settings.dailyAgendaTime}
                        onChange={(e) =>
                          updateSettingsMutation.mutate({
                            dailyAgendaTime: e.target.value,
                          })
                        }
                        className="px-2 py-1 border rounded-md bg-background text-sm"
                      />
                    </div>
                  )}

                  <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer">
                    <div>
                      <p className="font-medium text-sm">Event Reminders</p>
                      <p className="text-xs text-muted-foreground">
                        Get reminded before events start
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={status.settings.eventRemindersEnabled}
                      onChange={(e) =>
                        updateSettingsMutation.mutate({
                          eventRemindersEnabled: e.target.checked,
                        })
                      }
                      className="h-4 w-4 accent-primary"
                    />
                  </label>

                  {status.settings.eventRemindersEnabled && (
                    <div className="flex items-center gap-3 px-3">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <label className="text-sm text-muted-foreground">
                        Remind
                      </label>
                      <select
                        value={status.settings.eventReminderMinutes}
                        onChange={(e) =>
                          updateSettingsMutation.mutate({
                            eventReminderMinutes: parseInt(e.target.value),
                          })
                        }
                        className="px-2 py-1 border rounded-md bg-background text-sm"
                      >
                        <option value={5}>5 min before</option>
                        <option value={10}>10 min before</option>
                        <option value={15}>15 min before</option>
                        <option value={30}>30 min before</option>
                        <option value={60}>1 hour before</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Send Test Message */}
              <div>
                <h3 className="font-medium mb-3">Send Test Message</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    placeholder="Type a test message..."
                    className="flex-1 px-3 py-2 border border-input rounded-md bg-background text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && testMessage.trim()) {
                        sendMessageMutation.mutate(testMessage.trim());
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      if (testMessage.trim()) {
                        sendMessageMutation.mutate(testMessage.trim());
                      }
                    }}
                    disabled={
                      !testMessage.trim() || sendMessageMutation.isPending
                    }
                  >
                    {sendMessageMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Send"
                    )}
                  </Button>
                </div>
                {sendMessageMutation.isSuccess && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    Message sent to {sendMessageMutation.data.sent} chat(s)
                  </p>
                )}
                {sendMessageMutation.isError && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    Failed to send message
                  </p>
                )}
              </div>

              {/* Disconnect */}
              <div className="pt-2 border-t">
                <Button
                  variant="outline"
                  onClick={handleDisconnect}
                  disabled={disconnectMutation.isPending}
                  className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  {disconnectMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Disconnect WhatsApp
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
