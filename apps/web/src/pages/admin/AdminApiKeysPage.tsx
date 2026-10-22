import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type AdminApiKey } from "../../services/api";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { AlertTriangle, Check, ExternalLink, KeyRound, Loader2, RefreshCw } from "lucide-react";
import { cn } from "../../lib/utils";

function SourceBadge({ apiKey }: { apiKey: AdminApiKey }) {
  if (apiKey.source === "admin") {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/30">
        Set here
      </span>
    );
  }
  if (apiKey.source === "env") {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 border border-blue-500/30">
        From {apiKey.envVar}
      </span>
    );
  }
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
      Not set
    </span>
  );
}

function ApiKeyRow({ apiKey }: { apiKey: AdminApiKey }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: (next: string | null) => api.updateAdminApiKeys({ [apiKey.key]: next }),
    onSuccess: () => {
      setValue("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      queryClient.invalidateQueries({ queryKey: ["admin", "api-keys"] });
    },
  });

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">{apiKey.label}</h2>
          <SourceBadge apiKey={apiKey} />
        </div>
        <a
          href={apiKey.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary shrink-0"
        >
          Get a key
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <p className="text-sm text-muted-foreground mb-3">{apiKey.description}</p>

      <div className="flex gap-2">
        <input
          type="password"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={apiKey.source === "admin" ? "•••••••• (enter a new key to replace it)" : apiKey.placeholder}
          className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          onKeyDown={(e) => e.key === "Enter" && value.trim() && save.mutate(value.trim())}
        />
        <Button size="sm" onClick={() => save.mutate(value.trim())} disabled={!value.trim() || save.isPending}>
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : "Save"}
        </Button>
        {apiKey.source === "admin" && (
          <Button size="sm" variant="outline" onClick={() => save.mutate(null)} disabled={save.isPending}>
            Clear
          </Button>
        )}
      </div>

      <p className={cn("text-xs mt-2", save.isError ? "text-red-600" : "text-muted-foreground")}>
        {save.isError
          ? (save.error as Error)?.message || "Failed to save"
          : `A key set here takes precedence over ${apiKey.envVar}.`}
      </p>
    </Card>
  );
}

export function AdminApiKeysPage() {
  const { data: keys, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin", "api-keys"],
    queryFn: () => api.getAdminApiKeys(),
    retry: 1,
  });

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-2 mb-2">
        <KeyRound className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-primary">API Keys</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Platform keys used for every household. Households can still add their own keys in Settings, which
        take precedence. Map tiles (OpenStreetMap/CARTO), routing (OSRM), Open-Meteo weather and reverse
        geocoding need no keys.
      </p>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-5 animate-pulse">
              <div className="h-4 bg-muted rounded w-48 mb-3" />
              <div className="h-8 bg-muted rounded w-full" />
            </Card>
          ))}
        </div>
      ) : isError || !keys ? (
        <Card className="p-8 text-center">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold mb-1">Failed to load API keys</h2>
          <p className="text-sm text-muted-foreground mb-4">{(error as Error)?.message}</p>
          <Button variant="outline" className="gap-2" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {keys.map((apiKey) => (
            <ApiKeyRow key={apiKey.key} apiKey={apiKey} />
          ))}
        </div>
      )}
    </div>
  );
}
