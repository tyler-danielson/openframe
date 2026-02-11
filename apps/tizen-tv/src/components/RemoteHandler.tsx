import { useCallback, useState } from "react";
import { useTizenKeys, exitApp, type KeyAction } from "@/hooks/useTizenKeys";
import { navigateKiosk, refreshKiosk } from "./KioskFrame";
import "@/styles/tv.css";

interface RemoteHandlerProps {
  onBack: () => void;
  showSettings?: boolean;
  onToggleSettings?: () => void;
}

// Page mapping for number keys
const PAGE_MAP: Record<string, string> = {
  digit_0: "home",
  digit_1: "calendar",
  digit_2: "dashboard",
  digit_3: "homeassistant",
  digit_4: "photos",
  digit_5: "weather",
  digit_6: "tasks",
  digit_7: "notes",
  digit_8: "media",
  digit_9: "settings",
};

// Color button actions
const COLOR_ACTIONS: Record<string, () => void> = {
  red: () => {
    // Toggle screensaver - send message to iframe
    navigateKiosk("screensaver:toggle");
  },
  green: () => {
    navigateKiosk("calendar");
  },
  yellow: () => {
    navigateKiosk("dashboard");
  },
  blue: () => {
    navigateKiosk("homeassistant");
  },
};

export function RemoteHandler({
  onBack,
  showSettings: _showSettings,
  onToggleSettings,
}: RemoteHandlerProps) {
  const [showHints, setShowHints] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);

  const handleKeyAction = useCallback(
    (action: KeyAction) => {
      // Show brief feedback
      setLastAction(action);
      setTimeout(() => setLastAction(null), 500);

      switch (action) {
        // Navigation
        case "back":
          onBack();
          break;

        case "exit":
          exitApp();
          break;

        case "menu":
          onToggleSettings?.();
          break;

        // Media controls
        case "play_pause":
        case "play":
          refreshKiosk();
          break;

        case "info":
        case "guide":
          setShowHints((prev) => !prev);
          break;

        // Color buttons
        case "red":
        case "green":
        case "yellow":
        case "blue":
          COLOR_ACTIONS[action]?.();
          break;

        // Number keys
        case "digit_0":
        case "digit_1":
        case "digit_2":
        case "digit_3":
        case "digit_4":
        case "digit_5":
        case "digit_6":
        case "digit_7":
        case "digit_8":
        case "digit_9":
          const page = PAGE_MAP[action];
          if (page) {
            navigateKiosk(page);
          }
          break;

        // D-pad for iframe scrolling
        case "up":
        case "down":
        case "left":
        case "right":
          // Send scroll command to iframe
          navigateKiosk(`scroll:${action}`);
          break;

        case "enter":
          // Send click/select to iframe
          navigateKiosk("action:select");
          break;
      }
    },
    [onBack, onToggleSettings]
  );

  useTizenKeys(handleKeyAction);

  return (
    <>
      {/* Action feedback toast */}
      {lastAction && (
        <div className="action-toast">
          {getActionLabel(lastAction)}
        </div>
      )}

      {/* Key hints overlay */}
      {showHints && (
        <div className="hints-overlay" onClick={() => setShowHints(false)}>
          <div className="hints-panel">
            <h2>Remote Controls</h2>

            <div className="hints-section">
              <h3>Navigation</h3>
              <div className="hints-grid">
                <div className="hint-item">
                  <span className="key">D-pad</span>
                  <span>Navigate / Scroll</span>
                </div>
                <div className="hint-item">
                  <span className="key">OK</span>
                  <span>Select</span>
                </div>
                <div className="hint-item">
                  <span className="key">Back</span>
                  <span>Return to Setup</span>
                </div>
                <div className="hint-item">
                  <span className="key">Menu</span>
                  <span>Settings</span>
                </div>
              </div>
            </div>

            <div className="hints-section">
              <h3>Media Controls</h3>
              <div className="hints-grid">
                <div className="hint-item">
                  <span className="key">Play/Pause</span>
                  <span>Refresh Kiosk</span>
                </div>
              </div>
            </div>

            <div className="hints-section">
              <h3>Color Buttons</h3>
              <div className="hints-grid">
                <div className="hint-item">
                  <span className="key red">Red</span>
                  <span>Toggle Screensaver</span>
                </div>
                <div className="hint-item">
                  <span className="key green">Green</span>
                  <span>Calendar</span>
                </div>
                <div className="hint-item">
                  <span className="key yellow">Yellow</span>
                  <span>Dashboard</span>
                </div>
                <div className="hint-item">
                  <span className="key blue">Blue</span>
                  <span>Home Assistant</span>
                </div>
              </div>
            </div>

            <div className="hints-section">
              <h3>Number Keys</h3>
              <div className="hints-grid compact">
                <div className="hint-item">
                  <span className="key">0</span>
                  <span>Home</span>
                </div>
                <div className="hint-item">
                  <span className="key">1</span>
                  <span>Calendar</span>
                </div>
                <div className="hint-item">
                  <span className="key">2</span>
                  <span>Dashboard</span>
                </div>
                <div className="hint-item">
                  <span className="key">3</span>
                  <span>Home Assistant</span>
                </div>
                <div className="hint-item">
                  <span className="key">4</span>
                  <span>Photos</span>
                </div>
                <div className="hint-item">
                  <span className="key">5</span>
                  <span>Weather</span>
                </div>
                <div className="hint-item">
                  <span className="key">6</span>
                  <span>Tasks</span>
                </div>
                <div className="hint-item">
                  <span className="key">7</span>
                  <span>Notes</span>
                </div>
                <div className="hint-item">
                  <span className="key">8</span>
                  <span>Media</span>
                </div>
                <div className="hint-item">
                  <span className="key">9</span>
                  <span>Settings</span>
                </div>
              </div>
            </div>

            <p className="hints-close">Press INFO or any key to close</p>
          </div>
        </div>
      )}
    </>
  );
}

function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    back: "Going back...",
    exit: "Exiting...",
    menu: "Opening settings...",
    play_pause: "Refreshing...",
    play: "Refreshing...",
    red: "Screensaver",
    green: "Calendar",
    yellow: "Dashboard",
    blue: "Home Assistant",
    digit_0: "Home",
    digit_1: "Calendar",
    digit_2: "Dashboard",
    digit_3: "Home Assistant",
    digit_4: "Photos",
    digit_5: "Weather",
    digit_6: "Tasks",
    digit_7: "Notes",
    digit_8: "Media",
    digit_9: "Settings",
    up: "Scroll Up",
    down: "Scroll Down",
    left: "Scroll Left",
    right: "Scroll Right",
    enter: "Select",
  };
  return labels[action] ?? action;
}
