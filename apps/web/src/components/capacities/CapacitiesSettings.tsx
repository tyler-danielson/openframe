import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Star,
  Link as LinkIcon,
  FileText,
  Search,
} from "lucide-react";
import { api } from "../../services/api";
import { Button } from "../ui/Button";

interface CapacitiesSettingsProps {
  onClose: () => void;
}

export function CapacitiesSettings({ onClose }: CapacitiesSettingsProps) {
  const queryClient = useQueryClient();
  const [apiToken, setApiToken] = useState("");
  const [showToken, setShowToken] = useState(false);

  // Fetch status
  const {
    data: status,
    isLoading,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ["capacities-status"],
    queryFn: () => api.getCapacitiesStatus(),
  });

  // Connect mutation
  const connectMutation = useMutation({
    mutationFn: (token: string) => api.connectCapacities(token),
    onSuccess: () => {
      setApiToken("");
      queryClient.invalidateQueries({ queryKey: ["capacities-status"] });
    },
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: () => api.disconnectCapacities(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capacities-status"] });
    },
  });

  // Test connection mutation
  const testMutation = useMutation<{ connected: boolean; message: string }, Error>({
    mutationFn: () => api.testCapacitiesConnection(),
  });

  // Refresh spaces mutation
  const refreshSpacesMutation = useMutation({
    mutationFn: () => api.getCapacitiesSpaces(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capacities-status"] });
    },
  });

  // Set default space mutation
  const setDefaultMutation = useMutation({
    mutationFn: (spaceId: string) => api.setCapacitiesDefaultSpace(spaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capacities-status"] });
    },
  });

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiToken.trim()) {
      connectMutation.mutate(apiToken.trim());
    }
  };

  const handleDisconnect = () => {
    if (confirm("Are you sure you want to disconnect from Capacities?")) {
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
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <FileText className="h-4 w-4 text-white" />
            </div>
            <h2 className="text-lg font-semibold">Capacities Integration</h2>
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
                  {status?.connected ? "Connected" : "Not Connected"}
                </p>
                {status?.lastSyncAt && (
                  <p className="text-xs text-muted-foreground">
                    Last synced: {new Date(status.lastSyncAt).toLocaleString()}
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
                  <h3 className="font-medium mb-2">Connect to Capacities</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Enter your Capacities API token to connect. You can find or
                    create an API token in your{" "}
                    <a
                      href="https://app.capacities.io/settings/api"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      Capacities settings
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </p>
                </div>

                <form onSubmit={handleConnect} className="space-y-3">
                  <div>
                    <label
                      htmlFor="apiToken"
                      className="block text-sm font-medium mb-1"
                    >
                      API Token
                    </label>
                    <div className="relative">
                      <input
                        id="apiToken"
                        type={showToken ? "text" : "password"}
                        value={apiToken}
                        onChange={(e) => setApiToken(e.target.value)}
                        className="w-full px-3 py-2 border border-input rounded-md bg-background pr-20"
                        placeholder="cap_..."
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
                    disabled={!apiToken.trim() || connectMutation.isPending}
                  >
                    {connectMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    Connect
                  </Button>
                </form>
              </div>

              {/* Info */}
              <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                <h4 className="font-medium text-sm">What you can do:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Save notes to your daily note
                  </li>
                  <li className="flex items-center gap-2">
                    <LinkIcon className="h-4 w-4" />
                    Save weblinks with notes
                  </li>
                  <li className="flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    Search your Capacities content
                  </li>
                </ul>
              </div>
            </>
          ) : (
            <>
              {/* Spaces */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Your Spaces</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => refreshSpacesMutation.mutate()}
                    disabled={refreshSpacesMutation.isPending}
                  >
                    {refreshSpacesMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {status.spaces && status.spaces.length > 0 ? (
                  <div className="space-y-2">
                    {status.spaces.map((space) => (
                      <div
                        key={space.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          space.isDefault
                            ? "border-primary bg-primary/5"
                            : "border-input"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">
                            {space.icon || "📁"}
                          </span>
                          <span className="font-medium">{space.title}</span>
                          {space.isDefault && (
                            <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                              Default
                            </span>
                          )}
                        </div>
                        {!space.isDefault && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDefaultMutation.mutate(space.id)}
                            disabled={setDefaultMutation.isPending}
                          >
                            <Star className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No spaces found. Create a space in Capacities first.
                  </p>
                )}
              </div>

              {/* Quick Actions */}
              <div className="space-y-3">
                <h3 className="font-medium">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-2">
                  <QuickNoteButton />
                </div>
              </div>

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
                  Disconnect
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Quick note button component
function QuickNoteButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: (text: string) => api.saveToCapacitiesDailyNote({ mdText: text }),
    onSuccess: () => {
      setNoteText("");
      setIsOpen(false);
      queryClient.invalidateQueries({ queryKey: ["capacities-status"] });
    },
  });

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        className="justify-start"
        onClick={() => setIsOpen(true)}
      >
        <FileText className="h-4 w-4 mr-2" />
        Quick Note
      </Button>
    );
  }

  return (
    <div className="col-span-2 space-y-2">
      <textarea
        value={noteText}
        onChange={(e) => setNoteText(e.target.value)}
        placeholder="Type your note..."
        className="w-full px-3 py-2 border border-input rounded-md bg-background resize-none"
        rows={3}
        autoFocus
      />
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setIsOpen(false);
            setNoteText("");
          }}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => saveMutation.mutate(noteText)}
          disabled={!noteText.trim() || saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : null}
          Save to Daily Note
        </Button>
      </div>
      {saveMutation.isError && (
        <p className="text-sm text-red-600">
          {saveMutation.error instanceof Error
            ? saveMutation.error.message
            : "Failed to save"}
        </p>
      )}
    </div>
  );
}
