import { useState, useEffect } from "react";
import { ArrowRight, X } from "lucide-react";
import { Layout } from "./Layout";

export function DemoLayout() {
  const [showPopup, setShowPopup] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Show the popup after a short delay
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!dismissed) setShowPopup(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [dismissed]);

  const signupUrl = window.location.origin.replace("/app", "").replace(":5173", "") + "/login";

  return (
    <div className="flex flex-col h-dvh">
      {/* Demo banner */}
      <div className="h-10 bg-primary text-primary-foreground flex items-center justify-between px-4 z-[60] shrink-0">
        <span className="text-sm font-medium">
          Exploring Demo Mode
        </span>
        <a
          href={signupUrl}
          className="text-sm font-semibold hover:underline flex items-center gap-1"
        >
          Sign Up Free <ArrowRight className="h-4 w-4" />
        </a>
      </div>

      {/* Main layout */}
      <div className="flex-1 min-h-0">
        <Layout className="!h-full" basePath="/demo" />
      </div>

      {/* Popup CTA */}
      {showPopup && !dismissed && (
        <div className="fixed bottom-6 right-6 z-50 w-80 rounded-xl border border-primary/30 bg-card shadow-2xl shadow-primary/10 animate-in slide-in-from-bottom-4 duration-300">
          <div className="p-4">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-foreground">Like what you see?</h3>
              <button
                onClick={() => { setShowPopup(false); setDismissed(true); }}
                className="p-1 -m-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Create a free account to set up your own family dashboard — calendars, photos, smart home, and more.
            </p>
            <a
              href={signupUrl}
              className="flex items-center justify-center gap-2 w-full rounded-lg bg-primary text-primary-foreground px-4 py-2.5 font-medium text-sm hover:bg-primary/90 transition-colors"
            >
              Get Started Free <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
