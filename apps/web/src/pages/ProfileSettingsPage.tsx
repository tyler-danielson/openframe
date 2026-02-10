import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, User } from "lucide-react";
import { api } from "../services/api";
import { Button } from "../components/ui/Button";
import { ProfileCalendarSettings } from "../components/profiles/ProfileCalendarSettings";
import { ProfileNewsSettings } from "../components/profiles/ProfileNewsSettings";
import { ProfileRemarkableSettings } from "../components/profiles/ProfileRemarkableSettings";

export function ProfileSettingsPage() {
  const { profileId } = useParams<{ profileId: string }>();
  const navigate = useNavigate();

  // Fetch profile details
  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", profileId],
    queryFn: () => api.getProfile(profileId!),
    enabled: !!profileId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Profile not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/profiles")}>
            Back to Profiles
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/profiles")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
            style={{ backgroundColor: profile.color ? `${profile.color}20` : "#E5E7EB" }}
          >
            {profile.icon || "👤"}
          </div>
          <div>
            <h1 className="text-xl font-bold">{profile.name} Settings</h1>
            <p className="text-sm text-muted-foreground">
              Configure calendars, news feeds, and reMarkable delivery
            </p>
          </div>
        </div>
      </div>

      {/* Settings sections */}
      <div className="space-y-8">
        {/* Calendars */}
        <section className="bg-card border border-border rounded-lg p-6">
          <ProfileCalendarSettings profileId={profileId!} />
        </section>

        {/* News Feeds */}
        <section className="bg-card border border-border rounded-lg p-6">
          <ProfileNewsSettings profileId={profileId!} />
        </section>

        {/* reMarkable */}
        <section className="bg-card border border-border rounded-lg p-6">
          <ProfileRemarkableSettings profileId={profileId!} />
        </section>
      </div>
    </div>
  );
}
