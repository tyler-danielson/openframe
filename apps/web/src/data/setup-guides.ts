export interface SetupGuideStep {
  instruction: string;
  url?: string;
  urlLabel?: string;
  substeps?: string[];
  hint?: string;
}

export interface SetupGuideGotcha {
  text: string;
  severity: "warning" | "info";
}

export interface SetupGuideData {
  id: string;
  title: string;
  description: string;
  consoleUrl: string;
  consoleName: string;
  steps: SetupGuideStep[];
  gotchas?: SetupGuideGotcha[];
  redirectUris?: { label: string; path: string }[];
  estimatedTime?: string;
}

export const SETUP_GUIDES: Record<string, SetupGuideData> = {
  google: {
    id: "google",
    title: "Google OAuth",
    description: "Calendar, Tasks, Gmail, and Photos integration",
    consoleUrl: "https://console.cloud.google.com/apis/credentials",
    consoleName: "Google Cloud Console",
    estimatedTime: "~10 min",
    steps: [
      {
        instruction: "Go to the Google Cloud Console and create a new project (or select an existing one).",
        url: "https://console.cloud.google.com/projectcreate",
        urlLabel: "Create Project",
        hint: "Name it something like \"OpenFrame\".",
      },
      {
        instruction: "Enable the required APIs for your project.",
        url: "https://console.cloud.google.com/apis/library",
        urlLabel: "API Library",
        substeps: [
          "Google Calendar API",
          "Google Tasks API",
          "Gmail API",
          "Google Photos Library API",
        ],
        hint: "Search for each API by name and click \"Enable\".",
      },
      {
        instruction: "Configure the OAuth consent screen.",
        url: "https://console.cloud.google.com/apis/credentials/consent",
        urlLabel: "Consent Screen",
        substeps: [
          "Choose \"External\" user type",
          "Fill in App name (e.g., \"OpenFrame\") and your email",
          "Add scopes: calendar, tasks, gmail.readonly, photoslibrary.readonly",
          "Add your Google account email as a test user",
        ],
      },
      {
        instruction: "Create OAuth 2.0 credentials.",
        url: "https://console.cloud.google.com/apis/credentials",
        urlLabel: "Credentials",
        substeps: [
          "Click \"Create Credentials\" → \"OAuth client ID\"",
          "Application type: \"Web application\"",
          "Name: \"OpenFrame\" (or anything)",
          "Add your redirect URI(s) under \"Authorized redirect URIs\" (shown below)",
        ],
      },
      {
        instruction: "Copy the Client ID and Client Secret into the fields above.",
        hint: "You can always find these later under Credentials → your OAuth client.",
      },
    ],
    gotchas: [
      {
        text: "While in \"Testing\" mode, only test users you've added can sign in. You can publish the app later to remove this restriction.",
        severity: "info",
      },
      {
        text: "If you get a \"redirect_uri_mismatch\" error, make sure the redirect URI registered in Google Cloud Console exactly matches the one shown below (including http vs https).",
        severity: "warning",
      },
    ],
    redirectUris: [
      { label: "Google OAuth", path: "/api/v1/auth/oauth/google/callback" },
    ],
  },

  microsoft: {
    id: "microsoft",
    title: "Microsoft OAuth",
    description: "Outlook Calendar and Tasks integration",
    consoleUrl: "https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade",
    consoleName: "Azure Portal",
    estimatedTime: "~10 min",
    steps: [
      {
        instruction: "Go to Azure Portal → App registrations and click \"New registration\".",
        url: "https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade",
        urlLabel: "App Registrations",
      },
      {
        instruction: "Configure the registration.",
        substeps: [
          "Name: \"OpenFrame\" (or anything)",
          "Supported account types: \"Accounts in any organizational directory and personal Microsoft accounts\"",
          "Redirect URI: select \"Web\" and enter your redirect URI (shown below)",
          "Click \"Register\"",
        ],
      },
      {
        instruction: "Copy the Application (Client) ID from the overview page — paste it into the field above.",
      },
      {
        instruction: "Create a client secret.",
        substeps: [
          "Go to \"Certificates & secrets\" in the left sidebar",
          "Click \"New client secret\"",
          "Description: \"OpenFrame\" — Expiry: 24 months",
          "Copy the secret Value (not the Secret ID) immediately",
        ],
      },
      {
        instruction: "Add API permissions.",
        substeps: [
          "Go to \"API permissions\" in the left sidebar",
          "Click \"Add a permission\" → \"Microsoft Graph\" → \"Delegated permissions\"",
          "Add: Calendars.ReadWrite, Tasks.ReadWrite, User.Read, offline_access",
          "Click \"Add permissions\"",
        ],
      },
      {
        instruction: "Paste the Client Secret value into the field above.",
        hint: "Leave Tenant ID as \"common\" unless you need to restrict to a single organization.",
      },
    ],
    gotchas: [
      {
        text: "Azure only shows the client secret value once — right after you create it. If you lose it, you'll need to create a new secret.",
        severity: "warning",
      },
      {
        text: "The Tenant ID field should be \"common\" for personal Microsoft accounts. Only change it if you're restricting to a specific organization.",
        severity: "info",
      },
    ],
    redirectUris: [
      { label: "Microsoft OAuth", path: "/api/v1/auth/oauth/microsoft/callback" },
    ],
  },

  spotify: {
    id: "spotify",
    title: "Spotify OAuth",
    description: "Music playback control and now-playing display",
    consoleUrl: "https://developer.spotify.com/dashboard",
    consoleName: "Spotify Developer Dashboard",
    estimatedTime: "~5 min",
    steps: [
      {
        instruction: "Go to the Spotify Developer Dashboard and log in with your Spotify account.",
        url: "https://developer.spotify.com/dashboard",
        urlLabel: "Spotify Dashboard",
      },
      {
        instruction: "Click \"Create app\".",
        substeps: [
          "App name: \"OpenFrame\"",
          "App description: anything",
          "Redirect URI: enter your redirect URI (shown below)",
          "Select \"Web API\" under APIs used",
          "Accept the terms and click \"Save\"",
        ],
      },
      {
        instruction: "Go to Settings and copy the Client ID and Client Secret.",
        hint: "Click \"View client secret\" to reveal it.",
      },
      {
        instruction: "Paste the Client ID and Client Secret into the settings fields.",
      },
    ],
    gotchas: [
      {
        text: "Spotify apps start in \"Development mode\" which allows up to 25 users. This is fine for personal use.",
        severity: "info",
      },
    ],
    redirectUris: [
      { label: "Spotify OAuth", path: "/api/v1/spotify/auth/callback" },
    ],
  },

  weather: {
    id: "weather",
    title: "OpenWeatherMap",
    description: "Weather forecasts and current conditions",
    consoleUrl: "https://home.openweathermap.org/api_keys",
    consoleName: "OpenWeatherMap",
    estimatedTime: "~3 min",
    steps: [
      {
        instruction: "Create a free account at OpenWeatherMap.",
        url: "https://home.openweathermap.org/users/sign_up",
        urlLabel: "Sign Up",
      },
      {
        instruction: "Go to your API keys page.",
        url: "https://home.openweathermap.org/api_keys",
        urlLabel: "API Keys",
      },
      {
        instruction: "Copy the default API key (or create a new one) and paste it into the field above.",
        hint: "The free tier includes current weather and 5-day forecasts — more than enough for OpenFrame.",
      },
    ],
    gotchas: [
      {
        text: "New API keys can take up to 10 minutes to activate. If you get errors right after creating a key, wait a few minutes and try again.",
        severity: "warning",
      },
    ],
  },

  google_maps: {
    id: "google_maps",
    title: "Google Maps API",
    description: "Location lookup and commute time estimates",
    consoleUrl: "https://console.cloud.google.com/apis/credentials",
    consoleName: "Google Cloud Console",
    estimatedTime: "~5 min",
    steps: [
      {
        instruction: "Go to Google Cloud Console (use the same project as Google OAuth if you have one).",
        url: "https://console.cloud.google.com/apis/library",
        urlLabel: "API Library",
      },
      {
        instruction: "Enable the required APIs.",
        substeps: [
          "Geocoding API (for location lookup)",
          "Directions API (for commute times)",
        ],
        hint: "Search for each API by name and click \"Enable\".",
      },
      {
        instruction: "Create an API key.",
        substeps: [
          "Go to Credentials → \"Create Credentials\" → \"API key\"",
          "Optionally restrict the key to only Geocoding API and Directions API",
        ],
        url: "https://console.cloud.google.com/apis/credentials",
        urlLabel: "Credentials",
      },
      {
        instruction: "Copy the API key and paste it into the field above.",
        hint: "Google gives $200/month free credit which covers thousands of requests.",
      },
    ],
    gotchas: [
      {
        text: "You must enable billing on your Google Cloud project for Maps APIs to work, but the free tier is very generous for personal use.",
        severity: "info",
      },
    ],
  },

  homeassistant: {
    id: "homeassistant",
    title: "Home Assistant",
    description: "Smart home device control and status",
    consoleUrl: "",
    consoleName: "Home Assistant",
    estimatedTime: "~3 min",
    steps: [
      {
        instruction: "Open your Home Assistant instance and go to your profile.",
        substeps: [
          "Click your name in the bottom-left sidebar",
          "Scroll to the bottom of the profile page",
        ],
      },
      {
        instruction: "Create a Long-Lived Access Token.",
        substeps: [
          "Under \"Long-lived access tokens\", click \"Create Token\"",
          "Name: \"OpenFrame\"",
          "Copy the token immediately — it won't be shown again",
        ],
      },
      {
        instruction: "Enter your Home Assistant URL (e.g., http://homeassistant.local:8123) and the token above.",
      },
    ],
    gotchas: [
      {
        text: "The access token is only shown once when created. If you lose it, delete the old one and create a new one.",
        severity: "warning",
      },
      {
        text: "Make sure your OpenFrame server can reach your Home Assistant URL on the network.",
        severity: "info",
      },
    ],
  },

  telegram: {
    id: "telegram",
    title: "Telegram Bot",
    description: "Notifications, reminders, and bot commands",
    consoleUrl: "https://t.me/BotFather",
    consoleName: "BotFather",
    estimatedTime: "~2 min",
    steps: [
      {
        instruction: "Open Telegram and start a chat with @BotFather.",
        url: "https://t.me/BotFather",
        urlLabel: "Open BotFather",
      },
      {
        instruction: "Create a new bot.",
        substeps: [
          "Send /newbot",
          "Choose a display name (e.g., \"OpenFrame\")",
          "Choose a username ending in \"bot\" (e.g., \"my_openframe_bot\")",
        ],
      },
      {
        instruction: "Copy the bot token that BotFather gives you and paste it into the field above.",
        hint: "The token looks like: 123456789:ABCDefGhIJKlmNoPQRSTuvwxyz",
      },
    ],
    gotchas: [
      {
        text: "After connecting the bot, you'll need to send /start to your bot in Telegram to link your chat.",
        severity: "info",
      },
    ],
  },

  ai: {
    id: "ai",
    title: "AI API Keys",
    description: "OpenAI and Anthropic for smart features",
    consoleUrl: "https://platform.openai.com/api-keys",
    consoleName: "OpenAI / Anthropic Console",
    estimatedTime: "~5 min",
    steps: [
      {
        instruction: "For OpenAI: go to the API keys page and create a new key.",
        url: "https://platform.openai.com/api-keys",
        urlLabel: "OpenAI API Keys",
        substeps: [
          "Click \"Create new secret key\"",
          "Name: \"OpenFrame\"",
          "Copy the key immediately",
        ],
      },
      {
        instruction: "For Anthropic: go to the API keys page and create a new key.",
        url: "https://console.anthropic.com/settings/keys",
        urlLabel: "Anthropic API Keys",
        substeps: [
          "Click \"Create Key\"",
          "Name: \"OpenFrame\"",
          "Copy the key immediately",
        ],
      },
      {
        instruction: "Paste the key(s) into the corresponding fields above.",
        hint: "You only need one AI provider — OpenAI or Anthropic, not both.",
      },
    ],
    gotchas: [
      {
        text: "Both OpenAI and Anthropic require a paid account with credits. Check your usage limits and billing.",
        severity: "info",
      },
      {
        text: "API keys are only shown once when created. Store them safely.",
        severity: "warning",
      },
    ],
  },
};
