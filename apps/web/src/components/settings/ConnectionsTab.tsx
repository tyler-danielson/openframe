import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Trash2,
  Unlink,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api } from "../../services/api";
import { useAuthStore } from "../../stores/auth";
import { appUrl, isCloudMode } from "../../lib/cloud";
import { buildOAuthUrl, hasFeatureScope } from "../../utils/oauth-scopes";
import { Button } from "../ui/Button";
import { WhatsAppSettings } from "../whatsapp/WhatsAppSettings";
import { StorageServerConfig } from "./StorageServerConfig";
import { ServicePricingModal } from "./ServicePricingModal";
import type { SettingsTab } from "./SettingsSidebar";

interface ConnectionsTabProps {
  onNavigateToTab: (tab: SettingsTab) => void;
  onNavigateToService: (serviceId: string) => void;
}

// --- Service definitions ---

type ServiceCategory =
  | "calendar"
  | "ai"
  | "media"
  | "smarthome"
  | "productivity"
  | "communication"
  | "information"
  | "storage";

interface ServiceDef {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  bgColor: string;
  category: ServiceCategory;
  configTab?: SettingsTab;
  configService?: string;
  configRoute?: string;
}

const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  calendar: "Calendar & Email",
  ai: "AI & Language Models",
  media: "Music & Media",
  smarthome: "Smart Home",
  productivity: "Productivity",
  communication: "Communication",
  information: "Information",
  storage: "Storage & Files",
};

const CATEGORY_ORDER: ServiceCategory[] = [
  "calendar",
  "ai",
  "media",
  "smarthome",
  "productivity",
  "communication",
  "information",
  "storage",
];

// Google SVG icon
const GoogleIcon = (
  <svg className="h-5 w-5" viewBox="0 0 24 24">
    <path fill="#EA4335" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#4285F4" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

// Microsoft SVG icon
const MicrosoftIcon = (
  <svg className="h-5 w-5" viewBox="0 0 24 24">
    <rect fill="#F25022" x="1" y="1" width="10" height="10" />
    <rect fill="#7FBA00" x="13" y="1" width="10" height="10" />
    <rect fill="#00A4EF" x="1" y="13" width="10" height="10" />
    <rect fill="#FFB900" x="13" y="13" width="10" height="10" />
  </svg>
);

const SERVICES: ServiceDef[] = [
  // Calendar & Email
  {
    id: "google",
    name: "Google",
    description: "Calendar, Gmail, YouTube",
    icon: GoogleIcon,
    bgColor: "bg-primary/10",
    category: "calendar",
    configService: "calendars",
  },
  {
    id: "microsoft",
    name: "Microsoft",
    description: "Outlook Calendar & Tasks",
    icon: MicrosoftIcon,
    bgColor: "bg-primary/10",
    category: "calendar",
    configService: "calendars",
  },
  {
    id: "caldav",
    name: "CalDAV",
    description: "CalDAV calendar servers",
    icon: <span className="text-lg">📅</span>,
    bgColor: "bg-primary/10",
    category: "calendar",
    configService: "calendars",
  },
  {
    id: "ics",
    name: "ICS Subscriptions",
    description: "iCalendar feed URLs",
    icon: <span className="text-lg">🔗</span>,
    bgColor: "bg-primary/10",
    category: "calendar",
    configService: "calendars",
  },
  // AI & Language Models
  {
    id: "ai-openframeai",
    name: "OpenFrameAI",
    description: "Pay-per-token AI, no keys needed",
    icon: <span className="text-lg">✨</span>,
    bgColor: "bg-primary/10",
    category: "ai",
    configService: "ai-openframeai",
  },
  {
    id: "ai-claude",
    name: "Claude (Anthropic)",
    description: "Anthropic Claude models",
    icon: <span className="text-lg">🤖</span>,
    bgColor: "bg-primary/10",
    category: "ai",
    configService: "ai-claude",
  },
  {
    id: "ai-openai",
    name: "OpenAI",
    description: "GPT-4o and other models",
    icon: <span className="text-lg">🧠</span>,
    bgColor: "bg-primary/10",
    category: "ai",
    configService: "ai-openai",
  },
  {
    id: "ai-azure",
    name: "Azure OpenAI",
    description: "Azure-hosted OpenAI models",
    icon: <span className="text-lg">☁️</span>,
    bgColor: "bg-primary/10",
    category: "ai",
    configService: "ai-azure",
  },
  {
    id: "ai-gemini",
    name: "Gemini",
    description: "Google Gemini models",
    icon: <span className="text-lg">💎</span>,
    bgColor: "bg-primary/10",
    category: "ai",
    configService: "ai-gemini",
  },
  {
    id: "ai-grok",
    name: "Grok",
    description: "xAI Grok models",
    icon: <span className="text-lg">⚡</span>,
    bgColor: "bg-primary/10",
    category: "ai",
    configService: "ai-grok",
  },
  {
    id: "ai-openrouter",
    name: "OpenRouter",
    description: "400+ models, one API key",
    icon: <span className="text-lg">🔀</span>,
    bgColor: "bg-primary/10",
    category: "ai",
    configService: "ai-openrouter",
  },
  {
    id: "ai-local",
    name: "Local LLM",
    description: "Ollama, LM Studio, vLLM",
    icon: <span className="text-lg">💻</span>,
    bgColor: "bg-primary/10",
    category: "ai",
    configService: "ai-local",
  },
  // Music & Media
  {
    id: "spotify",
    name: "Spotify",
    description: "Music playback & control",
    icon: <span className="text-lg">🎵</span>,
    bgColor: "bg-primary/10",
    category: "media",
    configService: "spotify",
  },
  {
    id: "plex",
    name: "Plex",
    description: "Media server streaming",
    icon: <span className="text-lg">🎬</span>,
    bgColor: "bg-primary/10",
    category: "media",
    configService: "plex",
  },
  {
    id: "audiobookshelf",
    name: "Audiobookshelf",
    description: "Audiobooks & podcasts",
    icon: <span className="text-lg">📚</span>,
    bgColor: "bg-primary/10",
    category: "media",
    configService: "audiobookshelf",
  },
  {
    id: "iptv",
    name: "IPTV",
    description: "Live TV streaming",
    icon: <span className="text-lg">📺</span>,
    bgColor: "bg-primary/10",
    category: "media",
    configService: "iptv",
  },
  {
    id: "photos",
    name: "Photos",
    description: "Photo albums & uploads",
    icon: <span className="text-lg">🖼️</span>,
    bgColor: "bg-primary/10",
    category: "media",
    configService: "photos",
  },
  {
    id: "google-photos",
    name: "Google Photos",
    description: "Album sync from Google Photos",
    icon: <span className="text-lg">📸</span>,
    bgColor: "bg-primary/10",
    category: "media",
    configService: "google-photos",
  },
  {
    id: "youtube",
    name: "YouTube",
    description: "Video search & bookmarks",
    icon: <span className="text-lg">▶️</span>,
    bgColor: "bg-primary/10",
    category: "media",
  },
  // Smart Home
  {
    id: "homeassistant",
    name: "Home Assistant",
    description: "Smart home control",
    icon: <span className="text-lg">🏠</span>,
    bgColor: "bg-primary/10",
    category: "smarthome",
    configService: "homeassistant",
  },
  // Productivity
  {
    id: "remarkable",
    name: "reMarkable",
    description: "Tablet sync & agenda push",
    icon: <span className="text-lg">📝</span>,
    bgColor: "bg-primary/10",
    category: "productivity",
    configRoute: "/remarkable",
  },
  {
    id: "capacities",
    name: "Capacities",
    description: "Notes & knowledge base",
    icon: <span className="text-lg">🧠</span>,
    bgColor: "bg-primary/10",
    category: "productivity",
    configTab: "ai",
  },
  // Communication
  {
    id: "telegram",
    name: "Telegram",
    description: "Bot notifications & reminders",
    icon: <span className="text-lg">💬</span>,
    bgColor: "bg-primary/10",
    category: "communication",
    configTab: "ai",
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    description: "Commands & notifications",
    icon: <span className="text-lg">📱</span>,
    bgColor: "bg-primary/10",
    category: "communication",
  },
  // Information
  {
    id: "weather",
    name: "Weather",
    description: "OpenWeatherMap forecasts",
    icon: <span className="text-lg">🌤️</span>,
    bgColor: "bg-primary/10",
    category: "information",
    configService: "weather",
  },
  // News sources are dynamically generated from API — see newsSourceServices below
  {
    id: "sports",
    name: "Sports",
    description: "ESPN scores & schedules",
    icon: <span className="text-lg">🏈</span>,
    bgColor: "bg-primary/10",
    category: "information",
    configService: "sports",
  },
  // Storage & Files
  {
    id: "storage-ftp",
    name: "FTP / SFTP",
    description: "FTP & SFTP file servers",
    icon: <span className="text-lg">📂</span>,
    bgColor: "bg-primary/10",
    category: "storage",
    configService: "storage-ftp",
  },
  {
    id: "storage-smb",
    name: "SMB / NAS",
    description: "Windows shares & NAS devices",
    icon: <span className="text-lg">🗄️</span>,
    bgColor: "bg-primary/10",
    category: "storage",
    configService: "storage-smb",
  },
  {
    id: "storage-webdav",
    name: "WebDAV",
    description: "Nextcloud, Synology, etc.",
    icon: <span className="text-lg">☁️</span>,
    bgColor: "bg-primary/10",
    category: "storage",
    configService: "storage-webdav",
  },
];

export function ConnectionsTab({ onNavigateToTab, onNavigateToService }: ConnectionsTabProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalCategory, setAddModalCategory] = useState<ServiceCategory | "all">("all");
  const [addModalSearch, setAddModalSearch] = useState("");
  const [premiumServiceModal, setPremiumServiceModal] = useState<"weather" | "traffic" | "ai" | null>(null);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [showStorageConfig, setShowStorageConfig] = useState<"ftp" | "sftp" | "smb" | "webdav" | null>(null);
  const [editingStorageServer, setEditingStorageServer] = useState<string | null>(null);

  // --- Data fetching (all in parallel, no module gating) ---
  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.getMe(),
  });

  const { data: calendars = [] } = useQuery({
    queryKey: ["calendars"],
    queryFn: () => api.getCalendars(),
  });

  const { data: spotifyStatus } = useQuery({
    queryKey: ["spotify-status"],
    queryFn: () => api.getSpotifyStatus(),
  });
  const spotifyAccounts = spotifyStatus?.accounts ?? [];

  const { data: haConfig } = useQuery({
    queryKey: ["ha-config"],
    queryFn: () => api.getHomeAssistantConfig(),
  });

  const { data: plexServers = [] } = useQuery({
    queryKey: ["plex-servers"],
    queryFn: () => api.getPlexServers(),
  });

  const { data: audiobookshelfServers = [] } = useQuery({
    queryKey: ["audiobookshelf-servers"],
    queryFn: () => api.getAudiobookshelfServers(),
  });

  const { data: iptvServers = [] } = useQuery({
    queryKey: ["iptv-servers"],
    queryFn: () => api.getIptvServers(),
  });

  const { data: telegramStatus } = useQuery({
    queryKey: ["telegram-status"],
    queryFn: () => api.getTelegramStatus(),
  });

  const { data: whatsappStatus } = useQuery({
    queryKey: ["whatsapp-status"],
    queryFn: () => api.getWhatsAppStatus(),
  });

  const { data: remarkableStatus } = useQuery({
    queryKey: ["remarkable-status"],
    queryFn: () => api.getRemarkableStatus(),
  });

  const { data: storageServers = [] } = useQuery({
    queryKey: ["storage-servers"],
    queryFn: () => api.getStorageServers(),
  });

  const { data: capacitiesStatus } = useQuery({
    queryKey: ["capacities-status"],
    queryFn: () => api.getCapacitiesStatus(),
  });

  const { data: newsFeeds = [] } = useQuery({
    queryKey: ["news-feeds"],
    queryFn: () => api.getNewsFeeds(),
  });

  const { data: newsSources = [] } = useQuery({
    queryKey: ["news-sources"],
    queryFn: () => api.getNewsSources(),
  });

  const { data: photoAlbums = [] } = useQuery({
    queryKey: ["photo-albums"],
    queryFn: () => api.getAlbums(),
  });

  const { data: weatherSettings = [] } = useQuery({
    queryKey: ["settings", "weather"],
    queryFn: () => api.getCategorySettings("weather"),
  });

  const { data: googleSettings = [] } = useQuery({
    queryKey: ["settings", "google"],
    queryFn: () => api.getCategorySettings("google"),
  });

  const { data: anthropicSettings = [] } = useQuery({
    queryKey: ["settings", "anthropic"],
    queryFn: () => api.getCategorySettings("anthropic"),
  });

  const { data: openaiSettings = [] } = useQuery({
    queryKey: ["settings", "openai"],
    queryFn: () => api.getCategorySettings("openai"),
  });

  const { data: azureOpenaiSettings = [] } = useQuery({
    queryKey: ["settings", "azure_openai"],
    queryFn: () => api.getCategorySettings("azure_openai"),
  });

  const { data: grokSettings = [] } = useQuery({
    queryKey: ["settings", "grok"],
    queryFn: () => api.getCategorySettings("grok"),
  });

  const { data: openrouterSettings = [] } = useQuery({
    queryKey: ["settings", "openrouter"],
    queryFn: () => api.getCategorySettings("openrouter"),
  });

  const { data: localLlmSettings = [] } = useQuery({
    queryKey: ["settings", "local_llm"],
    queryFn: () => api.getCategorySettings("local_llm"),
  });

  const { data: chatStatus } = useQuery({
    queryKey: ["chat-status"],
    queryFn: () => api.getChatStatus(),
  });

  const { data: favoriteTeams = [] } = useQuery({
    queryKey: ["favorite-teams"],
    queryFn: () => api.getFavoriteTeams(),
  });

  // --- Disconnect mutations ---
  const disconnectTelegram = useMutation({
    mutationFn: () => api.disconnectTelegram(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["telegram-status"] });
      setConfirmDisconnect(null);
      setDisconnecting(null);
    },
  });

  const disconnectWhatsApp = useMutation({
    mutationFn: () => api.disconnectWhatsApp(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-status"] });
      setConfirmDisconnect(null);
      setDisconnecting(null);
    },
  });

  const disconnectRemarkable = useMutation({
    mutationFn: () => api.disconnectRemarkable(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["remarkable-status"] });
      setConfirmDisconnect(null);
      setDisconnecting(null);
    },
  });

  const disconnectCapacities = useMutation({
    mutationFn: () => api.disconnectCapacities(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capacities-status"] });
      setConfirmDisconnect(null);
      setDisconnecting(null);
    },
  });

  const deleteHAConfig = useMutation({
    mutationFn: () => api.deleteHomeAssistantConfig(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ha-config"] });
      setConfirmDisconnect(null);
      setDisconnecting(null);
    },
  });

  const disconnectAIProvider = useMutation({
    mutationFn: async (serviceId: string) => {
      const categoryMap: Record<string, { category: string; keys: string[] }> = {
        "ai-claude": { category: "anthropic", keys: ["api_key"] },
        "ai-openai": { category: "openai", keys: ["api_key"] },
        "ai-gemini": { category: "google", keys: ["gemini_api_key"] },
        "ai-grok": { category: "grok", keys: ["api_key"] },
        "ai-azure": { category: "azure_openai", keys: ["api_key", "base_url", "deployment_name", "api_version"] },
        "ai-openrouter": { category: "openrouter", keys: ["api_key", "model"] },
        "ai-local": { category: "local_llm", keys: ["base_url", "api_key", "model"] },
      };
      const mapping = categoryMap[serviceId];
      if (!mapping) return;
      const nullSettings: Record<string, string | null> = {};
      for (const key of mapping.keys) nullSettings[key] = null as any;
      await api.updateCategorySettings(mapping.category, nullSettings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      queryClient.invalidateQueries({ queryKey: ["chat-status"] });
      setConfirmDisconnect(null);
      setDisconnecting(null);
    },
  });

  const disconnectOAuthMutation = useMutation({
    mutationFn: (provider: string) => api.disconnectOAuth(provider),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.invalidateQueries({ queryKey: ["calendars"] });
      queryClient.invalidateQueries({ queryKey: ["spotify-status"] });
      setConfirmDisconnect(null);
      setDisconnecting(null);
    },
  });

  // --- Status helpers ---

  function getServiceStatus(service: ServiceDef): {
    connected: boolean;
    detail: string;
    count?: number;
  } {
    switch (service.id) {
      case "google":
        return {
          connected: !!user?.linkedProviders?.includes("google"),
          detail: user?.linkedProviders?.includes("google") ? "Account linked" : "Not connected",
        };
      case "microsoft":
        return {
          connected: !!user?.linkedProviders?.includes("microsoft"),
          detail: user?.linkedProviders?.includes("microsoft") ? "Account linked" : "Not connected",
        };
      case "spotify": {
        const connected = !!user?.linkedProviders?.includes("spotify") || spotifyAccounts.length > 0;
        return {
          connected,
          detail: connected
            ? `${spotifyAccounts.length} account${spotifyAccounts.length !== 1 ? "s" : ""}`
            : "Not connected",
          count: spotifyAccounts.length,
        };
      }
      case "caldav": {
        const caldavCals = calendars.filter((c) => c.provider === "caldav");
        return {
          connected: caldavCals.length > 0,
          detail: `${caldavCals.length} calendar${caldavCals.length !== 1 ? "s" : ""}`,
          count: caldavCals.length,
        };
      }
      case "ics": {
        const icsCals = calendars.filter((c) => c.provider === "ics");
        return {
          connected: icsCals.length > 0,
          detail: `${icsCals.length} subscription${icsCals.length !== 1 ? "s" : ""}`,
          count: icsCals.length,
        };
      }
      case "homeassistant":
        return {
          connected: !!haConfig?.url,
          detail: haConfig?.url || "Not connected",
        };
      case "plex":
        return {
          connected: plexServers.length > 0,
          detail: `${plexServers.length} server${plexServers.length !== 1 ? "s" : ""}`,
          count: plexServers.length,
        };
      case "audiobookshelf":
        return {
          connected: audiobookshelfServers.length > 0,
          detail: `${audiobookshelfServers.length} server${audiobookshelfServers.length !== 1 ? "s" : ""}`,
          count: audiobookshelfServers.length,
        };
      case "iptv":
        return {
          connected: iptvServers.length > 0,
          detail: `${iptvServers.length} server${iptvServers.length !== 1 ? "s" : ""}`,
          count: iptvServers.length,
        };
      case "telegram":
        return {
          connected: !!telegramStatus?.connected,
          detail: telegramStatus?.connected
            ? `@${telegramStatus.botUsername}`
            : "Not connected",
        };
      case "whatsapp":
        return {
          connected: !!whatsappStatus?.connected,
          detail: whatsappStatus?.connected
            ? whatsappStatus.phoneNumber || "Connected"
            : "Not connected",
        };
      case "remarkable":
        return {
          connected: !!remarkableStatus?.connected,
          detail: remarkableStatus?.connected ? "Device linked" : "Not connected",
        };
      case "capacities":
        return {
          connected: !!capacitiesStatus?.connected,
          detail: capacitiesStatus?.connected
            ? `${capacitiesStatus.spaces?.length ?? 0} space${(capacitiesStatus.spaces?.length ?? 0) !== 1 ? "s" : ""}`
            : "Not connected",
        };
      case "weather": {
        const apiKey = weatherSettings.find((s) => s.key === "api_key");
        return {
          connected: !!apiKey?.value,
          detail: apiKey?.value ? "API key configured" : "Not connected",
        };
      }
      case "youtube": {
        const ytKey = googleSettings.find((s) => s.key === "youtube_api_key");
        return {
          connected: !!ytKey?.value,
          detail: ytKey?.value ? "API key configured" : "Not connected",
        };
      }
      case "photos":
        return {
          connected: photoAlbums.length > 0,
          detail: `${photoAlbums.length} album${photoAlbums.length !== 1 ? "s" : ""}`,
          count: photoAlbums.length,
        };
      case "google-photos": {
        const hasPhotosScope = hasFeatureScope(user?.grantedScopes, "google", "photos");
        const googleAlbumCount = (photoAlbums as any[]).filter((a: any) => a.googleAlbumId).length;
        return {
          connected: hasPhotosScope && googleAlbumCount > 0,
          detail: hasPhotosScope
            ? `${googleAlbumCount} album${googleAlbumCount !== 1 ? "s" : ""} linked`
            : "Not connected",
        };
      }
      case "sports":
        return {
          connected: favoriteTeams.length > 0,
          detail: `${favoriteTeams.length} team${favoriteTeams.length !== 1 ? "s" : ""}`,
          count: favoriteTeams.length,
        };
      case "ai-openframeai":
        return {
          connected: !!chatStatus?.hostedAiEnabled,
          detail: chatStatus?.hostedAiEnabled ? "Active" : "Not enabled",
        };
      case "ai-claude": {
        const hasAnthropicKey = !!anthropicSettings.find((s) => s.key === "api_key")?.value;
        return {
          connected: hasAnthropicKey,
          detail: hasAnthropicKey ? "API key configured" : "Not connected",
        };
      }
      case "ai-openai": {
        const hasOpenaiKey = !!openaiSettings.find((s) => s.key === "api_key")?.value;
        return {
          connected: hasOpenaiKey,
          detail: hasOpenaiKey ? "API key configured" : "Not connected",
        };
      }
      case "ai-azure": {
        const hasAzureKey = !!azureOpenaiSettings.find((s) => s.key === "api_key")?.value;
        return {
          connected: hasAzureKey,
          detail: hasAzureKey ? "API key configured" : "Not connected",
        };
      }
      case "ai-gemini": {
        const hasGeminiAiKey = !!googleSettings.find((s) => s.key === "gemini_api_key")?.value;
        return {
          connected: hasGeminiAiKey,
          detail: hasGeminiAiKey ? "API key configured" : "Not connected",
        };
      }
      case "ai-grok": {
        const hasGrokKey = !!grokSettings.find((s) => s.key === "api_key")?.value;
        return {
          connected: hasGrokKey,
          detail: hasGrokKey ? "API key configured" : "Not connected",
        };
      }
      case "ai-openrouter": {
        const hasOpenrouterKey = !!openrouterSettings.find((s) => s.key === "api_key")?.value;
        return {
          connected: hasOpenrouterKey,
          detail: hasOpenrouterKey ? "API key configured" : "Not connected",
        };
      }
      case "ai-local": {
        const hasLocalUrl = !!localLlmSettings.find((s) => s.key === "base_url")?.value;
        return {
          connected: hasLocalUrl,
          detail: hasLocalUrl ? "Server configured" : "Not connected",
        };
      }
      case "storage-ftp": {
        const ftpServers = storageServers.filter((s) => s.protocol === "ftp" || s.protocol === "sftp");
        return {
          connected: ftpServers.length > 0,
          detail: `${ftpServers.length} server${ftpServers.length !== 1 ? "s" : ""}`,
          count: ftpServers.length,
        };
      }
      case "storage-smb": {
        const smbServers = storageServers.filter((s) => s.protocol === "smb");
        return {
          connected: smbServers.length > 0,
          detail: `${smbServers.length} server${smbServers.length !== 1 ? "s" : ""}`,
          count: smbServers.length,
        };
      }
      case "storage-webdav": {
        const webdavServers = storageServers.filter((s) => s.protocol === "webdav");
        return {
          connected: webdavServers.length > 0,
          detail: `${webdavServers.length} server${webdavServers.length !== 1 ? "s" : ""}`,
          count: webdavServers.length,
        };
      }
      default: {
        // Dynamic news-* source entries
        if (service.id.startsWith("news-")) {
          const sourceSlug = service.id.replace("news-", "");
          if (sourceSlug === "custom") {
            const customFeeds = newsFeeds.filter((f) => !f.source);
            return {
              connected: customFeeds.length > 0,
              detail: `${customFeeds.length} feed${customFeeds.length !== 1 ? "s" : ""}`,
              count: customFeeds.length,
            };
          }
          const sourceFeeds = newsFeeds.filter((f) => f.source === sourceSlug);
          return {
            connected: sourceFeeds.length > 0,
            detail: `${sourceFeeds.length} feed${sourceFeeds.length !== 1 ? "s" : ""}`,
            count: sourceFeeds.length,
          };
        }
        return { connected: false, detail: "Not connected" };
      }
    }
  }

  function handleConnect(service: ServiceDef) {
    setShowAddModal(false);
    const token = useAuthStore.getState().accessToken;

    // For premium-eligible services, show the pricing modal first
    if (service.id === "weather") {
      setPremiumServiceModal("weather");
      return;
    }

    switch (service.id) {
      case "google":
        window.location.href = buildOAuthUrl("google", "calendar", token, appUrl("/settings/connections?connected=1"));
        return;
      case "microsoft":
        window.location.href = buildOAuthUrl("microsoft", "calendar", token, appUrl("/settings/connections?connected=1"));
        return;
      case "spotify":
        window.location.href = api.getSpotifyAuthUrl();
        return;
      case "google-photos": {
        const hasPhotos = hasFeatureScope(user?.grantedScopes, "google", "photos");
        if (hasPhotos) {
          onNavigateToService("google-photos");
        } else {
          window.location.href = buildOAuthUrl("google", "photos", token, appUrl("/settings/connections?service=google-photos&connected=1"));
        }
        return;
      }
      case "whatsapp":
        setShowWhatsApp(true);
        return;
      case "storage-ftp":
        setShowStorageConfig("ftp");
        return;
      case "storage-smb":
        setShowStorageConfig("smb");
        return;
      case "storage-webdav":
        setShowStorageConfig("webdav");
        return;
      default:
        // Check if this is an AI service that could use premium
        if (service.id.startsWith("ai-")) {
          setPremiumServiceModal("ai");
          return;
        }
        // For services with a connection detail view, navigate within connections
        if (service.configRoute) {
          navigate(service.configRoute);
        } else if (service.configService) {
          onNavigateToService(service.configService);
        } else if (service.configTab) {
          onNavigateToTab(service.configTab);
        }
    }
  }

  function handleDisconnect(serviceId: string) {
    setDisconnecting(serviceId);
    switch (serviceId) {
      case "telegram":
        disconnectTelegram.mutate();
        break;
      case "whatsapp":
        disconnectWhatsApp.mutate();
        break;
      case "remarkable":
        disconnectRemarkable.mutate();
        break;
      case "capacities":
        disconnectCapacities.mutate();
        break;
      case "homeassistant":
        deleteHAConfig.mutate();
        break;
      case "google":
      case "microsoft":
      case "spotify":
        disconnectOAuthMutation.mutate(serviceId);
        break;
      case "ai-claude":
      case "ai-openai":
      case "ai-gemini":
      case "ai-grok":
      case "ai-azure":
      case "ai-openrouter":
      case "ai-local":
        disconnectAIProvider.mutate(serviceId);
        break;
      default: {
        // For multi-resource services, navigate to config
        const service = allServices.find((s) => s.id === serviceId);
        if (service?.configService) {
          onNavigateToService(service.configService);
        } else if (service?.configTab) {
          onNavigateToTab(service.configTab);
        }
        setDisconnecting(null);
        setConfirmDisconnect(null);
      }
    }
  }

  // Build per-account calendar entries from calendars data
  const calendarAccountRows = useMemo(() => {
    const map = new Map<string, { key: string; provider: string; label: string; count: number; enabledCount: number; icon: React.ReactNode; bgColor: string }>();

    for (const cal of calendars) {
      const key = cal.oauthTokenId
        ? `oauth:${cal.oauthTokenId}`
        : `provider:${cal.provider}`;

      if (!map.has(key)) {
        const serviceDef = SERVICES.find((s) => s.id === cal.provider);
        map.set(key, {
          key,
          provider: cal.provider,
          label: cal.accountLabel || serviceDef?.name || cal.provider,
          count: 0,
          enabledCount: 0,
          icon: serviceDef?.icon ?? <span className="text-lg">📅</span>,
          bgColor: serviceDef?.bgColor ?? "bg-primary/10",
        });
      }
      const entry = map.get(key)!;
      entry.count++;
      if (cal.isVisible) entry.enabledCount++;
    }

    // Include linked OAuth providers with no calendars synced yet
    for (const provider of ["google", "microsoft"] as const) {
      if (
        user?.linkedProviders?.includes(provider) &&
        !Array.from(map.values()).some((r) => r.provider === provider)
      ) {
        const serviceDef = SERVICES.find((s) => s.id === provider)!;
        const hasCalScopes = hasFeatureScope(user?.grantedScopes, provider, "calendar");
        map.set(`${provider}-pending`, {
          key: `${provider}-pending`,
          provider,
          label: hasCalScopes
            ? `${serviceDef.name} (syncing...)`
            : `${serviceDef.name} — calendar access needed`,
          count: 0,
          enabledCount: 0,
          icon: serviceDef.icon,
          bgColor: serviceDef.bgColor,
        });
      }
    }

    return Array.from(map.values());
  }, [calendars, user]);

  // Dynamic news source ServiceDefs
  const allServices = useMemo(() => {
    const newsEntries: ServiceDef[] = newsSources.map((src) => ({
      id: `news-${src.id}`,
      name: src.name,
      description: src.description,
      icon: <span className="text-lg">{src.icon}</span>,
      bgColor: "bg-primary/10",
      category: "information" as ServiceCategory,
      configService: `news-${src.id}`,
    }));
    newsEntries.push({
      id: "news-custom",
      name: "Custom RSS",
      description: "Manually-added feed URLs",
      icon: <span className="text-lg">📰</span>,
      bgColor: "bg-primary/10",
      category: "information" as ServiceCategory,
      configService: "news-custom",
    });
    return [...SERVICES, ...newsEntries];
  }, [newsSources]);

  // Split services into connected vs unconnected (exclude calendar category from static list)
  const connectedServices = allServices.filter((s) => s.category !== "calendar" && getServiceStatus(s).connected);
  // Always include Google & Microsoft in the add modal (for reconnect / add account)
  const unconnectedServices = allServices.filter(
    (s) => !getServiceStatus(s).connected || s.id === "google" || s.id === "microsoft"
  );

  // Group connected non-calendar services by category
  const nonCalendarGroups = CATEGORY_ORDER
    .filter((cat) => cat !== "calendar")
    .map((cat) => ({
      category: cat,
      label: CATEGORY_LABELS[cat],
      services: connectedServices.filter((s) => s.category === cat),
    }))
    .filter((g) => g.services.length > 0);

  // Combined total for the header count
  const totalConnected = connectedServices.length + calendarAccountRows.length;

  // Filter unconnected services for the add modal (by category + search)
  const filteredAddServices = useMemo(() => {
    let list = unconnectedServices;
    if (addModalCategory !== "all") {
      list = list.filter((s) => s.category === addModalCategory);
    }
    if (addModalSearch.trim()) {
      const q = addModalSearch.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q)
      );
    }
    return list;
  }, [unconnectedServices, addModalCategory, addModalSearch]);

  return (
    <div className="space-y-6">
      {/* Header with Add button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Link2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">
              {totalConnected} connected service{totalConnected !== 1 ? "s" : ""}
            </p>
            <p className="text-sm text-muted-foreground">
              Manage your linked accounts and integrations
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setAddModalCategory("all");
            setAddModalSearch("");
            setShowAddModal(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Connection
        </Button>
      </div>

      {/* Connected services list */}
      {totalConnected === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
          <Link2 className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium">No connections yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Click "Add Connection" to link your first service
          </p>
        </div>
      ) : (
        <>
          {/* Calendar accounts (dynamic per-account rows) */}
          {calendarAccountRows.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary">
                {CATEGORY_LABELS.calendar}
              </h3>
              <div className="space-y-2">
                {calendarAccountRows.map((account) => {
                  const isConfirming = confirmDisconnect === account.key;
                  const isDisconnecting = disconnecting === account.provider;
                  const isOAuth = account.provider === "google" || account.provider === "microsoft";
                  const isPending = account.key.endsWith("-pending");

                  return (
                    <div
                      key={account.key}
                      className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted/30"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${account.bgColor}`}
                        >
                          {account.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{account.label}</p>
                            <span className="flex items-center gap-1 text-xs text-primary">
                              <Check className="h-3 w-3" />
                              Connected
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {account.count} calendar{account.count !== 1 ? "s" : ""}{account.count > 0 && ` (${account.enabledCount} enabled)`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-4">
                        {isConfirming ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              Disconnect?
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setConfirmDisconnect(null)}
                              disabled={isDisconnecting}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive border-destructive/40 hover:bg-destructive/10"
                              onClick={() => handleDisconnect(account.provider)}
                              disabled={isDisconnecting}
                            >
                              {isDisconnecting ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Unlink className="mr-1 h-3 w-3" />
                              )}
                              Disconnect
                            </Button>
                          </div>
                        ) : (
                          <>
                            {isPending && isOAuth && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => {
                                  const service = SERVICES.find((s) => s.id === account.provider);
                                  if (service) handleConnect(service);
                                }}
                              >
                                Grant Calendar Access
                              </Button>
                            )}
                            {!isPending && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate(`/settings/connections?service=calendars&account=${encodeURIComponent(account.key)}`)}
                              >
                                <Settings className="mr-1 h-3 w-3" />
                                Configure
                              </Button>
                            )}
                            {isOAuth && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-muted-foreground hover:text-destructive hover:border-destructive/40"
                                onClick={() => setConfirmDisconnect(account.key)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                            {isOAuth && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const service = SERVICES.find((s) => s.id === account.provider);
                                  if (service) handleConnect(service);
                                }}
                              >
                                <RefreshCw className="mr-1 h-3 w-3" />
                                Reconnect
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Other connected services (static entries) */}
          {nonCalendarGroups.map((group) => (
            <div key={group.category}>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary">
                {group.label}
              </h3>
              <div className="space-y-2">
                {group.services.map((service) => {
                  const status = getServiceStatus(service);
                  const isConfirming = confirmDisconnect === service.id;
                  const isDisconnecting = disconnecting === service.id;

                  return (
                    <div
                      key={service.id}
                      className={`flex items-center justify-between rounded-lg border border-primary/20 p-4 transition-colors hover:bg-muted/30 hover:border-primary/35 ${service.configRoute || service.configService || service.configTab || service.id === "whatsapp" ? "cursor-pointer" : ""}`}
                      onClick={() => {
                        if (service.id === "whatsapp") {
                          setShowWhatsApp(true);
                        } else if (service.configRoute) {
                          navigate(service.configRoute);
                        } else if (service.configService) {
                          onNavigateToService(service.configService);
                        } else if (service.configTab) {
                          onNavigateToTab(service.configTab);
                        }
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${service.bgColor}`}
                        >
                          {service.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{service.name}</p>
                            <span className="flex items-center gap-1 text-xs text-primary">
                              <Check className="h-3 w-3" />
                              Connected
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {status.detail}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-4">
                        {isConfirming ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              Disconnect?
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); setConfirmDisconnect(null); }}
                              disabled={isDisconnecting}
                            >
                              Cancel
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive border-destructive/40 hover:bg-destructive/10"
                              onClick={(e) => { e.stopPropagation(); handleDisconnect(service.id); }}
                              disabled={isDisconnecting}
                            >
                              {isDisconnecting ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Unlink className="mr-1 h-3 w-3" />
                              )}
                              Disconnect
                            </Button>
                          </div>
                        ) : (
                          <>
                            {(service.configRoute || service.configService || service.configTab) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (service.configRoute) {
                                    navigate(service.configRoute);
                                  } else if (service.configService) {
                                    onNavigateToService(service.configService);
                                  } else if (service.configTab) {
                                    onNavigateToTab(service.configTab);
                                  }
                                }}
                              >
                                <Settings className="mr-1 h-3 w-3" />
                                Configure
                              </Button>
                            )}
                            {["telegram", "whatsapp", "remarkable", "capacities", "homeassistant", "spotify", "ai-claude", "ai-openai", "ai-gemini", "ai-grok", "ai-azure", "ai-openrouter", "ai-local"].includes(service.id) && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-muted-foreground hover:text-destructive hover:border-destructive/40"
                                onClick={(e) => { e.stopPropagation(); setConfirmDisconnect(service.id); }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                            {["spotify"].includes(service.id) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); handleConnect(service); }}
                              >
                                <RefreshCw className="mr-1 h-3 w-3" />
                                Reconnect
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Add Connection Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowAddModal(false)}
          />

          {/* Modal — anchored to top */}
          <div className="absolute left-1/2 top-8 z-10 flex w-full max-w-2xl -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl" style={{ maxHeight: "calc(100vh - 4rem)" }}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold">Add a Connection</h2>
              <div className="flex items-center gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={addModalSearch}
                    onChange={(e) => setAddModalSearch(e.target.value)}
                    className="h-9 w-48 rounded-lg border border-border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  {addModalSearch && (
                    <button
                      onClick={() => setAddModalSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Body: sidebar + grid */}
            <div className="flex flex-1 overflow-hidden">
              {/* Category sidebar */}
              <div className="w-48 shrink-0 border-r border-border overflow-y-auto bg-muted/30 py-2">
                <button
                  type="button"
                  onClick={() => setAddModalCategory("all")}
                  className={`w-full px-4 py-2 text-left text-sm font-medium transition-colors ${
                    addModalCategory === "all"
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-primary/10"
                  }`}
                >
                  All
                </button>
                {CATEGORY_ORDER.map((cat) => {
                  const catServices = unconnectedServices.filter((s) => s.category === cat);
                  if (catServices.length === 0) return null;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setAddModalCategory(cat)}
                      className={`w-full px-4 py-2 text-left text-sm font-medium transition-colors ${
                        addModalCategory === cat
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-primary/10"
                      }`}
                    >
                      {CATEGORY_LABELS[cat]}
                    </button>
                  );
                })}
              </div>

              {/* Service grid */}
              <div className="flex-1 overflow-y-auto p-4">
                {filteredAddServices.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Search className="h-8 w-8 mb-3" />
                    <p className="text-sm">
                      {unconnectedServices.length === 0
                        ? "All services are already connected"
                        : "No services match your search"}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {filteredAddServices.map((service) => (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => handleConnect(service)}
                        className="flex items-start gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                      >
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${service.bgColor}`}
                        >
                          {service.icon}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium">{service.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {service.description}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Settings Modal */}
      {showWhatsApp && (
        <WhatsAppSettings
          onClose={() => {
            setShowWhatsApp(false);
            queryClient.invalidateQueries({ queryKey: ["whatsapp-status"] });
          }}
        />
      )}

      {/* Storage Server Config Modal */}
      {showStorageConfig && (
        <StorageServerConfig
          protocol={showStorageConfig}
          serverId={editingStorageServer}
          onClose={() => {
            setShowStorageConfig(null);
            setEditingStorageServer(null);
            queryClient.invalidateQueries({ queryKey: ["storage-servers"] });
          }}
        />
      )}

      {/* Premium Service Pricing Modal */}
      {premiumServiceModal && (
        <ServicePricingModal
          serviceType={premiumServiceModal}
          onClose={() => setPremiumServiceModal(null)}
          onUseOwnKey={() => {
            const serviceType = premiumServiceModal;
            setPremiumServiceModal(null);
            // Navigate to the manual configuration for this service
            if (serviceType === "weather") {
              onNavigateToService("weather");
            } else if (serviceType === "traffic") {
              onNavigateToService("maps");
            } else if (serviceType === "ai") {
              onNavigateToService("ai-openframeai");
            }
          }}
        />
      )}
    </div>
  );
}
