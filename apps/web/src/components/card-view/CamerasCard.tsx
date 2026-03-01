import { useQuery } from "@tanstack/react-query";
import { Camera } from "lucide-react";
import { api } from "../../services/api";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { useCardBlockNav } from "./useCardBlockNav";
import { cn } from "../../lib/utils";
import type { CardViewCardProps } from "./types";

export function CamerasCard({ onClick, blockNavId }: CardViewCardProps) {
  const { blockNavClasses } = useCardBlockNav(blockNavId);

  const { data: cameras = [] } = useQuery({
    queryKey: ["cameras"],
    queryFn: () => api.getCameras(),
    retry: false,
  });

  const { data: haCameras = [] } = useQuery({
    queryKey: ["ha-cameras"],
    queryFn: () => api.getHomeAssistantCameras(),
    retry: false,
  });

  const enabledCameras = cameras.filter((c) => c.isEnabled);
  const totalCameras = enabledCameras.length + haCameras.length;

  return (
    <Card
      className={cn(
        "cursor-pointer hover:bg-accent/50 transition-all duration-300 flex flex-col",
        blockNavClasses
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-primary" />
          Cameras
          {totalCameras > 0 && (
            <span className="ml-auto text-sm font-normal text-muted-foreground">
              {totalCameras} camera{totalCameras !== 1 ? "s" : ""}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex items-center justify-center">
        {totalCameras === 0 ? (
          <div className="flex flex-col items-center text-muted-foreground">
            <Camera className="h-10 w-10 mb-2 opacity-50" />
            <p className="text-sm">No cameras configured</p>
          </div>
        ) : (
          <div className="text-center">
            <Camera className="h-16 w-16 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {totalCameras} camera{totalCameras !== 1 ? "s" : ""} available
            </p>
            <p className="text-xs text-muted-foreground mt-1">Tap to view</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
