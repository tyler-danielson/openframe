import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import * as Popover from "@radix-ui/react-popover";
import * as LucideIcons from "lucide-react";
import { Search, ChevronDown, Upload, Trash2, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ICON_CATEGORIES, ALL_CURATED_ICONS } from "../../data/curated-icons";
import { isCustomIcon, resolveLucideIcon } from "../../lib/icon-utils";
import { DashboardIcon } from "./DashboardIcon";
import { api } from "../../services/api";
import { cn } from "../../lib/utils";

interface IconPickerProps {
  value: string;
  onChange: (icon: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"library" | "custom">("library");
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null) as React.RefObject<HTMLInputElement>;

  const handleSelect = useCallback(
    (icon: string) => {
      onChange(icon);
      setOpen(false);
      setSearch("");
    },
    [onChange]
  );

  // Focus search input when popover opens
  useEffect(() => {
    if (open && tab === "library") {
      // Small delay so popover renders first
      const t = setTimeout(() => searchRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open, tab]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[44px]",
            "hover:bg-accent/50 transition-colors"
          )}
        >
          <DashboardIcon icon={value} className="h-5 w-5 text-primary" />
          <span className="text-muted-foreground truncate max-w-[100px]">
            {isCustomIcon(value) ? "Custom" : value}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-auto" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={4}
          className="z-50 w-[320px] rounded-lg border border-border bg-card shadow-xl animate-in fade-in-0 zoom-in-95"
        >
          {/* Tab bar */}
          <div className="flex border-b border-border">
            <button
              className={cn(
                "flex-1 px-3 py-2 text-sm font-medium transition-colors",
                tab === "library"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setTab("library")}
            >
              Library
            </button>
            <button
              className={cn(
                "flex-1 px-3 py-2 text-sm font-medium transition-colors",
                tab === "custom"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setTab("custom")}
            >
              Custom
            </button>
          </div>

          {tab === "library" ? (
            <LibraryTab
              searchRef={searchRef}
              search={search}
              onSearchChange={setSearch}
              selected={value}
              onSelect={handleSelect}
            />
          ) : (
            <CustomTab selected={value} onSelect={handleSelect} />
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// --- Library Tab ---

function LibraryTab({
  searchRef,
  search,
  onSearchChange,
  selected,
  onSelect,
}: {
  searchRef: React.RefObject<HTMLInputElement>;
  search: string;
  onSearchChange: (v: string) => void;
  selected: string;
  onSelect: (icon: string) => void;
}) {
  const filteredCategories = useMemo(() => {
    if (!search.trim()) return ICON_CATEGORIES;
    const q = search.toLowerCase();
    return ICON_CATEGORIES.map((cat) => ({
      ...cat,
      icons: cat.icons.filter((name) => name.toLowerCase().includes(q)),
    })).filter((cat) => cat.icons.length > 0);
  }, [search]);

  // When searching, also search all lucide exports not in curated list
  const extraResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    const curatedSet = new Set(ALL_CURATED_ICONS);
    const icons = LucideIcons as Record<string, unknown>;
    const results: string[] = [];
    for (const key of Object.keys(icons)) {
      if (
        typeof icons[key] === "function" &&
        key.length > 0 &&
        key[0] === key[0]!.toUpperCase() &&
        !curatedSet.has(key) &&
        key.toLowerCase().includes(q) &&
        // Skip non-icon exports
        key !== "createLucideIcon" &&
        key !== "default" &&
        !key.endsWith("Icon")
      ) {
        results.push(key);
        if (results.length >= 30) break;
      }
    }
    return results;
  }, [search]);

  return (
    <div className="flex flex-col max-h-[400px]">
      {/* Search */}
      <div className="p-2 border-b border-border/50">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search icons..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-md border border-border bg-background pl-8 pr-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Icon grid */}
      <div className="overflow-y-auto p-2 space-y-3">
        {filteredCategories.map((cat) => (
          <div key={cat.id}>
            <p className="text-xs font-medium text-primary/80 mb-1.5 px-1">
              {cat.label}
            </p>
            <div className="grid grid-cols-7 gap-1">
              {cat.icons.map((name) => (
                <IconButton
                  key={name}
                  name={name}
                  isSelected={selected === name}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </div>
        ))}

        {extraResults.length > 0 && (
          <div>
            <p className="text-xs font-medium text-primary/80 mb-1.5 px-1">
              More results
            </p>
            <div className="grid grid-cols-7 gap-1">
              {extraResults.map((name) => (
                <IconButton
                  key={name}
                  name={name}
                  isSelected={selected === name}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </div>
        )}

        {filteredCategories.length === 0 && extraResults.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No icons found
          </p>
        )}
      </div>
    </div>
  );
}

function IconButton({
  name,
  isSelected,
  onSelect,
}: {
  name: string;
  isSelected: boolean;
  onSelect: (name: string) => void;
}) {
  const Icon = resolveLucideIcon(name);
  return (
    <button
      type="button"
      onClick={() => onSelect(name)}
      className={cn(
        "flex items-center justify-center rounded-md p-1.5 transition-colors",
        isSelected
          ? "bg-primary text-primary-foreground ring-2 ring-primary"
          : "text-foreground hover:bg-accent"
      )}
      title={name}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

// --- Custom Tab ---

function CustomTab({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (icon: string) => void;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: customIcons = [], isLoading } = useQuery({
    queryKey: ["custom-icons"],
    queryFn: () => api.listCustomIcons(),
  });

  const deleteMutation = useMutation({
    mutationFn: (filename: string) => api.deleteCustomIcon(filename),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-icons"] });
    },
  });

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploading(true);
      try {
        const result = await api.uploadIcon(file);
        queryClient.invalidateQueries({ queryKey: ["custom-icons"] });
        onSelect(result.icon);
      } catch (err) {
        console.error("Failed to upload icon:", err);
      } finally {
        setUploading(false);
        // Reset input so re-uploading same file works
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [onSelect, queryClient]
  );

  const handleDelete = useCallback(
    (icon: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const path = icon.slice("custom:".length);
      const filename = path.split("/").pop() ?? "";
      deleteMutation.mutate(filename);
      // If deleting the selected icon, clear it
      if (selected === icon) {
        onSelect("LayoutDashboard");
      }
    },
    [deleteMutation, selected, onSelect]
  );

  return (
    <div className="p-3 max-h-[400px] overflow-y-auto">
      <input
        ref={fileInputRef}
        type="file"
        accept=".svg,.png,.webp"
        className="hidden"
        onChange={handleUpload}
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className={cn(
          "w-full flex items-center justify-center gap-2 rounded-md border-2 border-dashed border-border px-3 py-3 text-sm",
          "text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors",
          uploading && "opacity-50 cursor-not-allowed"
        )}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        {uploading ? "Uploading..." : "Upload icon"}
      </button>
      <p className="text-xs text-muted-foreground mt-1 text-center">
        SVG, PNG, or WebP (max 1MB)
      </p>

      {isLoading && (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && customIcons.length > 0 && (
        <div className="grid grid-cols-5 gap-2 mt-3">
          {customIcons.map((icon) => (
            <div key={icon} className="relative group">
              <button
                type="button"
                onClick={() => onSelect(icon)}
                className={cn(
                  "flex items-center justify-center rounded-md p-2 w-full aspect-square transition-colors",
                  selected === icon
                    ? "bg-primary/10 ring-2 ring-primary"
                    : "hover:bg-accent"
                )}
              >
                <DashboardIcon icon={icon} className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={(e) => handleDelete(icon, e)}
                className="absolute -top-1 -right-1 hidden group-hover:flex items-center justify-center h-4 w-4 rounded-full bg-destructive text-destructive-foreground"
                title="Delete"
              >
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {!isLoading && customIcons.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No custom icons yet
        </p>
      )}
    </div>
  );
}
