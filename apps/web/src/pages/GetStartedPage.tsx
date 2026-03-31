import { useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Cloud,
  Server,
  HelpCircle,
  Monitor,
  Tv,
  Tablet,
  CircuitBoard,
  Speaker,
  Calendar,
  CloudSun,
  Image,
  Home,
  Camera,
  Trophy,
  Newspaper,
  Music,
  Play,
  CheckSquare,
  ChefHat,
  Smartphone,
  Globe,
  X,
  Copy,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Terminal,
  Download,
  Settings,
} from "lucide-react";
import { cn } from "../lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type Step = "hosting" | "display" | "features" | "mobile" | "results";

type HostingChoice = "cloud" | "self-hosted" | "unsure";
type DisplayChoice = "browser" | "samsung-tv" | "lg-createboard" | "tablet" | "raspberry-pi" | "echo-show";
type FeatureChoice = "calendar" | "weather" | "photos" | "homeassistant" | "cameras" | "sports" | "news" | "spotify" | "iptv" | "tasks" | "kitchen";
type MobileChoice = "companion-app" | "web-only" | "none";

const STEPS: Step[] = ["hosting", "display", "features", "mobile", "results"];

const STEP_LABELS: Record<Step, string> = {
  hosting: "Hosting",
  display: "Display",
  features: "Features",
  mobile: "Mobile",
  results: "Your Setup",
};

// ─── Option data ─────────────────────────────────────────────────────────────

interface OptionCard {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  recommended?: boolean;
}

const HOSTING_OPTIONS: OptionCard[] = [
  { id: "cloud", label: "Cloud Hosted", description: "We host everything at openframe.us — just sign up", icon: <Cloud className="h-7 w-7" />, recommended: true },
  { id: "self-hosted", label: "Self-Hosted (Docker)", description: "Run on your own server, NAS, Raspberry Pi, or VPS", icon: <Server className="h-7 w-7" /> },
  { id: "unsure", label: "Not Sure Yet", description: "Show me both options and I'll decide later", icon: <HelpCircle className="h-7 w-7" /> },
];

const DISPLAY_OPTIONS: OptionCard[] = [
  { id: "browser", label: "Web Browser", description: "Any computer with Chrome, Firefox, or Edge", icon: <Monitor className="h-7 w-7" />, recommended: true },
  { id: "samsung-tv", label: "Samsung TV", description: "Samsung smart TVs (Tizen OS, 2017+)", icon: <Tv className="h-7 w-7" /> },
  { id: "lg-createboard", label: "LG CreateBoard", description: "LG interactive displays (Android)", icon: <Tv className="h-7 w-7" /> },
  { id: "tablet", label: "Tablet", description: "Wall-mounted iPad, Android, or Fire tablet", icon: <Tablet className="h-7 w-7" /> },
  { id: "raspberry-pi", label: "Raspberry Pi", description: "Dedicated Pi with HDMI to TV or monitor", icon: <CircuitBoard className="h-7 w-7" /> },
  { id: "echo-show", label: "Echo Show", description: "Amazon Echo Show devices", icon: <Speaker className="h-7 w-7" /> },
];

const FEATURE_OPTIONS: OptionCard[] = [
  { id: "calendar", label: "Calendar & Events", description: "Google, Microsoft, and iCloud calendars", icon: <Calendar className="h-6 w-6" />, recommended: true },
  { id: "weather", label: "Weather & Forecast", description: "Local conditions and multi-day forecast", icon: <CloudSun className="h-6 w-6" />, recommended: true },
  { id: "photos", label: "Photo Slideshow", description: "Display photo albums and Google Photos", icon: <Image className="h-6 w-6" /> },
  { id: "homeassistant", label: "Home Assistant", description: "Smart home controls and entity status", icon: <Home className="h-6 w-6" /> },
  { id: "cameras", label: "Security Cameras", description: "Live camera feeds and snapshots", icon: <Camera className="h-6 w-6" /> },
  { id: "sports", label: "Sports Scores", description: "Live scores and schedules for your teams", icon: <Trophy className="h-6 w-6" /> },
  { id: "news", label: "News Headlines", description: "RSS news ticker from your favorite sources", icon: <Newspaper className="h-6 w-6" /> },
  { id: "spotify", label: "Spotify / Music", description: "Now playing and playback controls", icon: <Music className="h-6 w-6" /> },
  { id: "iptv", label: "Live TV (IPTV)", description: "Stream live TV channels via M3U playlists", icon: <Play className="h-6 w-6" /> },
  { id: "tasks", label: "Tasks & Checklists", description: "To-do lists synced with your calendars", icon: <CheckSquare className="h-6 w-6" /> },
  { id: "kitchen", label: "Kitchen & Recipes", description: "Recipe display and meal planning", icon: <ChefHat className="h-6 w-6" /> },
];

const MOBILE_OPTIONS: OptionCard[] = [
  { id: "companion-app", label: "Companion App", description: "Native app to control displays from your phone", icon: <Smartphone className="h-7 w-7" />, recommended: true },
  { id: "web-only", label: "Web Only", description: "Use the web interface on your phone's browser", icon: <Globe className="h-7 w-7" /> },
  { id: "none", label: "No Mobile Control", description: "Desktop and display only", icon: <X className="h-7 w-7" /> },
];

// ─── Results generation ──────────────────────────────────────────────────────

interface SetupSection {
  title: string;
  icon: React.ReactNode;
  steps: { title: string; description: string; code?: string; link?: { url: string; label: string } }[];
}

function generateResults(
  hosting: HostingChoice,
  displays: DisplayChoice[],
  features: FeatureChoice[],
  mobile: MobileChoice
): SetupSection[] {
  const sections: SetupSection[] = [];

  // 1. Server Setup
  if (hosting === "cloud") {
    sections.push({
      title: "Create Your Account",
      icon: <Cloud className="h-5 w-5" />,
      steps: [
        { title: "Sign up at openframe.us", description: "Create a free account to get started. No server setup required.", link: { url: "https://openframe.us/login", label: "Sign Up" } },
        { title: "Complete the setup wizard", description: "After signing in, follow the guided setup to connect your calendars and configure your display." },
      ],
    });
  } else if (hosting === "self-hosted") {
    sections.push({
      title: "Install OpenFrame Server",
      icon: <Server className="h-5 w-5" />,
      steps: [
        { title: "Install Docker", description: "Docker is required to run OpenFrame. Install Docker Engine or Docker Desktop for your platform.", link: { url: "https://docs.docker.com/get-docker/", label: "Get Docker" } },
        {
          title: "Clone and start OpenFrame",
          description: "Download and run the OpenFrame Docker stack. This sets up the app, database, and cache automatically.",
          code: `git clone https://github.com/openframe-org/openframe-cloud.git
cd openframe-cloud/docker
docker compose up -d`,
        },
        { title: "Open the setup wizard", description: "Navigate to your server in a browser to complete initial setup (create admin account, connect calendars).", code: "# Open in your browser:\nhttp://YOUR_SERVER_IP:8080/setup" },
      ],
    });
  } else {
    // unsure — show both
    sections.push({
      title: "Choose Your Hosting",
      icon: <HelpCircle className="h-5 w-5" />,
      steps: [
        { title: "Option A: Cloud Hosted (Easiest)", description: "Sign up at openframe.us — no server setup needed. We handle hosting, updates, and backups.", link: { url: "https://openframe.us/login", label: "Sign Up for Cloud" } },
        {
          title: "Option B: Self-Hosted (Full Control)",
          description: "Run OpenFrame on your own hardware using Docker. You'll need a Linux server, NAS, Raspberry Pi, or VPS.",
          code: `git clone https://github.com/openframe-org/openframe-cloud.git
cd openframe-cloud/docker
docker compose up -d`,
        },
      ],
    });
  }

  // 2. Display Setup
  if (displays.length > 0) {
    const displaySteps: SetupSection["steps"] = [];

    if (displays.includes("browser")) {
      displaySteps.push({
        title: "Web Browser Kiosk",
        description: "Open your OpenFrame URL in Chrome, Firefox, or Edge. For a kiosk experience, press F11 for fullscreen. You can also install it as a PWA (Chrome → Menu → 'Install OpenFrame').",
      });
    }
    if (displays.includes("samsung-tv")) {
      displaySteps.push({
        title: "Samsung TV (Tizen)",
        description: "Sideload the OpenFrame Tizen app onto your Samsung TV. Requires Tizen Studio for building the .wgt package and SDB for installation.",
        link: { url: "https://developer.tizen.org/development/tizen-studio/download", label: "Tizen Studio" },
      });
    }
    if (displays.includes("lg-createboard")) {
      displaySteps.push({
        title: "LG CreateBoard",
        description: "Install the OpenFrame APK via ADB. Enable Developer Options on the CreateBoard, connect over WiFi, and sideload the app.",
        code: `# Connect to CreateBoard\nadb connect YOUR_CREATEBOARD_IP:5555\n\n# Install the APK\nadb install openframe-createboard.apk`,
      });
    }
    if (displays.includes("tablet")) {
      displaySteps.push({
        title: "Tablet (Wall-Mounted)",
        description: "Open your OpenFrame URL in the tablet's browser. For Android, use a kiosk browser app like 'Fully Kiosk Browser' for auto-start and screen-on. For iPad, use Guided Access mode.",
        link: { url: "https://www.fully-kiosk.com/", label: "Fully Kiosk Browser" },
      });
    }
    if (displays.includes("raspberry-pi")) {
      displaySteps.push({
        title: "Raspberry Pi Kiosk",
        description: "Flash Raspberry Pi OS Lite, install Chromium, and configure it to boot directly into your OpenFrame URL in kiosk mode.",
        code: `# Install minimal desktop + Chromium\nsudo apt install -y xserver-xorg x11-xserver-utils xinit chromium-browser\n\n# Auto-start kiosk on boot (add to ~/.bashrc)\nif [ -z "$DISPLAY" ] && [ "$(tty)" = "/dev/tty1" ]; then\n  startx /usr/bin/chromium-browser --kiosk --noerrdialogs http://YOUR_SERVER:8080/kiosk/TOKEN\nfi`,
      });
    }
    if (displays.includes("echo-show")) {
      displaySteps.push({
        title: "Amazon Echo Show",
        description: "Use the Echo Show's built-in browser (Silk) to navigate to your OpenFrame kiosk URL. Say 'Alexa, open Silk Browser' and enter your URL.",
      });
    }

    // Add kiosk token step
    displaySteps.push({
      title: "Generate a Kiosk Token",
      description: "In OpenFrame, go to Settings → Kiosks → Add Kiosk to generate a unique display URL. Each display gets its own token for independent configuration.",
    });

    sections.push({
      title: "Set Up Your Display" + (displays.length > 1 ? "s" : ""),
      icon: <Monitor className="h-5 w-5" />,
      steps: displaySteps,
    });
  }

  // 3. Feature Configuration
  if (features.length > 0) {
    const featureSteps: SetupSection["steps"] = [];

    // Always-available features
    if (features.includes("calendar")) {
      featureSteps.push({ title: "Connect Calendars", description: "Go to Settings → Calendars to connect Google Calendar, Microsoft Outlook, or Apple iCloud calendars via OAuth." });
    }
    if (features.includes("weather")) {
      featureSteps.push({ title: "Set Up Weather", description: "Go to Settings → Weather. A free API key from OpenWeatherMap is needed for self-hosted. Cloud users get weather automatically.", link: { url: "https://openweathermap.org/api", label: "Get API Key" } });
    }
    if (features.includes("photos")) {
      featureSteps.push({ title: "Photo Slideshow", description: "Go to Settings → Modules and enable Photos. Upload albums directly or connect Google Photos for automatic sync." });
    }
    if (features.includes("homeassistant")) {
      featureSteps.push({ title: "Home Assistant", description: "Go to Settings → Modules → Home Assistant. Enter your HA URL and a long-lived access token. Supports entity controls, maps, and camera feeds." });
    }
    if (features.includes("cameras")) {
      featureSteps.push({ title: "Security Cameras", description: "Go to Settings → Modules → Cameras. Add RTSP, MJPEG, or snapshot URLs for each camera. Supports multi-view layouts." });
    }
    if (features.includes("sports")) {
      featureSteps.push({ title: "Sports Scores", description: "Go to Settings → Modules → Sports. Select your favorite teams for live score tracking across NFL, NBA, MLB, NHL, MLS, and more." });
    }
    if (features.includes("news")) {
      featureSteps.push({ title: "News Headlines", description: "Go to Settings → Modules → News. Choose from built-in sources (BBC, NYT, NPR, etc.) or add custom RSS feeds." });
    }
    if (features.includes("spotify")) {
      featureSteps.push({ title: "Spotify Integration", description: "Go to Settings → Modules → Spotify. Connect your Spotify account to display now-playing info and control playback." });
    }
    if (features.includes("iptv")) {
      featureSteps.push({ title: "Live TV (IPTV)", description: "Go to Settings → Modules → IPTV. Add M3U playlist URLs to stream live TV channels on your displays." });
    }
    if (features.includes("tasks")) {
      featureSteps.push({ title: "Tasks & Checklists", description: "Tasks sync automatically from your connected Google or Microsoft accounts. No additional setup needed." });
    }
    if (features.includes("kitchen")) {
      featureSteps.push({ title: "Kitchen & Recipes", description: "Go to Settings → Modules → Kitchen. Import recipes from URLs or add them manually. Great for a kitchen display!" });
    }

    sections.push({
      title: "Configure Features",
      icon: <Settings className="h-5 w-5" />,
      steps: featureSteps,
    });
  }

  // 4. Mobile
  if (mobile === "companion-app") {
    sections.push({
      title: "Install Companion App",
      icon: <Smartphone className="h-5 w-5" />,
      steps: [
        { title: "Download the app", description: "The OpenFrame Companion app is available for iOS and Android. Scan the QR code in Settings → Companion to pair your phone." },
        { title: "Pair with your server", description: "Open the companion app, tap 'Scan QR Code', and scan the code from your OpenFrame settings page." },
      ],
    });
  } else if (mobile === "web-only") {
    sections.push({
      title: "Mobile Web Access",
      icon: <Globe className="h-5 w-5" />,
      steps: [
        { title: "Open on your phone", description: "Navigate to your OpenFrame URL in your phone's browser. The interface is fully responsive and touch-optimized." },
        { title: "Add to home screen", description: "For quick access, add OpenFrame to your home screen: Safari → Share → 'Add to Home Screen', or Chrome → Menu → 'Install'." },
      ],
    });
  }

  return sections;
}

// ─── Components ──────────────────────────────────────────────────────────────

function StepIndicator({ steps, currentStep }: { steps: Step[]; currentStep: Step }) {
  const currentIndex = steps.indexOf(currentStep);
  return (
    <div className="flex items-center gap-1 sm:gap-2 mb-8">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-1 sm:gap-2">
          <div
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all",
              i < currentIndex
                ? "bg-primary text-primary-foreground"
                : i === currentIndex
                ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-[#0a0a0a]"
                : "bg-white/10 text-white/40"
            )}
          >
            {i < currentIndex ? <Check className="h-4 w-4" /> : i + 1}
          </div>
          <span className={cn("text-xs hidden sm:block", i === currentIndex ? "text-primary font-medium" : "text-white/40")}>
            {STEP_LABELS[step]}
          </span>
          {i < steps.length - 1 && <div className={cn("w-4 sm:w-8 h-px", i < currentIndex ? "bg-primary" : "bg-white/10")} />}
        </div>
      ))}
    </div>
  );
}

function SelectionCard({
  option,
  selected,
  onToggle,
  multi = false,
}: {
  option: OptionCard;
  selected: boolean;
  onToggle: () => void;
  multi?: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "relative flex items-start gap-4 rounded-xl border-2 p-4 sm:p-5 text-left transition-all",
        selected
          ? "border-primary bg-primary/10 shadow-lg shadow-primary/5"
          : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/[0.07]"
      )}
    >
      {/* Selection indicator */}
      <div
        className={cn(
          "shrink-0 flex items-center justify-center w-6 h-6 rounded-full border-2 transition-all mt-0.5",
          selected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-white/20 bg-transparent",
          !multi && "rounded-full",
          multi && "rounded-md"
        )}
      >
        {selected && <Check className="h-3.5 w-3.5" />}
      </div>

      {/* Icon */}
      <div className={cn("shrink-0 p-2.5 rounded-xl transition-colors", selected ? "bg-primary/20 text-primary" : "bg-white/10 text-white/60")}>
        {option.icon}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("font-semibold text-sm sm:text-base", selected ? "text-white" : "text-white/80")}>{option.label}</span>
          {option.recommended && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/20 text-primary">
              Recommended
            </span>
          )}
        </div>
        <span className="text-xs sm:text-sm text-white/50 mt-0.5 block">{option.description}</span>
      </div>
    </button>
  );
}

function ResultSection({ section, index }: { section: SetupSection; index: number }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 sm:p-5 text-left hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/20 text-primary shrink-0">
          {section.icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">Step {index + 1}</span>
          </div>
          <h3 className="font-semibold text-white">{section.title}</h3>
        </div>
        {expanded ? <ChevronDown className="h-5 w-5 text-white/40" /> : <ChevronRight className="h-5 w-5 text-white/40" />}
      </button>

      {expanded && (
        <div className="border-t border-white/10 px-4 sm:px-5 py-3 space-y-4">
          {section.steps.map((step, i) => (
            <div key={i} className="flex gap-3">
              <div className="shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs text-white/50 mt-0.5">
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-white">{step.title}</h4>
                <p className="text-xs sm:text-sm text-white/50 mt-0.5">{step.description}</p>
                {step.code && (
                  <div className="mt-2 relative group">
                    <pre className="text-xs bg-black/50 border border-white/10 rounded-lg p-3 overflow-x-auto text-green-400 font-mono">
                      {step.code}
                    </pre>
                    <button
                      onClick={() => navigator.clipboard.writeText(step.code!)}
                      className="absolute top-2 right-2 p-1.5 rounded-md bg-white/10 text-white/40 hover:text-white hover:bg-white/20 transition-colors opacity-0 group-hover:opacity-100"
                      title="Copy"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                {step.link && (
                  <a
                    href={step.link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {step.link.label}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export function GetStartedPage() {
  const [currentStep, setCurrentStep] = useState<Step>("hosting");
  const [hosting, setHosting] = useState<HostingChoice | null>(null);
  const [displays, setDisplays] = useState<DisplayChoice[]>([]);
  const [features, setFeatures] = useState<FeatureChoice[]>(["calendar", "weather"]);
  const [mobile, setMobile] = useState<MobileChoice | null>(null);

  const currentIndex = STEPS.indexOf(currentStep);

  const canProceed = () => {
    switch (currentStep) {
      case "hosting": return hosting !== null;
      case "display": return displays.length > 0;
      case "features": return features.length > 0;
      case "mobile": return mobile !== null;
      default: return false;
    }
  };

  const next = () => {
    const nextStep = STEPS[currentIndex + 1];
    if (nextStep) setCurrentStep(nextStep);
  };

  const back = () => {
    const prevStep = STEPS[currentIndex - 1];
    if (prevStep) setCurrentStep(prevStep);
  };

  const toggleDisplay = (id: DisplayChoice) => {
    setDisplays((prev) => prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]);
  };

  const toggleFeature = (id: FeatureChoice) => {
    setFeatures((prev) => prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]);
  };

  const results = currentStep === "results" && hosting
    ? generateResults(hosting, displays, features, mobile || "none")
    : [];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/40 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Calendar className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">OpenFrame</span>
          </div>
          <a href="/login" className="text-sm text-white/50 hover:text-white transition-colors">
            Already have an account? Sign in
          </a>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        <StepIndicator steps={STEPS} currentStep={currentStep} />

        {/* Step 1: Hosting */}
        {currentStep === "hosting" && (
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">How do you plan to host?</h1>
            <p className="text-white/50 mb-6 sm:mb-8">Choose where OpenFrame will run. You can always change this later.</p>
            <div className="space-y-3">
              {HOSTING_OPTIONS.map((option) => (
                <SelectionCard
                  key={option.id}
                  option={option}
                  selected={hosting === option.id}
                  onToggle={() => setHosting(option.id as HostingChoice)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Display */}
        {currentStep === "display" && (
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">What will you display on?</h1>
            <p className="text-white/50 mb-6 sm:mb-8">Select all the devices you plan to use. You can add more later.</p>
            <div className="space-y-3">
              {DISPLAY_OPTIONS.map((option) => (
                <SelectionCard
                  key={option.id}
                  option={option}
                  selected={displays.includes(option.id as DisplayChoice)}
                  onToggle={() => toggleDisplay(option.id as DisplayChoice)}
                  multi
                />
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Features */}
        {currentStep === "features" && (
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">What features matter most?</h1>
            <p className="text-white/50 mb-6 sm:mb-8">Select the features you want. You can enable or disable any of these later.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FEATURE_OPTIONS.map((option) => (
                <SelectionCard
                  key={option.id}
                  option={option}
                  selected={features.includes(option.id as FeatureChoice)}
                  onToggle={() => toggleFeature(option.id as FeatureChoice)}
                  multi
                />
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Mobile */}
        {currentStep === "mobile" && (
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">Do you want mobile control?</h1>
            <p className="text-white/50 mb-6 sm:mb-8">Control your displays and manage content from your phone.</p>
            <div className="space-y-3">
              {MOBILE_OPTIONS.map((option) => (
                <SelectionCard
                  key={option.id}
                  option={option}
                  selected={mobile === option.id}
                  onToggle={() => setMobile(option.id as MobileChoice)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Step 5: Results */}
        {currentStep === "results" && (
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">Your Personalized Setup Guide</h1>
            <p className="text-white/50 mb-6 sm:mb-8">
              Follow these steps to get OpenFrame running. Click any section to expand or collapse it.
            </p>
            <div className="space-y-4">
              {results.map((section, i) => (
                <ResultSection key={i} section={section} index={i} />
              ))}
            </div>

            {/* Summary badges */}
            <div className="mt-8 p-4 rounded-xl bg-white/5 border border-white/10">
              <h4 className="text-sm font-medium text-white/60 mb-3">Your selections</h4>
              <div className="flex flex-wrap gap-2">
                <span className="px-2.5 py-1 rounded-full bg-primary/20 text-primary text-xs font-medium">
                  {hosting === "cloud" ? "Cloud Hosted" : hosting === "self-hosted" ? "Self-Hosted" : "Undecided"}
                </span>
                {displays.map((d) => (
                  <span key={d} className="px-2.5 py-1 rounded-full bg-white/10 text-white/60 text-xs">
                    {DISPLAY_OPTIONS.find((o) => o.id === d)?.label}
                  </span>
                ))}
                {features.map((f) => (
                  <span key={f} className="px-2.5 py-1 rounded-full bg-white/10 text-white/60 text-xs">
                    {FEATURE_OPTIONS.find((o) => o.id === f)?.label}
                  </span>
                ))}
                <span className="px-2.5 py-1 rounded-full bg-white/10 text-white/60 text-xs">
                  {mobile === "companion-app" ? "Companion App" : mobile === "web-only" ? "Web Mobile" : "No Mobile"}
                </span>
              </div>
            </div>

            {/* Start over */}
            <div className="mt-6 text-center">
              <button
                onClick={() => { setCurrentStep("hosting"); }}
                className="text-sm text-white/40 hover:text-white transition-colors"
              >
                Start over with different choices
              </button>
            </div>
          </div>
        )}

        {/* Navigation */}
        {currentStep !== "results" && (
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/10">
            <button
              onClick={back}
              disabled={currentIndex === 0}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                currentIndex === 0
                  ? "text-white/20 cursor-not-allowed"
                  : "text-white/60 hover:text-white hover:bg-white/10"
              )}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <button
              onClick={next}
              disabled={!canProceed()}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all",
                canProceed()
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
                  : "bg-white/10 text-white/30 cursor-not-allowed"
              )}
            >
              {currentIndex === STEPS.length - 2 ? "See My Setup Guide" : "Continue"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
