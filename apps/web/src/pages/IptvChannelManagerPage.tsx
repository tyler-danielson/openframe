import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Check, Eye, EyeOff, Loader2, Pencil, Play, Star, Tv, X,
} from "lucide-react";
import { api } from "../services/api";
import { Button } from "../components/ui/Button";
import { cn } from "../lib/utils";

export function IptvChannelManagerPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const serverId = searchParams.get("serverId") || undefined;
  const serverName = searchParams.get("serverName") || undefined;
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showHiddenOnly, setShowHiddenOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "category">("name");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [previewChannelId, setPreviewChannelId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ["iptv-categories", serverId],
    queryFn: () => api.getIptvCategories(serverId),
  });

  const { data: channels = [], isLoading } = useQuery({
    queryKey: ["iptv-channels-manage", serverId, selectedCategory, search, showHiddenOnly],
    queryFn: () => api.getIptvChannels({
      serverId,
      categoryId: selectedCategory || undefined,
      search: search || undefined,
      includeHidden: true,
    }),
  });

  const { data: favorites = [] } = useQuery({
    queryKey: ["iptv-favorites"],
    queryFn: () => api.getIptvFavorites(),
  });

  const { data: hiddenStats } = useQuery({
    queryKey: ["iptv-hidden-stats"],
    queryFn: () => api.getIptvHiddenStats(),
  });

  const favoriteIds = new Set(favorites.map((f) => f.id));

  const toggleFavorite = useMutation({
    mutationFn: async ({ channelId, isFavorite }: { channelId: string; isFavorite: boolean }) => {
      if (isFavorite) {
        await api.removeIptvFavorite(channelId);
      } else {
        await api.addIptvFavorite(channelId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["iptv-favorites"] });
      queryClient.invalidateQueries({ queryKey: ["iptv-channels"] });
    },
  });

  const bulkVisibility = useMutation({
    mutationFn: (data: { channelIds?: string[]; categoryId?: string; isHidden: boolean }) =>
      api.bulkUpdateIptvChannelVisibility(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["iptv-channels"] });
      queryClient.invalidateQueries({ queryKey: ["iptv-channels-manage"] });
      queryClient.invalidateQueries({ queryKey: ["iptv-hidden-stats"] });
      queryClient.invalidateQueries({ queryKey: ["iptv-categories"] });
      setSelectedIds(new Set());
    },
  });

  const displayedChannels = useMemo(() => {
    let result = [...channels];

    if (showHiddenOnly) {
      result = result.filter((ch) => ch.isHidden);
    }

    if (showFavoritesOnly) {
      result = result.filter((ch) => favoriteIds.has(ch.id));
    }

    if (sortBy === "name") {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "category") {
      result.sort((a, b) =>
        (a.categoryName || "").localeCompare(b.categoryName || "")
      );
    }

    return result.slice(0, 500);
  }, [channels, showFavoritesOnly, showHiddenOnly, favoriteIds, sortBy]);

  const allDisplayedSelected = displayedChannels.length > 0 && displayedChannels.every((ch) => selectedIds.has(ch.id));

  const toggleSelectAll = () => {
    if (allDisplayedSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayedChannels.map((ch) => ch.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleHideSelected = () => {
    if (selectedIds.size === 0) return;
    bulkVisibility.mutate({ channelIds: Array.from(selectedIds), isHidden: true });
  };

  const handleUnhideSelected = () => {
    if (selectedIds.size === 0) return;
    bulkVisibility.mutate({ channelIds: Array.from(selectedIds), isHidden: false });
  };

  const handleHideCategory = () => {
    if (!selectedCategory) return;
    bulkVisibility.mutate({ categoryId: selectedCategory, isHidden: true });
  };

  const handleUnhideCategory = () => {
    if (!selectedCategory) return;
    bulkVisibility.mutate({ categoryId: selectedCategory, isHidden: false });
  };

  const handlePreview = async (channelId: string) => {
    if (previewChannelId === channelId) {
      setPreviewChannelId(null);
      setPreviewUrl(null);
      return;
    }
    setPreviewChannelId(channelId);
    setPreviewUrl(null);
    setPreviewLoading(true);
    try {
      const result = await api.getIptvChannelStream(channelId);
      setPreviewUrl(result.streamUrl);
    } catch {
      setPreviewUrl(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/settings/connections?service=iptv"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to IPTV Settings
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Channel Manager{serverName && <span className="text-muted-foreground font-normal text-lg ml-2">— {serverName}</span>}
          </h1>
          <p className="text-sm text-muted-foreground">
            {channels.length} channels
            {favorites.length > 0 && <> &middot; {favorites.length} favorites</>}
            {hiddenStats && hiddenStats.totalHidden > 0 && (
              <> &middot; {hiddenStats.totalHidden} hidden</>
            )}
          </p>
        </div>
        <Button
          variant={bulkMode ? "default" : "outline"}
          size="sm"
          onClick={() => {
            setBulkMode(!bulkMode);
            setSelectedIds(new Set());
          }}
        >
          {bulkMode ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Done
            </>
          ) : (
            <>
              <Pencil className="mr-2 h-4 w-4" />
              Bulk Edit
            </>
          )}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search channels..."
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>

        <select
          value={selectedCategory || ""}
          onChange={(e) => setSelectedCategory(e.target.value || null)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm min-w-[150px]"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name} ({cat.channelCount ?? 0})
            </option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as "name" | "category")}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="name">Sort by Name</option>
          <option value="category">Sort by Category</option>
        </select>

        <Button
          variant={showFavoritesOnly ? "default" : "outline"}
          size="sm"
          onClick={() => { setShowFavoritesOnly(!showFavoritesOnly); setShowHiddenOnly(false); }}
          className="whitespace-nowrap"
        >
          <Star className={`mr-2 h-4 w-4 ${showFavoritesOnly ? "fill-current" : ""}`} />
          Favorites
        </Button>

        <Button
          variant={showHiddenOnly ? "default" : "outline"}
          size="sm"
          onClick={() => { setShowHiddenOnly(!showHiddenOnly); setShowFavoritesOnly(false); }}
          className="whitespace-nowrap"
        >
          <EyeOff className="mr-2 h-4 w-4" />
          Hidden{hiddenStats?.totalHidden ? ` (${hiddenStats.totalHidden})` : ""}
        </Button>
      </div>

      {/* Bulk actions bar */}
      {bulkMode && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <span className="text-sm font-medium text-primary">
            {selectedIds.size} selected
          </span>
          <div className="flex-1" />
          {selectedCategory && (
            <>
              <Button variant="outline" size="sm" onClick={handleHideCategory} disabled={bulkVisibility.isPending}>
                <EyeOff className="mr-1.5 h-3.5 w-3.5" />
                Hide Entire Category
              </Button>
              <Button variant="outline" size="sm" onClick={handleUnhideCategory} disabled={bulkVisibility.isPending}>
                <Eye className="mr-1.5 h-3.5 w-3.5" />
                Unhide Entire Category
              </Button>
              <div className="w-px h-6 bg-border" />
            </>
          )}
          <Button variant="outline" size="sm" onClick={handleHideSelected} disabled={selectedIds.size === 0 || bulkVisibility.isPending}>
            <EyeOff className="mr-1.5 h-3.5 w-3.5" />
            Hide Selected
          </Button>
          <Button variant="outline" size="sm" onClick={handleUnhideSelected} disabled={selectedIds.size === 0 || bulkVisibility.isPending}>
            <Eye className="mr-1.5 h-3.5 w-3.5" />
            Unhide Selected
          </Button>
          {bulkVisibility.isPending && (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          )}
        </div>
      )}

      {/* Results info */}
      <p className="text-sm text-muted-foreground">
        Showing {displayedChannels.length} of {showFavoritesOnly ? favorites.length : showHiddenOnly ? (hiddenStats?.totalHidden ?? 0) : channels.length} channels
        {displayedChannels.length === 500 && " (limited to 500)"}
      </p>

      {/* Channel list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : displayedChannels.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <Tv className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            {showFavoritesOnly ? "No favorite channels" : showHiddenOnly ? "No hidden channels" : "No channels found"}
          </p>
        </div>
      ) : (
        <div className="overflow-y-auto rounded-lg border border-border" style={{ maxHeight: "calc(100vh - 320px)" }}>
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted z-10">
              <tr>
                {bulkMode && (
                  <th className="px-3 py-2 w-10">
                    <input
                      type="checkbox"
                      checked={allDisplayedSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                  </th>
                )}
                <th className="px-3 py-2 text-left font-medium">Channel</th>
                <th className="px-3 py-2 text-left font-medium">Category</th>
                <th className="px-3 py-2 text-center font-medium w-16">Visible</th>
                <th className="px-3 py-2 text-center font-medium w-16">Preview</th>
                <th className="px-3 py-2 text-center font-medium w-16">Favorite</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {displayedChannels.map((channel) => {
                const isFav = favoriteIds.has(channel.id);
                const isHidden = !!channel.isHidden;
                const isSelected = selectedIds.has(channel.id);
                return (
                  <React.Fragment key={channel.id}>
                    <tr
                      className={cn(
                        "hover:bg-muted/50",
                        isHidden && "opacity-50",
                        isSelected && bulkMode && "bg-primary/5"
                      )}
                      onClick={bulkMode ? () => toggleSelect(channel.id) : undefined}
                      style={bulkMode ? { cursor: "pointer" } : undefined}
                    >
                      {bulkMode && (
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(channel.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="h-4 w-4 rounded border-border accent-primary"
                          />
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          {channel.logoUrl && (
                            <img
                              src={channel.logoUrl}
                              alt=""
                              className="h-6 w-6 rounded object-contain bg-black"
                              onError={(e) => (e.currentTarget.style.display = "none")}
                            />
                          )}
                          <span className="truncate max-w-[300px]">{channel.name}</span>
                          {isHidden && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                              hidden
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        <span className="truncate max-w-[200px] block">{channel.categoryName || "-"}</span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            bulkVisibility.mutate({ channelIds: [channel.id], isHidden: !isHidden });
                          }}
                          disabled={bulkVisibility.isPending}
                          className={`p-1 rounded hover:bg-muted ${isHidden ? "text-muted-foreground" : "text-primary"}`}
                          title={isHidden ? "Show channel" : "Hide channel"}
                        >
                          {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePreview(channel.id);
                          }}
                          className={`p-1 rounded hover:bg-muted ${previewChannelId === channel.id ? "text-primary" : "text-muted-foreground"}`}
                          title="Preview stream"
                        >
                          {previewLoading && previewChannelId === channel.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite.mutate({ channelId: channel.id, isFavorite: isFav });
                          }}
                          disabled={toggleFavorite.isPending}
                          className={`p-1 rounded hover:bg-muted ${isFav ? "text-yellow-500" : "text-muted-foreground"}`}
                          title={isFav ? "Remove favorite" : "Add favorite"}
                        >
                          <Star className={`h-4 w-4 ${isFav ? "fill-current" : ""}`} />
                        </button>
                      </td>
                    </tr>
                    {previewChannelId === channel.id && previewUrl && (
                      <tr>
                        <td colSpan={bulkMode ? 6 : 5} className="p-0">
                          <div className="bg-black relative" style={{ height: 240 }}>
                            <video
                              src={previewUrl}
                              autoPlay
                              muted
                              controls
                              className="w-full h-full object-contain"
                              onError={() => {
                                setPreviewUrl(null);
                                setPreviewChannelId(null);
                              }}
                            />
                            <button
                              onClick={() => { setPreviewChannelId(null); setPreviewUrl(null); }}
                              className="absolute top-2 right-2 p-1 rounded bg-black/60 text-white hover:bg-black/80"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
