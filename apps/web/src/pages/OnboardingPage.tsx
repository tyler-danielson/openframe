import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  CloudSun,
  Image,
  Home,
  Music,
  Tv,
  Camera,
  Newspaper,
  ChefHat,
  Sparkles,
  Smartphone,
  ArrowRight,
  Check,
  Loader2,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { api } from "../services/api";
import { useModuleStore } from "../stores/modules";
import { cn } from "../lib/utils";

interface InterestOption {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  moduleIds: string[];
  recommended?: boolean;
}

const INTERESTS: InterestOption[] = [
  {
    id: "weather",
    label: "Weather",
    description: "Local forecasts & conditions",
    icon: <CloudSun className="h-6 w-6" />,
    moduleIds: ["weather"],
    recommended: true,
  },
  {
    id: "photos",
    label: "Photos & Slideshows",
    description: "Display your photo albums",
    icon: <Image className="h-6 w-6" />,
    moduleIds: ["photos"],
    recommended: true,
  },
  {
    id: "companion",
    label: "Companion App",
    description: "Mobile app for on-the-go access",
    icon: <Smartphone className="h-6 w-6" />,
    moduleIds: ["companion"],
    recommended: true,
  },
  {
    id: "smarthome",
    label: "Smart Home",
    description: "Control Home Assistant devices",
    icon: <Home className="h-6 w-6" />,
    moduleIds: ["homeassistant"],
  },
  {
    id: "music",
    label: "Music (Spotify)",
    description: "Now playing & playback control",
    icon: <Music className="h-6 w-6" />,
    moduleIds: ["spotify"],
  },
  {
    id: "livetv",
    label: "Live TV",
    description: "Stream IPTV channels",
    icon: <Tv className="h-6 w-6" />,
    moduleIds: ["iptv"],
  },
  {
    id: "cameras",
    label: "Security Cameras",
    description: "View live camera feeds",
    icon: <Camera className="h-6 w-6" />,
    moduleIds: ["cameras"],
  },
  {
    id: "news",
    label: "News & Sports",
    description: "Headlines and live scores",
    icon: <Newspaper className="h-6 w-6" />,
    moduleIds: ["news", "sports"],
  },
  {
    id: "kitchen",
    label: "Kitchen & Recipes",
    description: "Save and cook recipes",
    icon: <ChefHat className="h-6 w-6" />,
    moduleIds: ["recipes"],
  },
  {
    id: "ai",
    label: "AI Features",
    description: "Chat assistant & daily briefings",
    icon: <Sparkles className="h-6 w-6" />,
    moduleIds: ["ai-chat", "ai-briefing"],
  },
];

type Step = "welcome" | "picker" | "done";

export function OnboardingPage() {
  const navigate = useNavigate();
  const fetchModules = useModuleStore((s) => s.fetchModules);

  const [step, setStep] = useState<Step>("welcome");
  const [selected, setSelected] = useState<Set<string>>(() => {
    const defaults = new Set<string>();
    for (const interest of INTERESTS) {
      if (interest.recommended) defaults.add(interest.id);
    }
    return defaults;
  });
  const [loading, setLoading] = useState(false);
  const [enabledCount, setEnabledCount] = useState(0);

  function toggleInterest(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleFinish() {
    setLoading(true);
    try {
      // Collect all module IDs from selected interests
      const moduleIds: string[] = [];
      for (const interest of INTERESTS) {
        if (selected.has(interest.id)) {
          moduleIds.push(...interest.moduleIds);
        }
      }

      // Batch enable modules
      if (moduleIds.length > 0) {
        await api.batchEnableModules(moduleIds);
      }

      // Mark onboarding complete
      await api.completeOnboarding();

      // Refresh module store
      await fetchModules();

      setEnabledCount(moduleIds.length);
      setStep("done");
    } catch (err) {
      console.error("Onboarding error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSkip() {
    setLoading(true);
    try {
      await api.completeOnboarding();
      navigate("/calendar", { replace: true });
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-2xl">
        {step === "welcome" && (
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Calendar className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight text-primary">
                Welcome to OpenFrame!
              </h1>
              <p className="text-lg text-muted-foreground">
                Let's set up your dashboard in under a minute
              </p>
            </div>
            <p className="max-w-md text-sm text-muted-foreground">
              We'll ask you what features you care about and enable them
              automatically. You can always change these later in Settings.
            </p>
            <Button
              size="lg"
              className="gap-2"
              onClick={() => setStep("picker")}
            >
              Get Started <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {step === "picker" && (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-primary">
                What would you like on your dashboard?
              </h2>
              <p className="text-sm text-muted-foreground">
                Tap to select the features you're interested in. Calendar &
                Tasks are always included.
              </p>
            </div>

            {/* Always-included core */}
            <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
              <Calendar className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <span className="font-medium text-primary">
                  Calendar & Tasks
                </span>
                <span className="ml-2 text-xs text-muted-foreground">
                  Always included
                </span>
              </div>
              <Check className="h-4 w-4 text-primary" />
            </div>

            {/* Interest grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {INTERESTS.map((interest) => {
                const isSelected = selected.has(interest.id);
                return (
                  <button
                    key={interest.id}
                    type="button"
                    onClick={() => toggleInterest(interest.id)}
                    className={cn(
                      "group relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all",
                      isSelected
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-border hover:border-primary/40 hover:bg-primary/5"
                    )}
                  >
                    {interest.recommended && !isSelected && (
                      <span className="absolute -top-2 right-2 rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-medium text-primary">
                        Recommended
                      </span>
                    )}
                    {isSelected && (
                      <span className="absolute -top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                        <Check className="h-3 w-3 text-primary-foreground" />
                      </span>
                    )}
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                        isSelected
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground group-hover:text-primary"
                      )}
                    >
                      {interest.icon}
                    </div>
                    <div>
                      <div
                        className={cn(
                          "text-sm font-medium",
                          isSelected
                            ? "text-primary"
                            : "text-foreground"
                        )}
                      >
                        {interest.label}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {interest.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleSkip}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                disabled={loading}
              >
                Skip for now
              </button>
              <Button
                size="lg"
                className="gap-2"
                onClick={handleFinish}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Check className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tight text-primary">
                You're all set!
              </h2>
              <p className="text-lg text-muted-foreground">
                We enabled{" "}
                <span className="font-semibold text-primary">
                  {enabledCount} feature{enabledCount !== 1 ? "s" : ""}
                </span>{" "}
                for you
              </p>
            </div>
            <p className="max-w-md text-sm text-muted-foreground">
              You can always add or remove features in{" "}
              <span className="font-medium text-foreground">
                Settings &gt; Modules
              </span>
            </p>
            <Button
              size="lg"
              className="gap-2"
              onClick={() => navigate("/calendar", { replace: true })}
            >
              Go to Dashboard <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
