import { ChevronLeft, ChevronRight, Image } from "lucide-react";
import { api } from "../../../services/api";

interface PhotoControlProps {
  kioskId: string;
  widgetId: string;
  widgetType: string;
  widgetState?: Record<string, unknown>;
  config: Record<string, unknown>;
}

export function PhotoControl({ kioskId, widgetId, widgetType, widgetState, config }: PhotoControlProps) {
  const currentIndex = widgetState?.currentIndex as number | undefined;
  const totalPhotos = widgetState?.totalPhotos as number | undefined;
  const currentUrl = widgetState?.currentUrl as string | undefined;

  const sendCommand = (action: string, data?: Record<string, unknown>) => {
    api.sendKioskCommand(kioskId, {
      type: "widget-control",
      payload: { widgetId, action, data },
    }).catch(() => {});
  };

  return (
    <div className="flex flex-col items-center p-6 space-y-6">
      {/* Photo preview */}
      <div className="w-full max-w-sm aspect-video rounded-xl overflow-hidden bg-card shadow-lg">
        {currentUrl ? (
          <img
            src={currentUrl}
            alt="Current photo"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-primary/10">
            <Image className="h-16 w-16 text-primary/30" />
          </div>
        )}
      </div>

      {/* Photo counter */}
      <div className="text-sm text-muted-foreground">
        {currentIndex != null && totalPhotos != null
          ? `Photo ${currentIndex + 1} of ${totalPhotos}`
          : "Photo slideshow"}
      </div>

      {/* Navigation controls */}
      <div className="flex items-center gap-8">
        <button
          onClick={() => sendCommand("prev-photo")}
          className="flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 hover:bg-primary/20 active:bg-primary/30 transition-colors"
        >
          <ChevronLeft className="h-8 w-8 text-primary" />
        </button>

        <button
          onClick={() => sendCommand("next-photo")}
          className="flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 hover:bg-primary/20 active:bg-primary/30 transition-colors"
        >
          <ChevronRight className="h-8 w-8 text-primary" />
        </button>
      </div>
    </div>
  );
}
