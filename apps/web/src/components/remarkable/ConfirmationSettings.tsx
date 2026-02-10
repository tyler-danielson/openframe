import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Loader2, Save, CheckCircle, FolderOpen } from "lucide-react";
import { api, type RemarkableConfirmationSettings } from "../../services/api";
import { Button } from "../ui/Button";

interface ConfirmationSettingsProps {
  onClose: () => void;
}

export function ConfirmationSettings({ onClose }: ConfirmationSettingsProps) {
  const queryClient = useQueryClient();

  // Fetch current settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ["remarkable", "confirmations", "settings"],
    queryFn: () => api.getRemarkableConfirmationSettings(),
  });

  const [enabled, setEnabled] = useState(settings?.enabled ?? false);
  const [folderPath, setFolderPath] = useState(settings?.folderPath ?? "/Calendar/Processed");

  // Update when settings load
  useState(() => {
    if (settings) {
      setEnabled(settings.enabled);
      setFolderPath(settings.folderPath);
    }
  });

  // Fetch recent confirmations
  const { data: confirmations = [] } = useQuery({
    queryKey: ["remarkable", "confirmations"],
    queryFn: () => api.getRemarkableConfirmations(),
  });

  // Save settings
  const saveSettings = useMutation({
    mutationFn: () =>
      api.updateRemarkableConfirmationSettings({ enabled, folderPath }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["remarkable", "confirmations"] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettings.mutate();
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-background rounded-lg shadow-xl p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Two-Way Sync Settings</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-6">
          {/* Enable/Disable */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="rounded"
              />
              <div>
                <span className="font-medium">Enable Confirmation Push</span>
                <p className="text-sm text-muted-foreground">
                  Push a confirmation summary to your tablet after processing notes
                </p>
              </div>
            </label>
          </div>

          {/* Folder path */}
          {enabled && (
            <div>
              <label htmlFor="folderPath" className="block font-medium mb-1">
                Confirmation Folder
              </label>
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                <input
                  id="folderPath"
                  type="text"
                  value={folderPath}
                  onChange={(e) => setFolderPath(e.target.value)}
                  className="flex-1 px-3 py-2 border border-input rounded-md bg-background font-mono text-sm"
                  placeholder="/Calendar/Processed"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Confirmation summaries will be pushed to this folder
              </p>
            </div>
          )}

          {/* Recent confirmations */}
          {confirmations.length > 0 && (
            <div>
              <h3 className="font-medium mb-2">Recent Confirmations</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {confirmations.slice(0, 5).map((confirmation) => (
                  <div
                    key={confirmation.id}
                    className="flex items-center gap-2 p-2 bg-muted/50 rounded-md text-sm"
                  >
                    <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate">
                        {confirmation.eventsConfirmed.length} events confirmed
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(confirmation.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={saveSettings.isPending}>
              {saveSettings.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Settings
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
