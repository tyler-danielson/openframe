import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { X, MonitorPlay, Tv, Loader2, Wifi } from "lucide-react";
import { api, type CastTarget, type CastRequest } from "../../services/api";
import { cn } from "../../lib/utils";

interface CastDialogProps {
  isOpen: boolean;
  onClose: () => void;
  contentType: "iptv" | "camera" | "multiview";
  channelId?: string;
  cameraId?: string;
  cameraEntityId?: string;
  multiviewItems?: unknown[];
}

export function CastDialog({
  isOpen,
  onClose,
  contentType,
  channelId,
  cameraId,
  cameraEntityId,
  multiviewItems,
}: CastDialogProps) {
  const [castingTo, setCastingTo] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const { data: targets = [], isLoading } = useQuery({
    queryKey: ["cast-targets"],
    queryFn: () => api.getCastTargets(),
    enabled: isOpen,
    staleTime: 30_000,
  });

  const castMutation = useMutation({
    mutationFn: (data: CastRequest) => api.castToTarget(data),
    onSuccess: (_data, variables) => {
      const target = targets.find((t) => t.id === variables.targetId);
      setToastMessage(`Casting to ${target?.name ?? "device"}`);
      setCastingTo(null);
      setTimeout(() => {
        setToastMessage(null);
        onClose();
      }, 1500);
    },
    onError: () => {
      setCastingTo(null);
      setToastMessage("Failed to cast");
      setTimeout(() => setToastMessage(null), 3000);
    },
  });

  const handleCast = (target: CastTarget) => {
    setCastingTo(target.id);
    castMutation.mutate({
      targetId: target.id,
      targetType: target.type,
      contentType,
      channelId,
      cameraId,
      cameraEntityId,
      multiviewItems,
    });
  };

  // Filter targets by capability
  const capabilityKey = contentType === "camera" ? "cameras" : contentType;
  const filteredTargets = targets.filter((t) =>
    t.capabilities.includes(capabilityKey as "iptv" | "cameras" | "multiview")
  );

  const kioskTargets = filteredTargets.filter((t) => t.type === "kiosk");
  const mediaPlayerTargets = filteredTargets.filter((t) => t.type === "media_player");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-md rounded-lg bg-card border border-border shadow-xl max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4 sticky top-0 bg-card z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <MonitorPlay className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-lg font-semibold">Cast to TV</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-2 text-sm text-muted-foreground">Finding devices...</p>
            </div>
          ) : filteredTargets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Wifi className="h-8 w-8 text-primary" />
              </div>
              <p className="mt-4 font-medium">No cast targets found</p>
              <p className="mt-1 text-sm text-muted-foreground max-w-xs">
                Add kiosks in Settings or connect Home Assistant media players to cast content.
              </p>
            </div>
          ) : (
            <>
              {/* Kiosks section */}
              {kioskTargets.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-primary mb-2">
                    OpenFrame Kiosks
                  </h3>
                  <div className="space-y-1">
                    {kioskTargets.map((target) => (
                      <CastTargetRow
                        key={target.id}
                        target={target}
                        isCasting={castingTo === target.id}
                        disabled={!!castingTo}
                        onClick={() => handleCast(target)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Media Players section */}
              {mediaPlayerTargets.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-primary mb-2">
                    Media Players
                  </h3>
                  <div className="space-y-1">
                    {mediaPlayerTargets.map((target) => {
                      const isUnavailable =
                        contentType === "multiview" && target.type === "media_player";
                      return (
                        <CastTargetRow
                          key={target.id}
                          target={target}
                          isCasting={castingTo === target.id}
                          disabled={!!castingTo || isUnavailable}
                          onClick={() => handleCast(target)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Toast */}
          {toastMessage && (
            <div className="rounded-md bg-primary/10 border border-primary/30 px-3 py-2 text-sm text-primary text-center">
              {toastMessage}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CastTargetRow({
  target,
  isCasting,
  disabled,
  onClick,
}: {
  target: CastTarget;
  isCasting: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const stateColor =
    target.state === "playing"
      ? "text-green-500"
      : target.state === "idle" || target.state === "on"
        ? "text-primary"
        : "text-muted-foreground";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-left transition-colors",
        disabled && !isCasting
          ? "opacity-50 cursor-not-allowed"
          : "hover:bg-primary/10 hover:border-primary/40"
      )}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
        {target.type === "kiosk" ? (
          <MonitorPlay className="h-4 w-4 text-primary" />
        ) : (
          <Tv className="h-4 w-4 text-primary" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{target.name}</p>
        {target.state && (
          <p className={cn("text-xs capitalize", stateColor)}>
            {target.state}
          </p>
        )}
      </div>
      {isCasting && (
        <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
      )}
    </button>
  );
}
