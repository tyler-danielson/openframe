import { WifiOff } from "lucide-react";

interface StaleDataOverlayProps {
  ageLabel: string;
  textColor?: string;
}

export function StaleDataOverlay({ ageLabel, textColor }: StaleDataOverlayProps) {
  return (
    <div
      className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px] rounded-lg"
      style={{ color: textColor }}
    >
      <WifiOff className="h-6 w-6 opacity-80 mb-1" />
      <span className="text-sm font-medium opacity-90">Disconnected</span>
      <span className="text-xs opacity-60 mt-0.5">Last updated {ageLabel}</span>
    </div>
  );
}
