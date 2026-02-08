# OpenFrame Mobile

React Native + Expo mobile companion app for OpenFrame.

## Features

- **Calendar Viewing**: View your calendars with multi-calendar support
- **Event Management**: Create, edit, and delete events
- **Quick Event Creation**: Natural language event input
- **Settings**: Calendar visibility toggles, kiosk refresh trigger

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9.14+
- Expo Go app on your mobile device (for development)

### Installation

From the monorepo root:

```bash
pnpm install
```

### Development

```bash
# From monorepo root
pnpm --filter @openframe/mobile start

# Or from this directory
pnpm start
```

Then scan the QR code with Expo Go (Android) or the Camera app (iOS).

### Building

```bash
# Build for iOS
pnpm --filter @openframe/mobile ios

# Build for Android
pnpm --filter @openframe/mobile android
```

## Authentication

The mobile app uses API key authentication:

1. Generate an API key in the OpenFrame web app under Settings → API Keys
2. Enter your server URL and API key in the mobile app
3. Or scan the QR code from the web app Settings page

## Project Structure

```
apps/mobile/
├── app/                    # Expo Router file-based routing
│   ├── (auth)/            # Authentication screens
│   ├── (tabs)/            # Main tab navigation
│   └── event/             # Event detail/create screens
├── components/            # Reusable UI components
├── hooks/                 # Custom React hooks
├── services/              # API client
├── stores/                # Zustand state stores
└── constants/             # Colors, configuration
```

## Tech Stack

- **Expo SDK 52** - React Native framework
- **Expo Router** - File-based navigation
- **NativeWind** - Tailwind CSS for React Native
- **TanStack Query** - Data fetching & caching
- **Zustand** - State management
- **react-native-calendars** - Calendar component

## Icons

Before building for production, add these icons to `assets/`:

- `icon.png` (1024x1024) - App icon
- `adaptive-icon.png` (1024x1024) - Android adaptive icon
- `splash-icon.png` (512x512) - Splash screen icon
- `favicon.png` (48x48) - Web favicon
