import { Screensaver } from "../components/Screensaver";

export function ScreensaverDisplayPage() {
  return (
    <div className="relative w-full h-[calc(100vh-0px)] overflow-hidden">
      <Screensaver alwaysActive inline />
    </div>
  );
}
