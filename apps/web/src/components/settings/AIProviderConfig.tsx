import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ExternalLink, Check, Eye, EyeOff, Trash2, Sparkles, Zap, XCircle } from "lucide-react";
import { api } from "../../services/api";
import { Button } from "../ui/Button";
import { isCloudMode, appUrl } from "../../lib/cloud";

interface AIProviderConfigProps {
  providerId: string;
}

// Maps frontend provider IDs to backend provider names for the test endpoint
const PROVIDER_BACKEND_NAME: Record<string, string> = {
  "ai-claude": "claude",
  "ai-openai": "openai",
  "ai-gemini": "gemini",
  "ai-grok": "grok",
  "ai-azure": "azure_openai",
  "ai-openrouter": "openrouter",
  "ai-local": "local_llm",
};

function TestConnectionButton({
  provider,
  apiKey,
  config,
}: {
  provider: string;
  apiKey?: string;
  config?: { baseUrl?: string; deploymentName?: string; apiVersion?: string; model?: string };
}) {
  const [testResult, setTestResult] = useState<{ ok: boolean; model?: string; error?: string } | null>(null);

  const testMutation = useMutation({
    mutationFn: () => api.testAIProvider(provider, apiKey || undefined, config),
    onSuccess: (data) => setTestResult(data),
    onError: (err: any) => setTestResult({ ok: false, error: err.message || "Test failed" }),
  });

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setTestResult(null);
          testMutation.mutate();
        }}
        disabled={testMutation.isPending}
      >
        {testMutation.isPending ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Zap className="mr-1.5 h-3.5 w-3.5" />
        )}
        Test Connection
      </Button>
      {testResult && (
        <div
          className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
            testResult.ok
              ? "border-primary/30 bg-primary/5 text-primary"
              : "border-destructive/30 bg-destructive/5 text-destructive"
          }`}
        >
          {testResult.ok ? (
            <>
              <Check className="h-4 w-4 shrink-0" />
              <span>Connected{testResult.model ? ` — model: ${testResult.model}` : ""}</span>
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4 shrink-0" />
              <span>{testResult.error || "Connection failed"}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Available models per provider
const PROVIDER_MODELS: Record<string, { value: string; label: string }[]> = {
  "ai-claude": [
    { value: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5" },
    { value: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet" },
    { value: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku" },
  ],
  "ai-openai": [
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini" },
    { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
    { value: "o3-mini", label: "o3 Mini" },
  ],
  "ai-gemini": [
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
  ],
  "ai-grok": [
    { value: "grok-3", label: "Grok 3" },
    { value: "grok-3-mini", label: "Grok 3 Mini" },
  ],
};

// Maps provider IDs to their backend settings category and key(s)
const PROVIDER_MAP: Record<string, {
  category: string;
  keyField: string;
  modelField: string;
  label: string;
  description: string;
  placeholder: string;
  docsUrl?: string;
}> = {
  "ai-claude": {
    category: "anthropic",
    keyField: "api_key",
    modelField: "model",
    label: "Claude (Anthropic)",
    description: "API key for Claude models",
    placeholder: "sk-ant-...",
    docsUrl: "https://console.anthropic.com/settings/keys",
  },
  "ai-openai": {
    category: "openai",
    keyField: "api_key",
    modelField: "model",
    label: "OpenAI",
    description: "API key for GPT models",
    placeholder: "sk-...",
    docsUrl: "https://platform.openai.com/api-keys",
  },
  "ai-gemini": {
    category: "google",
    keyField: "gemini_api_key",
    modelField: "gemini_model",
    label: "Gemini",
    description: "API key for Gemini models",
    placeholder: "AIza...",
    docsUrl: "https://aistudio.google.com/apikey",
  },
  "ai-grok": {
    category: "grok",
    keyField: "api_key",
    modelField: "model",
    label: "Grok (xAI)",
    description: "API key for Grok models",
    placeholder: "xai-...",
    docsUrl: "https://console.x.ai/",
  },
};

export function AIProviderConfig({ providerId }: AIProviderConfigProps) {
  const queryClient = useQueryClient();

  // BYOK providers
  if (PROVIDER_MAP[providerId]) {
    return <BYOKProviderConfig providerId={providerId} />;
  }
  if (providerId === "ai-openrouter") {
    return <OpenRouterConfig />;
  }
  if (providerId === "ai-azure") {
    return <AzureOpenAIConfig />;
  }
  if (providerId === "ai-local") {
    return <LocalLLMConfig />;
  }
  if (providerId === "ai-openframeai") {
    return <OpenFrameAIConfig />;
  }

  return <p className="text-muted-foreground">Unknown provider</p>;
}

function BYOKProviderConfig({ providerId }: { providerId: string }) {
  const queryClient = useQueryClient();
  const config = PROVIDER_MAP[providerId]!;
  const models = PROVIDER_MODELS[providerId] || [];
  const [apiKey, setApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [customModel, setCustomModel] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [modelSaved, setModelSaved] = useState(false);

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["settings", config.category],
    queryFn: () => api.getCategorySettings(config.category),
  });

  const existingKey = settings.find((s) => s.key === config.keyField)?.value;
  const existingModel = settings.find((s) => s.key === config.modelField)?.value;
  const hasKey = !!existingKey;

  // Initialize model from settings
  useEffect(() => {
    if (existingModel) {
      const isPreset = models.some((m) => m.value === existingModel);
      if (isPreset) {
        setSelectedModel(existingModel);
        setCustomModel("");
      } else {
        setSelectedModel("custom");
        setCustomModel(existingModel);
      }
    }
  }, [existingModel]);

  const saveMutation = useMutation({
    mutationFn: (value: string) =>
      api.updateCategorySettings(config.category, { [config.keyField]: value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", config.category] });
      queryClient.invalidateQueries({ queryKey: ["chat-status"] });
      setSaved(true);
      setApiKey("");
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const saveModelMutation = useMutation({
    mutationFn: (model: string | null) =>
      api.updateCategorySettings(config.category, { [config.modelField]: model }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", config.category] });
      setModelSaved(true);
      setTimeout(() => setModelSaved(false), 2000);
    },
  });

  const clearMutation = useMutation({
    mutationFn: () =>
      api.updateCategorySettings(config.category, { [config.keyField]: null as any, [config.modelField]: null as any }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", config.category] });
      queryClient.invalidateQueries({ queryKey: ["chat-status"] });
      setSelectedModel("");
      setCustomModel("");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading...
      </div>
    );
  }

  const effectiveModel = selectedModel === "custom" ? customModel : selectedModel;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">{config.label}</h3>
        <p className="text-sm text-muted-foreground">{config.description}</p>
      </div>

      {hasKey ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <Check className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">API key configured</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {existingKey?.slice(0, 8)}...
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter new key to replace..."
                className="h-10 w-full rounded-lg border border-border bg-background px-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button
              onClick={() => saveMutation.mutate(apiKey)}
              disabled={!apiKey.trim() || saveMutation.isPending}
              size="sm"
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : "Update"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive border-destructive/40 hover:bg-destructive/10"
              onClick={() => clearMutation.mutate()}
              disabled={clearMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {models.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Model</label>
              <div className="flex items-center gap-3">
                <select
                  value={selectedModel}
                  onChange={(e) => {
                    setSelectedModel(e.target.value);
                    if (e.target.value !== "custom") {
                      setCustomModel("");
                    }
                  }}
                  className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Default</option>
                  {models.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                  <option value="custom">Custom...</option>
                </select>
                <Button
                  size="sm"
                  onClick={() => saveModelMutation.mutate(effectiveModel || null)}
                  disabled={saveModelMutation.isPending || (effectiveModel || "") === (existingModel || "")}
                >
                  {saveModelMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : modelSaved ? <Check className="h-4 w-4" /> : "Save"}
                </Button>
              </div>
              {selectedModel === "custom" && (
                <input
                  type="text"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  placeholder="Enter model ID..."
                  className="mt-2 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              )}
            </div>
          )}

          <TestConnectionButton provider={PROVIDER_BACKEND_NAME[providerId] || providerId} />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={config.placeholder}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button
              onClick={() => saveMutation.mutate(apiKey)}
              disabled={!apiKey.trim() || saveMutation.isPending}
              size="sm"
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : "Save"}
            </Button>
          </div>
        </div>
      )}

      {config.docsUrl && (
        <a
          href={config.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          Get API key
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}

function AzureOpenAIConfig() {
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [deploymentName, setDeploymentName] = useState("");
  const [apiVersion, setApiVersion] = useState("2024-02-01");
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["settings", "azure_openai"],
    queryFn: () => api.getCategorySettings("azure_openai"),
  });

  useEffect(() => {
    if (settings.length > 0) {
      const existing = Object.fromEntries(settings.map((s) => [s.key, s.value || ""]));
      if (existing.base_url) setBaseUrl(existing.base_url);
      if (existing.deployment_name) setDeploymentName(existing.deployment_name);
      if (existing.api_version) setApiVersion(existing.api_version);
    }
  }, [settings]);

  const existingKey = settings.find((s) => s.key === "api_key")?.value;
  const hasKey = !!existingKey;

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, string | null>) =>
      api.updateCategorySettings("azure_openai", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "azure_openai"] });
      queryClient.invalidateQueries({ queryKey: ["chat-status"] });
      setSaved(true);
      setApiKey("");
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const clearMutation = useMutation({
    mutationFn: () =>
      api.updateCategorySettings("azure_openai", {
        api_key: null as any,
        base_url: null as any,
        deployment_name: null as any,
        api_version: null as any,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "azure_openai"] });
      queryClient.invalidateQueries({ queryKey: ["chat-status"] });
      setBaseUrl("");
      setDeploymentName("");
      setApiVersion("2024-02-01");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Azure OpenAI</h3>
        <p className="text-sm text-muted-foreground">
          Connect to your Azure OpenAI Service deployment
        </p>
      </div>

      {hasKey && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <Check className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Configured</span>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto text-destructive border-destructive/40 hover:bg-destructive/10"
            onClick={() => clearMutation.mutate()}
            disabled={clearMutation.isPending}
          >
            <Trash2 className="mr-1 h-3 w-3" />
            Remove
          </Button>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">API Key</label>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasKey ? "Enter new key to replace..." : "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Endpoint URL</label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://myresource.openai.azure.com"
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Deployment Name</label>
          <input
            type="text"
            value={deploymentName}
            onChange={(e) => setDeploymentName(e.target.value)}
            placeholder="gpt-4o"
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">API Version</label>
          <input
            type="text"
            value={apiVersion}
            onChange={(e) => setApiVersion(e.target.value)}
            placeholder="2024-02-01"
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <Button
          onClick={() => {
            const data: Record<string, string | null> = {
              base_url: baseUrl || null,
              deployment_name: deploymentName || null,
              api_version: apiVersion || null,
            };
            if (apiKey.trim()) data.api_key = apiKey;
            saveMutation.mutate(data);
          }}
          disabled={saveMutation.isPending || (!apiKey.trim() && !hasKey)}
        >
          {saveMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : saved ? (
            <Check className="mr-2 h-4 w-4" />
          ) : null}
          {saved ? "Saved" : "Save"}
        </Button>
      </div>

      {hasKey && (
        <TestConnectionButton
          provider="azure_openai"
          config={{ baseUrl: baseUrl || undefined, deploymentName: deploymentName || undefined, apiVersion: apiVersion || undefined }}
        />
      )}

      <a
        href="https://portal.azure.com/#view/Microsoft_Azure_ProjectOxford/CognitiveServicesHub/~/OpenAI"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
      >
        Azure OpenAI Portal
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

function LocalLLMConfig() {
  const queryClient = useQueryClient();
  const [baseUrl, setBaseUrl] = useState("http://localhost:11434/v1");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["settings", "local_llm"],
    queryFn: () => api.getCategorySettings("local_llm"),
  });

  useEffect(() => {
    if (settings.length > 0) {
      const existing = Object.fromEntries(settings.map((s) => [s.key, s.value || ""]));
      if (existing.base_url) setBaseUrl(existing.base_url);
      if (existing.model) setModel(existing.model);
    }
  }, [settings]);

  const hasBaseUrl = !!settings.find((s) => s.key === "base_url")?.value;

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, string | null>) =>
      api.updateCategorySettings("local_llm", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "local_llm"] });
      queryClient.invalidateQueries({ queryKey: ["chat-status"] });
      setSaved(true);
      setApiKey("");
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const clearMutation = useMutation({
    mutationFn: () =>
      api.updateCategorySettings("local_llm", {
        base_url: null as any,
        api_key: null as any,
        model: null as any,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "local_llm"] });
      queryClient.invalidateQueries({ queryKey: ["chat-status"] });
      setBaseUrl("http://localhost:11434/v1");
      setModel("");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Local LLM</h3>
        <p className="text-sm text-muted-foreground">
          Connect to a local model server (Ollama, LM Studio, vLLM, etc.)
        </p>
      </div>

      {hasBaseUrl && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <Check className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Configured</span>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto text-destructive border-destructive/40 hover:bg-destructive/10"
            onClick={() => clearMutation.mutate()}
            disabled={clearMutation.isPending}
          >
            <Trash2 className="mr-1 h-3 w-3" />
            Remove
          </Button>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Base URL</label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="http://localhost:11434/v1"
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            If running in Docker, use <code className="rounded bg-muted px-1">host.docker.internal</code> instead of <code className="rounded bg-muted px-1">localhost</code>
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">API Key (optional)</label>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Leave empty if not required"
              className="h-10 w-full rounded-lg border border-border bg-background px-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Model Name</label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="llama3"
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <Button
          onClick={() => {
            const data: Record<string, string | null> = {
              base_url: baseUrl || null,
              model: model || null,
            };
            if (apiKey.trim()) data.api_key = apiKey;
            saveMutation.mutate(data);
          }}
          disabled={saveMutation.isPending || !baseUrl.trim()}
        >
          {saveMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : saved ? (
            <Check className="mr-2 h-4 w-4" />
          ) : null}
          {saved ? "Saved" : "Save"}
        </Button>
      </div>

      {hasBaseUrl && (
        <TestConnectionButton
          provider="local_llm"
          config={{ baseUrl: baseUrl || undefined, model: model || undefined }}
        />
      )}
    </div>
  );
}

function OpenRouterConfig() {
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["settings", "openrouter"],
    queryFn: () => api.getCategorySettings("openrouter"),
  });

  useEffect(() => {
    if (settings.length > 0) {
      const existing = Object.fromEntries(settings.map((s) => [s.key, s.value || ""]));
      if (existing.model) setModel(existing.model);
    }
  }, [settings]);

  const existingKey = settings.find((s) => s.key === "api_key")?.value;
  const hasKey = !!existingKey;

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, string | null>) =>
      api.updateCategorySettings("openrouter", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "openrouter"] });
      queryClient.invalidateQueries({ queryKey: ["chat-status"] });
      setSaved(true);
      setApiKey("");
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const clearMutation = useMutation({
    mutationFn: () =>
      api.updateCategorySettings("openrouter", {
        api_key: null as any,
        model: null as any,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "openrouter"] });
      queryClient.invalidateQueries({ queryKey: ["chat-status"] });
      setModel("");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">OpenRouter</h3>
        <p className="text-sm text-muted-foreground">
          Access 400+ AI models from all major providers through a single API key
        </p>
      </div>

      {hasKey && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <Check className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">API key configured</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {existingKey?.slice(0, 12)}...
          </span>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive border-destructive/40 hover:bg-destructive/10"
            onClick={() => clearMutation.mutate()}
            disabled={clearMutation.isPending}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">API Key</label>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasKey ? "Enter new key to replace..." : "sk-or-v1-..."}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5">Default Model</label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="anthropic/claude-3.5-sonnet"
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Format: <code className="rounded bg-muted px-1">provider/model</code> (e.g., anthropic/claude-3.5-sonnet, openai/gpt-4o, google/gemini-2.0-flash)
          </p>
        </div>

        <Button
          onClick={() => {
            const data: Record<string, string | null> = {
              model: model || null,
            };
            if (apiKey.trim()) data.api_key = apiKey;
            saveMutation.mutate(data);
          }}
          disabled={saveMutation.isPending || (!apiKey.trim() && !hasKey)}
        >
          {saveMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : saved ? (
            <Check className="mr-2 h-4 w-4" />
          ) : null}
          {saved ? "Saved" : "Save"}
        </Button>
      </div>

      {hasKey && (
        <TestConnectionButton
          provider="openrouter"
          config={model ? { model } : undefined}
        />
      )}

      <a
        href="https://openrouter.ai/keys"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
      >
        Get API key
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

function OpenFrameAIConfig() {
  const queryClient = useQueryClient();

  const { data: chatStatus, isLoading } = useQuery({
    queryKey: ["chat-status"],
    queryFn: () => api.getChatStatus(),
  });

  const enableMutation = useMutation({
    mutationFn: async () => {
      // Enable hosted AI for this user
      const response = await fetch(appUrl("/api/billing/enable-ai"), {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to enable");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-status"] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading...
      </div>
    );
  }

  const isEnabled = chatStatus?.hostedAiEnabled;
  const isAvailable = chatStatus?.hostedAiAvailable;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          OpenFrameAI
        </h3>
        <p className="text-sm text-muted-foreground">
          Pay-per-token AI service powered by OpenFrame Cloud. No API keys needed.
        </p>
      </div>

      {isEnabled ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <Check className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">OpenFrameAI is active</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Usage is billed per token. Check the Billing tab for cost details.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                $1 free trial
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Get started with $1 in free credits. Pay-as-you-go after that — only pay for what you use.
            </p>
          </div>

          {isAvailable ? (
            <Button
              onClick={() => enableMutation.mutate()}
              disabled={enableMutation.isPending}
            >
              {enableMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Enable OpenFrameAI
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              {isCloudMode
                ? "Contact support to enable OpenFrameAI."
                : "Connect to OpenFrame Cloud first to use OpenFrameAI."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
