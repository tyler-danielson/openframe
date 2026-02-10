import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Tablet,
  Link,
  Unlink,
  RefreshCw,
  Upload,
  FileText,
  Settings,
  Loader2,
  CheckCircle,
  XCircle,
  Eye,
  Clock,
  FolderOpen,
  Calendar,
  PenTool,
  Layout,
  ClipboardList,
  Folder,
  FileCheck,
  AlertCircle,
} from "lucide-react";
import { api, type RemarkableNote, type RemarkableAgendaSettings, type RemarkableRecentDocument } from "../services/api";
import { Button } from "../components/ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/Card";
import { ConnectionWizard } from "../components/remarkable/ConnectionWizard";
import { RemarkableSettings } from "../components/remarkable/RemarkableSettings";
import { AgendaPreview } from "../components/remarkable/AgendaPreview";
import { TemplateManager } from "../components/remarkable/TemplateManager";
import { ScheduleManager } from "../components/remarkable/ScheduleManager";
import { FolderBrowser } from "../components/remarkable/FolderBrowser";
import { ConfirmationSettings } from "../components/remarkable/ConfirmationSettings";

export function RemarkablePage() {
  const queryClient = useQueryClient();
  const [showSettings, setShowSettings] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSchedules, setShowSchedules] = useState(false);
  const [showFolders, setShowFolders] = useState(false);
  const [showConfirmations, setShowConfirmations] = useState(false);
  const [previewDate, setPreviewDate] = useState(format(new Date(), "yyyy-MM-dd"));

  // Fetch reMarkable status
  const {
    data: status,
    isLoading,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ["remarkable", "status"],
    queryFn: () => api.getRemarkableStatus(),
  });

  // Fetch unprocessed notes
  const { data: notes = [], isLoading: isLoadingNotes } = useQuery({
    queryKey: ["remarkable", "notes"],
    queryFn: () => api.getRemarkableNotes(true),
    enabled: status?.connected === true,
  });

  // Fetch recent documents from device
  const {
    data: recentDocs = [],
    isLoading: isLoadingRecentDocs,
    refetch: refetchRecentDocs,
    error: recentDocsError,
  } = useQuery({
    queryKey: ["remarkable", "recent-documents"],
    queryFn: () => api.getRemarkableRecentDocuments(10),
    enabled: status?.connected === true,
  });

  // Test connection mutation
  const testConnection = useMutation({
    mutationFn: () => api.testRemarkableConnection(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["remarkable"] });
    },
  });

  // Disconnect mutation
  const disconnect = useMutation({
    mutationFn: () => api.disconnectRemarkable(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["remarkable"] });
    },
  });

  // Push agenda mutation
  const pushAgenda = useMutation({
    mutationFn: (date: string | undefined) => api.pushRemarkableAgenda(date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["remarkable"] });
    },
  });

  // Sync notes mutation
  const syncNotes = useMutation({
    mutationFn: () => api.syncRemarkable(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["remarkable", "notes"] });
    },
  });

  // Process single note mutation
  const processNote = useMutation({
    mutationFn: (noteId: string) => api.processRemarkableNote(noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["remarkable", "notes"] });
    },
  });

  // Process all notes mutation
  const processAllNotes = useMutation({
    mutationFn: () => api.processAllRemarkableNotes(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["remarkable", "notes"] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isConnected = status?.connected === true;
  const unprocessedNotes = notes.filter((n: RemarkableNote) => !n.isProcessed);

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Tablet className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">reMarkable</h1>
            <p className="text-sm text-muted-foreground">
              Sync your calendar with your reMarkable tablet
            </p>
          </div>
        </div>
        {isConnected && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFolders(true)}
            >
              <Folder className="h-4 w-4 mr-2" />
              Folders
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(true)}
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        )}
      </div>

      {/* Connection Status Card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isConnected ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-muted-foreground" />
              )}
              <CardTitle>
                {isConnected ? "Connected" : "Not Connected"}
              </CardTitle>
            </div>
            {isConnected && (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => testConnection.mutate()}
                  disabled={testConnection.isPending}
                >
                  {testConnection.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => disconnect.mutate()}
                  disabled={disconnect.isPending}
                >
                  <Unlink className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          {isConnected && status.lastSyncAt && (
            <CardDescription>
              Last synced: {format(new Date(status.lastSyncAt), "PPpp")}
            </CardDescription>
          )}
        </CardHeader>
        {!isConnected && (
          <CardContent>
            <ConnectionWizard
              onSuccess={() => {
                queryClient.invalidateQueries({ queryKey: ["remarkable"] });
              }}
            />
          </CardContent>
        )}
      </Card>

      {/* Recent Files Section - Shows after connection to verify it's working */}
      {isConnected && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck className="h-5 w-5" />
                  Recent Files on Device
                </CardTitle>
                <CardDescription>
                  Your most recently edited files on reMarkable
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchRecentDocs()}
                disabled={isLoadingRecentDocs}
              >
                {isLoadingRecentDocs ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingRecentDocs ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : recentDocsError ? (
              <div className="text-center py-6">
                <AlertCircle className="h-10 w-10 mx-auto mb-2 text-amber-500" />
                <p className="text-amber-600 font-medium">File listing temporarily unavailable</p>
                <p className="text-sm text-muted-foreground mt-1">
                  reMarkable's servers returned an error. Your connection is still valid -
                  push and sync features should work normally.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Try again later or check{" "}
                  <a href="https://status.remarkable.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    reMarkable's status page
                  </a>
                </p>
              </div>
            ) : recentDocs.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>No documents found on your device</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentDocs.map((doc: RemarkableRecentDocument) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{doc.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {doc.folderPath}
                          {doc.lastModified && (
                            <> &middot; {format(new Date(doc.lastModified), "PPp")}</>
                          )}
                        </p>
                      </div>
                    </div>
                    {doc.pinned && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded flex-shrink-0">
                        Pinned
                      </span>
                    )}
                  </div>
                ))}
                <p className="text-xs text-muted-foreground text-center pt-2">
                  Showing your {recentDocs.length} most recently edited files
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main Content - Only show when connected */}
      {isConnected && (
        <>
          {/* Daily Agenda Section */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Daily Agenda
                  </CardTitle>
                  <CardDescription>
                    Push your daily schedule to your reMarkable tablet
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {status.agendaSettings && (
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>Daily at {status.agendaSettings.pushTime}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FolderOpen className="h-4 w-4" />
                    <span>{status.agendaSettings.folderPath}</span>
                  </div>
                  {status.agendaSettings.lastPushAt && (
                    <div className="flex items-center gap-1">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>
                        Last push: {format(new Date(status.agendaSettings.lastPushAt), "PPp")}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => pushAgenda.mutate(undefined)}
                  disabled={pushAgenda.isPending}
                >
                  {pushAgenda.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Push Today's Agenda
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowPreview(true)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </Button>
              </div>

              {pushAgenda.isSuccess && pushAgenda.data && (
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-sm">
                  <CheckCircle className="h-4 w-4 inline mr-2 text-green-500" />
                  {pushAgenda.data.message}
                </div>
              )}

              {pushAgenda.isError && (
                <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
                  <XCircle className="h-4 w-4 inline mr-2" />
                  {pushAgenda.error instanceof Error
                    ? pushAgenda.error.message
                    : "Failed to push agenda"}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Templates & Schedules Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Templates Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layout className="h-5 w-5" />
                  Templates
                </CardTitle>
                <CardDescription>
                  Create custom templates for weekly planners, habit trackers, and more
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  onClick={() => setShowTemplates(true)}
                  className="w-full"
                >
                  <Layout className="h-4 w-4 mr-2" />
                  Manage Templates
                </Button>
              </CardContent>
            </Card>

            {/* Schedules Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Schedules
                </CardTitle>
                <CardDescription>
                  Automate when templates are pushed to your device
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  onClick={() => setShowSchedules(true)}
                  className="w-full"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Manage Schedules
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Handwritten Notes Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <PenTool className="h-5 w-5" />
                    Handwritten Notes
                  </CardTitle>
                  <CardDescription>
                    Notes written on your tablet can be converted to calendar events
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowConfirmations(true)}
                    title="Two-way sync settings"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => syncNotes.mutate()}
                    disabled={syncNotes.isPending}
                  >
                    {syncNotes.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                  {unprocessedNotes.length > 0 && (
                    <Button
                      size="sm"
                      onClick={() => processAllNotes.mutate()}
                      disabled={processAllNotes.isPending}
                    >
                      {processAllNotes.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Process All ({unprocessedNotes.length})
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingNotes ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : notes.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No notes found</p>
                  <p className="text-sm mt-1">
                    Write notes in the /Calendar/Notes folder on your tablet
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {notes.map((note: RemarkableNote) => (
                    <div
                      key={note.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{note.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {note.folderPath}
                            {note.lastModifiedAt && (
                              <> &middot; Modified {format(new Date(note.lastModifiedAt), "PPp")}</>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {note.isProcessed ? (
                          <span className="flex items-center gap-1 text-sm text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            Processed
                          </span>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => processNote.mutate(note.id)}
                            disabled={processNote.isPending}
                          >
                            {processNote.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <PenTool className="h-4 w-4 mr-1" />
                                Process
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {processAllNotes.isSuccess && processAllNotes.data && (
                <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-sm">
                  <CheckCircle className="h-4 w-4 inline mr-2 text-green-500" />
                  Processed {processAllNotes.data.processedCount} notes, created{" "}
                  {processAllNotes.data.totalEventsCreated} events
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Settings Modal */}
      {showSettings && status?.agendaSettings && (
        <RemarkableSettings
          settings={status.agendaSettings}
          onClose={() => setShowSettings(false)}
          onSave={() => {
            setShowSettings(false);
            queryClient.invalidateQueries({ queryKey: ["remarkable"] });
          }}
        />
      )}

      {/* Preview Modal */}
      {showPreview && (
        <AgendaPreview
          date={previewDate}
          onDateChange={setPreviewDate}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* Template Manager Modal */}
      {showTemplates && (
        <TemplateManager onClose={() => setShowTemplates(false)} />
      )}

      {/* Schedule Manager Modal */}
      {showSchedules && (
        <ScheduleManager onClose={() => setShowSchedules(false)} />
      )}

      {/* Folder Browser Modal */}
      {showFolders && (
        <FolderBrowser onClose={() => setShowFolders(false)} />
      )}

      {/* Confirmation Settings Modal */}
      {showConfirmations && (
        <ConfirmationSettings onClose={() => setShowConfirmations(false)} />
      )}
    </div>
  );
}
