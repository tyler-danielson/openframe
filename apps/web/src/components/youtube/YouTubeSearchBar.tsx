import { useState, useCallback } from "react";
import { Search, X, Link as LinkIcon } from "lucide-react";
import { parseYouTubeUrl } from "../../lib/youtube-utils";

interface YouTubeSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: (query: string) => void;
  onUrlPaste?: (parsed: { type: string; youtubeId: string }) => void;
  placeholder?: string;
}

export function YouTubeSearchBar({
  value,
  onChange,
  onSearch,
  onUrlPaste,
  placeholder = "Search YouTube or paste a URL...",
}: YouTubeSearchBarProps) {
  const [urlDetected, setUrlDetected] = useState(false);

  const handleChange = useCallback(
    (input: string) => {
      onChange(input);

      // Detect pasted URLs
      const parsed = parseYouTubeUrl(input.trim());
      if (parsed) {
        setUrlDetected(true);
      } else {
        setUrlDetected(false);
      }
    },
    [onChange]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;

    const parsed = parseYouTubeUrl(trimmed);
    if (parsed && onUrlPaste) {
      onUrlPaste(parsed);
      setUrlDetected(false);
    } else {
      onSearch(trimmed);
    }
  };

  const handleUrlGo = () => {
    const parsed = parseYouTubeUrl(value.trim());
    if (parsed && onUrlPaste) {
      onUrlPaste(parsed);
      setUrlDetected(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          className="h-10 w-full rounded-lg border border-border bg-background pl-10 pr-10 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              setUrlDetected(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 hover:bg-muted"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {urlDetected ? (
        <button
          type="button"
          onClick={handleUrlGo}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <LinkIcon className="h-4 w-4" />
          Open
        </button>
      ) : (
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Search
        </button>
      )}
    </form>
  );
}
