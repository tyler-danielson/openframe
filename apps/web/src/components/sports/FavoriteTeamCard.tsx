import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";
import { api } from "../../services/api";
import type { FavoriteSportsTeam } from "@openframe/shared";

interface FavoriteTeamCardProps {
  team: FavoriteSportsTeam;
  index?: number;
}

export function FavoriteTeamCard({ team, index = 0 }: FavoriteTeamCardProps) {
  const queryClient = useQueryClient();

  // Remove team mutation
  const removeTeam = useMutation({
    mutationFn: () => api.removeFavoriteTeam(team.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorite-teams"] });
    },
  });

  // Toggle visibility mutation
  const toggleVisibility = useMutation({
    mutationFn: () => api.updateFavoriteTeam(team.id, { isVisible: !team.isVisible }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorite-teams"] });
      queryClient.invalidateQueries({ queryKey: ["todays-sports"] });
    },
  });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.5, x: -100 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.5 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={`relative group flex flex-col items-center gap-1 p-2 rounded-lg border border-border bg-card ${
        !team.isVisible ? "opacity-50" : ""
      }`}
    >
      {/* Remove button */}
      <button
        onClick={() => removeTeam.mutate()}
        disabled={removeTeam.isPending}
        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-destructive/90"
        title="Remove team"
      >
        <X className="h-3 w-3" />
      </button>

      {/* Visibility toggle button */}
      <button
        onClick={() => toggleVisibility.mutate()}
        disabled={toggleVisibility.isPending}
        className="absolute -top-1.5 -left-1.5 h-5 w-5 rounded-full bg-muted text-muted-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-muted/80"
        title={team.isVisible ? "Hide from ticker" : "Show in ticker"}
      >
        {team.isVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
      </button>

      {team.teamLogo ? (
        <img
          src={team.teamLogo}
          alt={team.teamName}
          className="h-10 w-10 object-contain"
        />
      ) : (
        <div
          className="h-10 w-10 rounded-full flex items-center justify-center text-white text-xs font-bold"
          style={{ backgroundColor: team.teamColor || "#6366F1" }}
        >
          {team.teamAbbreviation.slice(0, 2)}
        </div>
      )}
      <span className="text-xs font-medium text-center truncate w-full">
        {team.teamAbbreviation}
      </span>
      <span className="text-[10px] text-muted-foreground">
        {team.league.toUpperCase()}
      </span>
    </motion.div>
  );
}
