import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Loader2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../../services/api";
import type { SportsTeam } from "@openframe/shared";

// Sport/League configuration with icons
const SPORTS = [
  { sport: "football", league: "nfl", label: "NFL", icon: "🏈" },
  { sport: "basketball", league: "nba", label: "NBA", icon: "🏀" },
  { sport: "hockey", league: "nhl", label: "NHL", icon: "🏒" },
  { sport: "hockey", league: "olympics-mens-ice-hockey", label: "Olympics (M)", icon: "🏒" },
  { sport: "hockey", league: "olympics-womens-ice-hockey", label: "Olympics (W)", icon: "🏒" },
  { sport: "baseball", league: "mlb", label: "MLB", icon: "⚾" },
] as const;

interface TeamSelectorProps {
  onTeamAdded?: () => void;
}

export function TeamSelector({ onTeamAdded }: TeamSelectorProps) {
  const queryClient = useQueryClient();
  const [selectedSport, setSelectedSport] = useState<string>("football");
  const [selectedLeague, setSelectedLeague] = useState<string>("nfl");
  const [searchQuery, setSearchQuery] = useState("");
  const [addingTeamId, setAddingTeamId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch teams for selected league
  const { data: teams = [], isLoading: isLoadingTeams } = useQuery({
    queryKey: ["sports-teams", selectedSport, selectedLeague],
    queryFn: () => api.getSportsTeams(selectedSport, selectedLeague),
    enabled: !!selectedSport && !!selectedLeague,
  });

  // Fetch existing favorites to filter out
  const { data: favorites = [] } = useQuery({
    queryKey: ["favorite-teams"],
    queryFn: () => api.getFavoriteTeams(),
  });

  // Add team mutation
  const addTeam = useMutation({
    mutationFn: (team: SportsTeam) =>
      api.addFavoriteTeam({
        sport: team.sport,
        league: team.league,
        teamId: team.id,
        teamName: team.name,
        teamAbbreviation: team.abbreviation,
        teamLogo: team.logo || undefined,
        teamColor: team.color || undefined,
      }),
    onMutate: (team) => {
      setAddingTeamId(team.id);
      setError(null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorite-teams"] });
      onTeamAdded?.();
      // Small delay to let animation complete
      setTimeout(() => setAddingTeamId(null), 300);
    },
    onError: (err) => {
      setAddingTeamId(null);
      const message = err instanceof Error ? err.message : "Failed to add team";
      setError(message);
      // Clear error after 5 seconds
      setTimeout(() => setError(null), 5000);
    },
  });

  // Filter teams by search and exclude already-favorited
  const filteredTeams = useMemo(() => {
    const favoriteTeamIds = new Set(
      favorites
        .filter((f) => f.league === selectedLeague)
        .map((f) => f.teamId)
    );

    return teams
      .filter((team) => !favoriteTeamIds.has(team.id))
      .filter(
        (team) =>
          !searchQuery ||
          team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          team.abbreviation.toLowerCase().includes(searchQuery.toLowerCase())
      );
  }, [teams, favorites, selectedLeague, searchQuery]);

  // Handle sport selection
  const handleSportSelect = (sport: string, league: string) => {
    setSelectedSport(sport);
    setSelectedLeague(league);
    setSearchQuery("");
  };

  return (
    <div className="space-y-4">
      {/* Sport toggle buttons */}
      <div className="flex gap-2">
        {SPORTS.map((s) => (
          <button
            key={s.league}
            onClick={() => handleSportSelect(s.sport, s.league)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-lg border-2 transition-all ${
              selectedLeague === s.league
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card hover:border-muted-foreground/50 text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="text-2xl">{s.icon}</span>
            <span className="text-sm font-medium">{s.label}</span>
          </button>
        ))}
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search teams..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-border bg-background pl-10 pr-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      {/* Teams grid */}
      <div className="min-h-[200px]">
        {isLoadingTeams ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredTeams.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            {searchQuery
              ? "No teams match your search"
              : teams.length === favorites.filter((f) => f.league === selectedLeague).length
              ? "All teams added!"
              : "No teams available"}
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-2">
            <AnimatePresence mode="popLayout">
              {filteredTeams.map((team) => (
                <motion.button
                  key={team.id}
                  layout
                  initial={{ opacity: 1, scale: 1 }}
                  exit={{
                    opacity: 0,
                    scale: 0.5,
                    x: 100,
                    transition: { duration: 0.3 }
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => addTeam.mutate(team)}
                  disabled={addTeam.isPending && addingTeamId === team.id}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg border border-border bg-card hover:border-primary hover:bg-primary/5 transition-colors ${
                    addingTeamId === team.id ? "opacity-50" : ""
                  }`}
                  title={team.name}
                >
                  {team.logo ? (
                    <img
                      src={team.logo}
                      alt={team.name}
                      className="h-10 w-10 object-contain"
                    />
                  ) : (
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: team.color || "#6366F1" }}
                    >
                      {team.abbreviation.slice(0, 2)}
                    </div>
                  )}
                  <span className="text-xs font-medium text-center truncate w-full">
                    {team.abbreviation}
                  </span>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
