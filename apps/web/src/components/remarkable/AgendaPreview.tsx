import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format, addDays, subDays } from "date-fns";
import { X, ChevronLeft, ChevronRight, Download, Loader2, AlertCircle, Pencil, Send, Check } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "../../services/api";
import { Button } from "../ui/Button";
import type { FamilyProfile } from "@openframe/shared";

interface AgendaPreviewProps {
  date: string;
  onDateChange: (date: string) => void;
  onClose: () => void;
}

export function AgendaPreview({ date, onDateChange, onClose }: AgendaPreviewProps) {
  const navigate = useNavigate();
  const currentDate = new Date(date);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Fetch profiles to find the default one
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => api.getProfiles(),
  });

  const defaultProfile = profiles.find((p: FamilyProfile) => p.isDefault) ?? profiles[0];

  // Fetch the planner PDF via the profile preview endpoint
  useEffect(() => {
    if (!defaultProfile) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setBlobUrl(null);

    (async () => {
      try {
        const blob = await api.fetchPlannerPreviewBlob(defaultProfile.id, date);
        if (!cancelled) {
          setBlobUrl(URL.createObjectURL(blob));
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          // Fallback to agenda preview if planner preview fails
          try {
            const blob = await api.fetchAgendaPreviewBlob(date);
            if (!cancelled) {
              setBlobUrl(URL.createObjectURL(blob));
              setLoading(false);
            }
          } catch (fallbackErr) {
            if (!cancelled) {
              setError(fallbackErr instanceof Error ? fallbackErr.message : "Failed to load preview");
              setLoading(false);
            }
          }
        }
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, defaultProfile?.id]);

  // Clean up blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  // Push to device — read saved folder from profile's planner config
  const { data: plannerConfig } = useQuery({
    queryKey: ["profile-planner", defaultProfile?.id],
    queryFn: () => api.getProfilePlanner(defaultProfile!.id),
    enabled: !!defaultProfile,
  });
  const savedFolder = (plannerConfig as any)?.pushFolderPath;
  const [pushFolder, setPushFolder] = useState(savedFolder || "/Planners");
  useEffect(() => { if (savedFolder) setPushFolder(savedFolder); }, [savedFolder]);
  const [pushResult, setPushResult] = useState<string | null>(null);
  const pushPlanner = useMutation({
    mutationFn: () => api.pushProfilePlanner(defaultProfile!.id, date, pushFolder),
    onSuccess: (data) => {
      setPushStatus("success");
      setPushResult(data?.folderPath || pushFolder);
      setTimeout(() => setPushStatus("idle"), 5000);
    },
    onError: () => { setPushStatus("error"); setTimeout(() => setPushStatus("idle"), 3000); },
  });
  const [pushStatus, setPushStatus] = useState<"idle" | "success" | "error">("idle");

  const goToPreviousDay = () => onDateChange(format(subDays(currentDate, 1), "yyyy-MM-dd"));
  const goToNextDay = () => onDateChange(format(addDays(currentDate, 1), "yyyy-MM-dd"));
  const goToToday = () => onDateChange(format(new Date(), "yyyy-MM-dd"));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-background rounded-lg shadow-xl w-full max-w-4xl mx-4 h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold">Planner Preview</h2>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={goToPreviousDay}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <button
                onClick={goToToday}
                className="px-3 py-1 text-sm font-medium hover:bg-muted rounded-md transition-colors"
              >
                {format(currentDate, "EEEE, MMMM d, yyyy")}
              </button>
              <Button variant="ghost" size="sm" onClick={goToNextDay}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {defaultProfile && (
              <button
                onClick={() => { onClose(); navigate("/settings/planner"); }}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-input rounded-md hover:bg-muted transition-colors"
                title="Edit planner layout"
              >
                <Pencil className="h-3 w-3" />
                {defaultProfile.icon || "👤"} {defaultProfile.name}
              </button>
            )}
            {defaultProfile && (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={pushFolder}
                  onChange={(e) => setPushFolder(e.target.value)}
                  className="w-28 px-2 py-1 text-xs border border-input rounded-md bg-background"
                  title="Destination folder on reMarkable"
                />
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => { setPushStatus("idle"); setPushResult(null); pushPlanner.mutate(); }}
                  disabled={pushPlanner.isPending || !defaultProfile}
                >
                  {pushPlanner.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...</>
                  ) : pushStatus === "success" ? (
                    <><Check className="h-4 w-4 mr-2" /> Sent to {pushResult}</>
                  ) : pushStatus === "error" ? (
                    <><X className="h-4 w-4 mr-2" /> Failed</>
                  ) : (
                    <><Send className="h-4 w-4 mr-2" /> Push to Device</>
                  )}
                </Button>
              </div>
            )}
            {blobUrl && (
              <a
                href={blobUrl}
                download={`Planner ${date}.pdf`}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-input rounded-md hover:bg-muted transition-colors"
              >
                <Download className="h-4 w-4" />
                Download
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1 hover:bg-muted rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* PDF Preview */}
        <div className="flex-1 min-h-0 p-4 bg-muted/50">
          {loading && (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Generating planner...</span>
            </div>
          )}
          {error && (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-destructive text-sm">{error}</p>
              {!defaultProfile && (
                <p className="text-muted-foreground text-xs">Create a profile in Settings &gt; Planner first</p>
              )}
            </div>
          )}
          {blobUrl && (
            <iframe
              src={blobUrl}
              className="w-full h-full rounded-lg border border-border bg-white"
              title="Planner Preview"
            />
          )}
        </div>
      </div>
    </div>
  );
}
