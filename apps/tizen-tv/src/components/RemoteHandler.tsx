import { useCallback, useRef, useState } from "react";
import { useTizenKeys, exitApp, type KeyAction } from "@/hooks/useTizenKeys";
import { navigateKiosk, refreshKiosk } from "./KioskFrame";
import "@/styles/tv.css";

interface RemoteHandlerProps {
  onBack: () => void;
  showSettings?: boolean;
  onToggleSettings?: () => void;
}

// Ordered page list for channel up/down cycling
const PAGE_CYCLE = [
  "calendar",
  "dashboard",
  "homeassistant",
  "photos",
  "tasks",
  "screensaver",
];

// Page mapping for number keys (kept for remotes that have them)
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

// Color button actions (kept for remotes that have them)
const COLOR_ACTIONS: Record<string, () => void> = {
  red: () => navigateKiosk("screensaver:toggle"),
  green: () => navigateKiosk("calendar"),
  yellow: () => navigateKiosk("dashboard"),
  blue: () => navigateKiosk("homeassistant"),
};

export function RemoteHandler({
  onBack,
  showSettings: _showSettings,
  onToggleSettings,
}: RemoteHandlerProps) {
  const [showHints, setShowHints] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [showBackEscapeHint, setShowBackEscapeHint] = useState(false);
  const currentPageIndex = useRef(0);

  // Double-back escape: pressing Back twice within 2s goes to setup regardless
  // of iframe state. This is the only reliable escape when the iframe is showing
  // Samsung's own "Unable to Load page" error (which can't send back-unhandled).
  const backPressCountRef = useRef(0);
  const backEscapeTimerRef = useRef<number | null>(null);
  const backHintTimerRef = useRef<number | null>(null);

  const handleKeyAction = useCallback(
    (action: KeyAction) => {
      // Show brief feedback
      setLastAction(action);
      setTimeout(() => setLastAction(null), 500);

      switch (action) {
        // Navigation — send to iframe first; block nav handles back internally.
        // Double-back (Back × 2 within 2 seconds) always escapes to setup,
        // even when the iframe shows Samsung's own "Unable to Load page" error
        // and can never respond with "back-unhandled".
        case "back": {
          backPressCountRef.current += 1;

          if (backPressCountRef.current >= 2) {
            // Second press — escape to setup immediately
            backPressCountRef.current = 0;
            if (backEscapeTimerRef.current !== null) {
              window.clearTimeout(backEscapeTimerRef.current);
              backEscapeTimerRef.current = null;
            }
            if (backHintTimerRef.current !== null) {
              window.clearTimeout(backHintTimerRef.current);
              backHintTimerRef.current = null;
            }
            setShowBackEscapeHint(false);
            onBack();
          } else {
            // First press — send to iframe and show hint for double-press
            navigateKiosk("action:back");
            setShowBackEscapeHint(true);

            // Hide the hint after 2s (matches the escape window)
            if (backHintTimerRef.current !== null) window.clearTimeout(backHintTimerRef.current);
            backHintTimerRef.current = window.setTimeout(() => {
              setShowBackEscapeHint(false);
              backHintTimerRef.current = null;
            }, 2000);

            // Reset counter after 2s so rapid presses are required
            if (backEscapeTimerRef.current !== null) window.clearTimeout(backEscapeTimerRef.current);
            backEscapeTimerRef.current = window.setTimeout(() => {
              backPressCountRef.current = 0;
              backEscapeTimerRef.current = null;
            }, 2000);
          }
          break;
        }

        case "exit":
          exitApp();
          break;

        case "menu":
          onToggleSettings?.();
          break;

        // Channel up/down: cycle through pages
        case "channel_up": {
          currentPageIndex.current = (currentPageIndex.current + 1) % PAGE_CYCLE.length;
          const nextPage = PAGE_CYCLE[currentPageIndex.current];
          if (nextPage) navigateKiosk(nextPage);
          break;
        }
        case "channel_down": {
          currentPageIndex.current = (currentPageIndex.current - 1 + PAGE_CYCLE.length) % PAGE_CYCLE.length;
          const prevPage = PAGE_CYCLE[currentPageIndex.current];
          if (prevPage) navigateKiosk(prevPage);
          break;
        }

        // Media controls — send to iframe for block nav; refresh as fallback
        case "play_pause":
        case "play":
          navigateKiosk("action:play_pause");
          refreshKiosk();
          break;

        // Rewind: toggle help overlay (works on SolarCell via playback controls)
        case "rewind":
          setShowHints((prev) => !prev);
          navigateKiosk("help");
          break;

        // Info/Guide: toggle help (for remotes that have these buttons)
        case "info":
        case "guide":
          setShowHints((prev) => !prev);
          navigateKiosk("help");
          break;

        // Color buttons — send to iframe; block nav consumes when controlling,
        // otherwise iframe falls through to default color actions
        case "red":
        case "green":
        case "yellow":
        case "blue":
          navigateKiosk(`color:${action}`);
          break;

        // Number keys (for remotes that have them)
        case "digit_0":
        case "digit_1":
        case "digit_2":
        case "digit_3":
        case "digit_4":
        case "digit_5":
        case "digit_6":
        case "digit_7":
        case "digit_8":
        case "digit_9": {
          const page = PAGE_MAP[action];
          if (page) navigateKiosk(page);
          break;
        }

        // D-pad for iframe scrolling
        case "up":
        case "down":
        case "left":
        case "right":
          navigateKiosk(`scroll:${action}`);
          break;

        case "enter":
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

      {/* Double-back escape hint — appears after first Back press, disappears after 2s */}
      {showBackEscapeHint && (
        <div className="back-escape-hint">
          Press Back again to go to Settings
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
                  <span>Scroll</span>
                </div>
                <div className="hint-item">
                  <span className="key">OK</span>
                  <span>Select</span>
                </div>
                <div className="hint-item">
                  <span className="key">Back × 2</span>
                  <span>Open Settings</span>
                </div>
              </div>
            </div>

            <div className="hints-section">
              <h3>Pages</h3>
              <div className="hints-grid">
                <div className="hint-item">
                  <span className="key">CH ▲</span>
                  <span>Next Page</span>
                </div>
                <div className="hint-item">
                  <span className="key">CH ▼</span>
                  <span>Previous Page</span>
                </div>
              </div>
            </div>

            <div className="hints-section">
              <h3>Actions</h3>
              <div className="hints-grid">
                <div className="hint-item">
                  <span className="key">▶❚❚</span>
                  <span>Refresh</span>
                </div>
                <div className="hint-item">
                  <span className="key">◀◀</span>
                  <span>This Help</span>
                </div>
              </div>
            </div>

            <p className="hints-close">Press any key to close</p>
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
    channel_up: "Next page",
    channel_down: "Previous page",
    play_pause: "Refreshing...",
    play: "Refreshing...",
    rewind: "Help",
    info: "Help",
    guide: "Help",
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
