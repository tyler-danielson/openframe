import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../services/api";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";
import { useToast } from "../ui/Toaster";
import { SetupGuide } from "../ui/SetupGuide";
import { SETUP_GUIDES } from "../../data/setup-guides";

type Provider = "google" | "microsoft";

const INPUT_CLASS =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30";

const PROVIDERS = {
  google: {
    label: "Google",
    title: "Google OAuth",
    blurb: "Client ID and secret for the Google Cloud OAuth app used to sign in and sync Google services.",
    consoleUrl: "https://console.cloud.google.com/apis/credentials",
    consoleName: "Google Cloud Console",
    clientIdPlaceholder: "xxxxxxxx.apps.googleusercontent.com",
  },
  microsoft: {
    label: "Microsoft",
    title: "Microsoft OAuth",
    blurb: "Client ID, secret and tenant for the Entra ID app registration used to sign in and sync Microsoft services.",
    consoleUrl: "https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade",
    consoleName: "Azure Portal",
    clientIdPlaceholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  },
} as const;

function ProviderForm({ provider }: { provider: Provider }) {
  const meta = PROVIDERS[provider];
  const isMicrosoft = provider === "microsoft";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["setup-config", provider],
    queryFn: () => api.getSetupConfig(provider),
    retry: false,
  });

  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [tenantId, setTenantId] = useState("");
  // Seed the editable fields exactly once, so a refetch never clobbers typing.
  const seeded = useRef(false);

  useEffect(() => {
    if (!data || seeded.current) return;
    seeded.current = true;
    setClientId(data.client_id ?? "");
    setTenantId(data.tenant_id ?? "");
  }, [data]);

  const loadedClientId = data?.client_id ?? "";
  const loadedTenantId = data?.tenant_id ?? "";

  // Only non-empty, actually-changed values are sent. `/setup/configure` persists
  // empty strings, so a blank field must never reach it.
  const settings = useMemo(() => {
    const next: Record<string, string> = {};
    const id = clientId.trim();
    if (id && id !== loadedClientId) next.client_id = id;
    if (isMicrosoft) {
      const tenant = tenantId.trim();
      if (tenant && tenant !== loadedTenantId) next.tenant_id = tenant;
    }
    const secret = clientSecret.trim();
    if (secret) next.client_secret = secret;
    return next;
  }, [clientId, clientSecret, tenantId, loadedClientId, loadedTenantId, isMicrosoft]);

  const hasChanges = Object.keys(settings).length > 0;

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, string>) => api.setupConfigure(provider, payload),
    onSuccess: () => {
      toast({ title: `${meta.label} credentials saved`, type: "success" });
      setClientSecret("");
      queryClient.invalidateQueries({ queryKey: ["setup-config", provider] });
    },
    onError: (err) => {
      toast({
        title: "Could not save credentials",
        description: (err as Error).message,
        type: "error",
      });
    },
  });

  if (isError) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{meta.title}</CardTitle>
        <CardDescription>
          {meta.blurb}{" "}
          <a
            href={meta.consoleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            {meta.consoleName}
          </a>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div>
              <label htmlFor={`${provider}-client-id`} className="mb-1 block text-sm font-medium text-primary">
                Client ID
              </label>
              <input
                id={`${provider}-client-id`}
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className={INPUT_CLASS}
                placeholder={meta.clientIdPlaceholder}
              />
            </div>

            <div>
              <label htmlFor={`${provider}-client-secret`} className="mb-1 block text-sm font-medium text-primary">
                Client Secret
              </label>
              <input
                id={`${provider}-client-secret`}
                type="password"
                autoComplete="new-password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                className={INPUT_CLASS}
                placeholder={data?.has_client_secret ? "••••••••" : "Client secret value"}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {data?.has_client_secret
                  ? "A secret is saved. Leave blank to keep it, or paste a new one to replace it."
                  : "No secret saved yet."}
              </p>
            </div>

            {isMicrosoft && (
              <div>
                <label htmlFor={`${provider}-tenant-id`} className="mb-1 block text-sm font-medium text-primary">
                  Tenant ID
                </label>
                <input
                  id={`${provider}-tenant-id`}
                  type="text"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="common"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Use "common" for multi-tenant, or your directory (tenant) ID.
                </p>
              </div>
            )}

            <SetupGuide guide={SETUP_GUIDES[provider]!} externalUrl={window.location.origin} />

            <div className="flex justify-end">
              <Button
                size="sm"
                disabled={!hasChanges || saveMutation.isPending}
                onClick={() => {
                  if (!hasChanges) return;
                  saveMutation.mutate(settings);
                }}
              >
                {saveMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function ProviderCredentialsCard() {
  return (
    <div className="space-y-4">
      <ProviderForm provider="google" />
      <ProviderForm provider="microsoft" />
    </div>
  );
}
