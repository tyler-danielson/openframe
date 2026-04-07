import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { api } from "../../services/api";

interface Profile {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

interface Props {
  habit: any;
  profiles: Profile[];
  onClose: () => void;
}

export function HabitCheckIn({ habit, profiles, onClose }: Props) {
  const [completed, setCompleted] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const completeMutation = useMutation({
    mutationFn: (profileId: string) =>
      api.completeHabit(habit.id, { profileId }),
    onSuccess: (_data, profileId) => {
      setCompleted(profileId);
      queryClient.invalidateQueries({ queryKey: ["habits"] });
      queryClient.invalidateQueries({ queryKey: ["gamification"] });
      setTimeout(onClose, 2000);
    },
  });

  // Auto-dismiss after 10 seconds
  useEffect(() => {
    const timer = setTimeout(onClose, 10000);
    return () => clearTimeout(timer);
  }, [onClose]);

  // For personal (non-shared) habits, complete immediately for the habit owner
  useEffect(() => {
    if (!habit.isShared && habit.profileId) {
      completeMutation.mutate(habit.profileId);
    }
  }, []);

  if (!habit.isShared && habit.profileId) {
    // Show success animation for personal habits
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-card border border-border rounded-2xl shadow-2xl p-8 text-center animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-primary" />
          </div>
          <p className="text-lg font-semibold">
            {habit.icon} {habit.name}
          </p>
          <p className="text-primary font-medium mt-1">+10 pts</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{habit.icon || "📋"}</span>
            <span className="font-semibold">{habit.name}</span>
          </div>
          {completed && (
            <span className="text-primary font-medium">Done!</span>
          )}
        </div>

        {/* Profile picker */}
        <div className="p-6">
          <p className="text-sm text-muted-foreground mb-4">
            Who completed this?
          </p>
          <div className="grid grid-cols-2 gap-3">
            {profiles.map((profile) => (
              <button
                key={profile.id}
                onClick={() => completeMutation.mutate(profile.id)}
                disabled={completed !== null}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all min-h-[80px] ${
                  completed === profile.id
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/40 hover:bg-primary/5"
                }`}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-semibold"
                  style={{
                    backgroundColor: profile.color || "#6366f1",
                  }}
                >
                  {profile.icon || profile.name.charAt(0)}
                </div>
                <span className="text-sm font-medium">{profile.name}</span>
                {completed === profile.id && (
                  <span className="text-xs text-primary font-medium">
                    +10 pts
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Cancel */}
        <div className="px-6 pb-4 flex justify-center">
          <button
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
