import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  ArrowRight,
  ArrowLeft,
  MapPin,
  Smartphone,
  Wrench,
  Loader2,
  Navigation,
} from "lucide-react";
import type { UserMode } from "@openframe/shared";
import { Button } from "../components/ui/Button";
import { api } from "../services/api";
import { useAuthStore } from "../stores/auth";

type Step = "welcome" | "location" | "mode";

export function OnboardingWizardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [step, setStep] = useState<Step>("welcome");
  const [displayName, setDisplayName] = useState(user?.name ?? "");
  const [locationSearch, setLocationSearch] = useState("");
  const [locationStatus, setLocationStatus] = useState<"idle" | "searching" | "success" | "detecting" | "error">("idle");
  const [locationError, setLocationError] = useState<string | null>(null);
  const [geocoded, setGeocoded] = useState<{ latitude: string; longitude: string; address: string } | null>(null);
  const [selectedMode, setSelectedMode] = useState<UserMode>("simple");
  const [saving, setSaving] = useState(false);

  const handleLocationLookup = async () => {
    if (!locationSearch.trim()) return;
    setLocationStatus("searching");
    setLocationError(null);
    try {
      const result = await api.geocodeAddress(locationSearch);
      setGeocoded({ latitude: result.latitude, longitude: result.longitude, address: result.formattedAddress });
      setLocationSearch(result.formattedAddress);
      setLocationStatus("success");
    } catch (err) {
      setLocationStatus("error");
      setLocationError(err instanceof Error ? err.message : "Failed to find location");
    }
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      return;
    }
    setLocationStatus("detecting");
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const result = await api.geocodeAddress(`${position.coords.latitude},${position.coords.longitude}`);
          setGeocoded({ latitude: result.latitude, longitude: result.longitude, address: result.formattedAddress });
          setLocationSearch(result.formattedAddress);
          setLocationStatus("success");
        } catch {
          setGeocoded({
            latitude: String(position.coords.latitude),
            longitude: String(position.coords.longitude),
            address: `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`,
          });
          setLocationSearch(`${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`);
          setLocationStatus("success");
        }
      },
      () => {
        setLocationStatus("error");
        setLocationError("Unable to detect your location. Please search manually.");
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      // Save location if set
      if (geocoded) {
        await api.updateCategorySettings("home", {
          address: geocoded.address,
          latitude: geocoded.latitude,
          longitude: geocoded.longitude,
        });
      }

      // Save user mode + onboarding completed
      await api.updatePreferences({
        userMode: selectedMode,
        onboardingCompleted: true,
      });

      // Update local state
      if (user) {
        setUser({
          ...user,
          preferences: {
            ...user.preferences,
            userMode: selectedMode,
            onboardingCompleted: true,
          },
        });
      }

      navigate("/calendar", { replace: true });
    } catch (err) {
      console.error("Onboarding error:", err);
      setSaving(false);
    }
  };

  const stepDots = ["welcome", "location", "mode"] as const;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-xl">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {stepDots.map((s) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all ${
                s === step ? "w-8 bg-primary" : "w-2 bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Welcome + Name */}
        {step === "welcome" && (
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Calendar className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight text-primary">
                Welcome to OpenFrame
              </h1>
              <p className="text-lg text-muted-foreground">
                Let's get you set up in just a moment
              </p>
            </div>
            <div className="w-full max-w-sm space-y-2">
              <label className="block text-sm font-medium text-left">
                What should we call you?
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="w-full h-11 px-4 rounded-lg border border-border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                autoFocus
              />
            </div>
            <Button
              size="lg"
              className="gap-2"
              onClick={() => setStep("location")}
              disabled={!displayName.trim()}
            >
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step 2: Home Location */}
        {step === "location" && (
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <MapPin className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight text-primary">
                Where's home?
              </h1>
              <p className="text-muted-foreground">
                We use this for weather and time zone
              </p>
            </div>
            <div className="w-full max-w-sm space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={locationSearch}
                  onChange={(e) => {
                    setLocationSearch(e.target.value);
                    setLocationStatus("idle");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleLocationLookup()}
                  placeholder="Search for a city..."
                  className="flex-1 h-11 px-4 rounded-lg border border-border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
                <Button
                  onClick={handleLocationLookup}
                  disabled={!locationSearch.trim() || locationStatus === "searching"}
                  className="h-11 px-4"
                >
                  {locationStatus === "searching" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Search"
                  )}
                </Button>
              </div>
              <button
                type="button"
                onClick={handleDetectLocation}
                disabled={locationStatus === "detecting"}
                className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors mx-auto"
              >
                {locationStatus === "detecting" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Navigation className="h-3.5 w-3.5" />
                )}
                Use my current location
              </button>
              {locationStatus === "success" && geocoded && (
                <p className="text-sm text-primary font-medium">
                  {geocoded.address}
                </p>
              )}
              {locationError && (
                <p className="text-sm text-red-500">{locationError}</p>
              )}
            </div>
            <div className="flex items-center gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep("welcome")} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button
                size="lg"
                className="gap-2"
                onClick={() => setStep("mode")}
              >
                {geocoded ? "Next" : "Skip for now"} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Mode Selection */}
        {step === "mode" && (
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight text-primary">
                How do you want to use OpenFrame?
              </h1>
              <p className="text-muted-foreground">
                Choose your experience level
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg">
              <button
                type="button"
                onClick={() => setSelectedMode("simple")}
                className={`relative flex flex-col items-center gap-3 rounded-xl border-2 p-6 text-center transition-all ${
                  selectedMode === "simple"
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-border hover:border-primary/40 hover:bg-accent"
                }`}
              >
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
                  selectedMode === "simple" ? "bg-primary/10" : "bg-muted"
                }`}>
                  <Smartphone className={`h-7 w-7 ${selectedMode === "simple" ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <p className="font-semibold text-lg">Simple</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Calendar, tasks, weather, photos. Just the essentials.
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Perfect for family members who want it to just work.
                  </p>
                </div>
                {selectedMode === "simple" && (
                  <div className="absolute top-3 right-3 h-3 w-3 rounded-full bg-primary" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setSelectedMode("advanced")}
                className={`relative flex flex-col items-center gap-3 rounded-xl border-2 p-6 text-center transition-all ${
                  selectedMode === "advanced"
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-border hover:border-primary/40 hover:bg-accent"
                }`}
              >
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
                  selectedMode === "advanced" ? "bg-primary/10" : "bg-muted"
                }`}>
                  <Wrench className={`h-7 w-7 ${selectedMode === "advanced" ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <p className="font-semibold text-lg">Advanced</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Everything — smart home, media, AI, custom screens, and more.
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    For power users who want full control.
                  </p>
                </div>
                {selectedMode === "advanced" && (
                  <div className="absolute top-3 right-3 h-3 w-3 rounded-full bg-primary" />
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              You can change this anytime in Settings.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep("location")} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button
                size="lg"
                className="gap-2"
                onClick={handleFinish}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Setting up...
                  </>
                ) : (
                  <>
                    Get Started <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
