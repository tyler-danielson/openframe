import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Tv, Star, Clock, Search } from "lucide-react";
import { api } from "../../../services/api";
import { Card } from "../../../components/ui/Card";
import { CompanionPageHeader } from "../components/CompanionPageHeader";

type TabType = "favorites" | "history" | "search";

export function CompanionIptvPage() {
  const [activeTab, setActiveTab] = useState<TabType>("favorites");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: favorites, isLoading: favLoading } = useQuery({
    queryKey: ["companion-iptv-favorites"],
    queryFn: () => api.getIptvFavorites(),
    staleTime: 30_000,
    enabled: activeTab === "favorites",
  });

  const { data: history, isLoading: histLoading } = useQuery({
    queryKey: ["companion-iptv-history"],
    queryFn: () => api.getIptvHistory(50),
    staleTime: 30_000,
    enabled: activeTab === "history",
  });

  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ["companion-iptv-search", searchQuery],
    queryFn: () => api.getIptvChannels({ search: searchQuery }),
    staleTime: 30_000,
    enabled: activeTab === "search" && searchQuery.length >= 2,
  });

  const tabs = [
    { id: "favorites" as const, label: "Favorites", icon: Star },
    { id: "history" as const, label: "History", icon: Clock },
    { id: "search" as const, label: "Search", icon: Search },
  ];

  const channels =
    activeTab === "favorites"
      ? favorites
      : activeTab === "history"
      ? history
      : searchResults;

  const isLoading =
    activeTab === "favorites" ? favLoading : activeTab === "history" ? histLoading : searchLoading;

  return (
    <div className="flex flex-col h-full">
      <CompanionPageHeader title="IPTV" backTo="/companion/more" />

      {/* Tabs */}
      <div className="px-4 py-2 flex gap-2 shrink-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-foreground hover:bg-primary/5"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Search input */}
      {activeTab === "search" && (
        <div className="px-4 py-2 shrink-0">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search channels..."
            className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
            autoFocus
          />
        </div>
      )}

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !channels || (channels as any[]).length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Tv className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">
              {activeTab === "search"
                ? searchQuery.length < 2
                  ? "Type to search"
                  : "No channels found"
                : activeTab === "favorites"
                ? "No favorites yet"
                : "No history yet"}
            </p>
          </div>
        ) : (
          (channels as any[]).map((channel: any) => (
            <Card key={channel.id} className="flex items-center gap-3 px-4 py-3">
              {channel.logoUrl ? (
                <img
                  src={channel.logoUrl}
                  alt=""
                  className="h-10 w-10 rounded-lg object-contain bg-black/5 shrink-0"
                />
              ) : (
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Tv className="h-5 w-5 text-primary" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{channel.name}</div>
                {channel.categoryName && (
                  <div className="text-xs text-muted-foreground">{channel.categoryName}</div>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
