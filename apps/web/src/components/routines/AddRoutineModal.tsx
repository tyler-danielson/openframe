import { useState, useEffect, useRef } from "react";
import { getDay, getDate } from "date-fns";
import { X, Search } from "lucide-react";
import { Button } from "../ui/Button";
import { AdaptiveModalContent } from "../ui/AdaptiveModalContent";
import { AdaptiveDialog } from "../ui/AdaptiveDialog";
import { useAdaptiveModalLayout } from "../../hooks/useAdaptiveModalLayout";
import { RecurrenceEditor } from "./RecurrenceEditor";
import type { RoutineWithCompletions, FamilyProfile, RoutineFrequency, RecurrenceRule } from "@openframe/shared";

// Icon suggestions mapped by keyword
const ICON_MAP: [string[], string][] = [
  [["trash", "garbage", "rubbish", "bin", "waste"], "🗑️"],
  [["brush", "teeth", "dental", "tooth", "floss"], "🪥"],
  [["shower", "bath", "wash", "bathe"], "🚿"],
  [["bed", "sleep", "nap", "rest", "bedtime"], "🛏️"],
  [["wake", "alarm", "morning", "rise"], "⏰"],
  [["exercise", "workout", "gym", "fitness", "pushup", "situp"], "🏋️"],
  [["run", "running", "jog", "jogging", "sprint"], "🏃"],
  [["walk", "walking", "hike", "hiking", "stroll"], "🚶"],
  [["bike", "bicycle", "cycling", "cycle"], "🚴"],
  [["swim", "swimming", "pool"], "🏊"],
  [["yoga", "stretch", "meditat", "mindful", "zen"], "🧘"],
  [["read", "book", "study", "library"], "📖"],
  [["write", "journal", "diary", "note"], "📝"],
  [["homework", "assignment", "school", "learn", "class"], "📚"],
  [["cook", "cooking", "meal", "dinner", "lunch", "breakfast", "food", "recipe"], "🍳"],
  [["dish", "dishes", "plate", "wash dish", "clean dish"], "🍽️"],
  [["laundry", "clothes", "washing machine", "fold", "iron"], "👕"],
  [["clean", "tidy", "sweep", "mop", "vacuum", "dust", "wipe", "scrub"], "🧹"],
  [["water", "plant", "garden", "flower"], "🌱"],
  [["dog", "puppy", "walk dog", "pet", "feed dog"], "🐕"],
  [["cat", "kitten", "feed cat"], "🐱"],
  [["fish", "aquarium", "feed fish"], "🐟"],
  [["medicine", "vitamin", "pill", "supplement", "medication", "drug"], "💊"],
  [["drink", "water", "hydrate", "hydration"], "💧"],
  [["coffee", "tea", "brew", "espresso"], "☕"],
  [["pray", "prayer", "devotion", "worship", "bible", "church"], "🙏"],
  [["mail", "email", "inbox", "letter", "post"], "📬"],
  [["phone", "call", "text", "message"], "📱"],
  [["drive", "car", "commute", "carpool"], "🚗"],
  [["bus", "transit", "train", "subway"], "🚌"],
  [["work", "office", "job", "meeting"], "💼"],
  [["money", "budget", "finance", "pay", "bill", "bank", "save"], "💰"],
  [["shop", "grocery", "groceries", "store", "buy", "market"], "🛒"],
  [["pack", "backpack", "bag", "prepare", "prep"], "🎒"],
  [["music", "piano", "guitar", "practice", "instrument", "sing"], "🎵"],
  [["art", "draw", "paint", "craft", "color"], "🎨"],
  [["game", "play", "gaming"], "🎮"],
  [["screen", "screentime", "tv", "limit"], "📺"],
  [["sunscreen", "sunblock", "spf", "skin"], "☀️"],
  [["hair", "comb", "brush hair", "style"], "💇"],
  [["makeup", "cosmetic", "skincare", "face"], "💄"],
  [["check", "inspect", "review", "verify"], "✅"],
  [["lock", "door", "security", "safe"], "🔒"],
  [["light", "lamp", "turn off"], "💡"],
  [["recycle", "compost", "sort"], "♻️"],
  [["lunchbox", "lunch box", "pack lunch"], "🍱"],
  [["snack", "fruit", "healthy"], "🍎"],
  [["kindness", "kind", "nice", "help", "chore"], "💛"],
  [["birthday", "celebrate", "party"], "🎂"],
  [["calendar", "schedule", "plan", "agenda"], "📅"],
  [["timer", "countdown", "time"], "⏱️"],
  [["star", "reward", "goal", "achieve"], "⭐"],
];

// Common emoji palette for browsing
const EMOJI_PALETTE = [
  "🪥", "🚿", "🛏️", "⏰", "🏋️", "🏃", "🧘", "📖", "📝", "📚",
  "🍳", "🍽️", "👕", "🧹", "🌱", "🐕", "🐱", "💊", "💧", "☕",
  "🗑️", "📬", "📱", "🚗", "💼", "💰", "🛒", "🎒", "🎵", "🎨",
  "🎮", "📺", "☀️", "💇", "✅", "🔒", "💡", "♻️", "🍱", "🍎",
  "🙏", "💛", "⭐", "📅", "⏱️", "🎂", "🏊", "🚴", "🚶", "🐟",
  "🧸", "🎯", "🏆", "💪", "🧠", "❤️", "🌟", "🔔", "🎧", "✏️",
];

function suggestIcon(title: string): string {
  const lower = title.toLowerCase();
  for (const [keywords, emoji] of ICON_MAP) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) return emoji;
    }
  }
  return "";
}

interface AddRoutineModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string;
    icon: string | null;
    category: string | null;
    frequency: RoutineFrequency;
    daysOfWeek: number[] | null;
    recurrenceRule: RecurrenceRule | null;
    assignedProfileId: string | null;
    showOnCalendar: boolean;
  }) => void;
  editingRoutine?: RoutineWithCompletions | null;
  profiles: FamilyProfile[];
}

export function AddRoutineModal({
  open,
  onClose,
  onSave,
  editingRoutine,
  profiles,
}: AddRoutineModalProps) {
  const defaultRule: RecurrenceRule = { frequency: "daily", interval: 1, endType: "never" };

  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("");
  const [category, setCategory] = useState("");
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule>(defaultRule);
  const [assignedProfileId, setAssignedProfileId] = useState<string>("");
  const [showOnCalendar, setShowOnCalendar] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [iconSearch, setIconSearch] = useState("");
  const [userPickedIcon, setUserPickedIcon] = useState(false);
  const iconPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingRoutine) {
      setTitle(editingRoutine.title);
      setIcon(editingRoutine.icon || "");
      setCategory(editingRoutine.category || "");
      // Reconstruct recurrence rule from editing routine
      if (editingRoutine.recurrenceRule) {
        setRecurrenceRule(editingRoutine.recurrenceRule);
      } else {
        // Legacy: synthesize from frequency + daysOfWeek
        const freq = editingRoutine.frequency === "custom" ? "weekly" : editingRoutine.frequency;
        setRecurrenceRule({
          frequency: freq as RecurrenceRule["frequency"],
          interval: 1,
          daysOfWeek: editingRoutine.daysOfWeek ?? [],
          endType: "never",
        });
      }
      setAssignedProfileId(editingRoutine.assignedProfileId || "");
      setShowOnCalendar(editingRoutine.showOnCalendar ?? false);
      setUserPickedIcon(!!editingRoutine.icon);
    } else {
      setTitle("");
      setIcon("");
      setCategory("");
      setRecurrenceRule(defaultRule);
      setAssignedProfileId("");
      setShowOnCalendar(false);
      setUserPickedIcon(false);
    }
  }, [editingRoutine, open]);

  // Auto-suggest icon based on title (only if user hasn't manually picked one)
  useEffect(() => {
    if (userPickedIcon) return;
    const suggested = suggestIcon(title);
    if (suggested) {
      setIcon(suggested);
    } else if (!editingRoutine) {
      setIcon("");
    }
  }, [title, userPickedIcon, editingRoutine]);

  // Close picker on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (iconPickerRef.current && !iconPickerRef.current.contains(e.target as Node)) {
        setShowIconPicker(false);
      }
    }
    if (showIconPicker) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [showIconPicker]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    // Derive legacy frequency field from recurrence rule
    const freq: RoutineFrequency = recurrenceRule.frequency;

    onSave({
      title: title.trim(),
      icon: icon.trim() || null,
      category: category.trim() || null,
      frequency: freq,
      daysOfWeek: recurrenceRule.daysOfWeek ?? null,
      recurrenceRule,
      assignedProfileId: assignedProfileId || null,
      showOnCalendar,
    });
  };

  const selectIcon = (emoji: string) => {
    setIcon(emoji);
    setUserPickedIcon(true);
    setShowIconPicker(false);
    setIconSearch("");
  };

  const clearIcon = () => {
    setIcon("");
    setUserPickedIcon(false);
  };

  // Filter palette by search
  const filteredEmojis = iconSearch.trim()
    ? (() => {
        const lower = iconSearch.toLowerCase();
        const matched = new Set<string>();
        for (const [keywords, emoji] of ICON_MAP) {
          for (const keyword of keywords) {
            if (keyword.includes(lower)) {
              matched.add(emoji);
            }
          }
        }
        // Also include palette emojis that match via map
        return EMOJI_PALETTE.filter((e) => matched.has(e)).concat(
          [...matched].filter((e) => !EMOJI_PALETTE.includes(e))
        );
      })()
    : EMOJI_PALETTE;

  const contentRef = useRef<HTMLDivElement>(null);
  const layout = useAdaptiveModalLayout(contentRef);

  return (
    <AdaptiveDialog
      open
      onClose={onClose}
      title={editingRoutine ? "Edit Routine" : "Add Routine"}
      layout={layout}
    >
      <form onSubmit={handleSubmit}>
        <div ref={contentRef}>
          <AdaptiveModalContent
            forceLayout={layout}
            primary={
              <>
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Brush Teeth"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    autoFocus
                  />
                </div>

                {/* Icon & Category row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative" ref={iconPickerRef}>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Icon
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowIconPicker(!showIconPicker)}
                      className="w-full flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground hover:border-primary/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                    >
                      {icon ? (
                        <span className="text-xl leading-none">{icon}</span>
                      ) : (
                        <span className="text-muted-foreground">Pick icon...</span>
                      )}
                      {icon && !userPickedIcon && (
                        <span className="ml-auto text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                          suggested
                        </span>
                      )}
                    </button>

                    {/* Icon picker popup */}
                    {showIconPicker && (
                      <div className="absolute top-full left-0 mt-1 z-50 w-72 bg-card border border-border rounded-xl shadow-xl p-3 animate-in fade-in-0 zoom-in-95 duration-150">
                        {/* Search */}
                        <div className="relative mb-2">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <input
                            type="text"
                            value={iconSearch}
                            onChange={(e) => setIconSearch(e.target.value)}
                            placeholder="Search (e.g., trash, cook)..."
                            className="w-full pl-8 pr-3 py-1.5 text-sm bg-background border border-border rounded-md focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                            autoFocus
                          />
                        </div>

                        {/* Emoji grid */}
                        <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
                          {filteredEmojis.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => selectIcon(emoji)}
                              className={`w-8 h-8 flex items-center justify-center rounded-md text-lg hover:bg-primary/10 transition-colors ${
                                icon === emoji ? "bg-primary/20 ring-1 ring-primary" : ""
                              }`}
                            >
                              {emoji}
                            </button>
                          ))}
                          {filteredEmojis.length === 0 && (
                            <p className="col-span-8 text-xs text-muted-foreground text-center py-4">
                              No matches
                            </p>
                          )}
                        </div>

                        {/* Clear / custom input */}
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
                          <input
                            type="text"
                            value={icon}
                            onChange={(e) => {
                              setIcon(e.target.value);
                              setUserPickedIcon(true);
                            }}
                            placeholder="Or paste emoji..."
                            className="flex-1 px-2 py-1 text-sm bg-background border border-border rounded-md focus:border-primary focus:outline-none"
                          />
                          {icon && (
                            <button
                              type="button"
                              onClick={clearIcon}
                              className="text-xs text-muted-foreground hover:text-destructive"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Category
                    </label>
                    <input
                      type="text"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="e.g., morning"
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Assigned profile */}
                {profiles.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Assign to
                    </label>
                    <select
                      value={assignedProfileId}
                      onChange={(e) => setAssignedProfileId(e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Anyone</option>
                      {profiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.icon ? `${p.icon} ` : ""}
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Show on Calendar toggle */}
                <label className="flex items-center justify-between cursor-pointer py-1">
                  <div>
                    <span className="text-sm font-medium text-foreground">Show on Calendar</span>
                    <p className="text-xs text-muted-foreground">Display on scheduled days</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowOnCalendar(!showOnCalendar)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${showOnCalendar ? "bg-primary" : "bg-muted-foreground/30"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${showOnCalendar ? "translate-x-5" : ""}`} />
                  </button>
                </label>
              </>
            }
            secondary={
              <>
                {/* Recurrence */}
                <RecurrenceEditor
                  value={recurrenceRule}
                  onChange={setRecurrenceRule}
                  referenceDate={new Date()}
                />
              </>
            }
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!title.trim()}>
            {editingRoutine ? "Save" : "Add Routine"}
          </Button>
        </div>
      </form>
    </AdaptiveDialog>
  );
}
