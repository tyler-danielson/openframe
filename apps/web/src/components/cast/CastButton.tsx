import { useState } from "react";
import { MonitorPlay } from "lucide-react";
import { CastDialog } from "./CastDialog";
import { cn } from "../../lib/utils";

interface CastButtonProps {
  contentType: "iptv" | "camera" | "multiview";
  channelId?: string;
  cameraId?: string;
  cameraEntityId?: string;
  multiviewItems?: unknown[];
  variant?: "overlay" | "toolbar";
  className?: string;
}

export function CastButton({
  contentType,
  channelId,
  cameraId,
  cameraEntityId,
  multiviewItems,
  variant = "toolbar",
  className,
}: CastButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        title="Cast to TV"
        className={cn(
          variant === "overlay"
            ? "rounded-full bg-white/20 p-2 text-white backdrop-blur-sm transition hover:bg-white/30"
            : "inline-flex items-center justify-center rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-primary/10 hover:border-primary/40 hover:text-primary",
          className
        )}
      >
        <MonitorPlay className={cn(variant === "overlay" ? "h-5 w-5" : "h-4 w-4")} />
      </button>

      <CastDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        contentType={contentType}
        channelId={channelId}
        cameraId={cameraId}
        cameraEntityId={cameraEntityId}
        multiviewItems={multiviewItems}
      />
    </>
  );
}
