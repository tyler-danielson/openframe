# OpenFrame

A self-hosted calendar dashboard combining Skylight aesthetics with Dakboard flexibility. Features Google/Outlook calendar sync, photo slideshow, Home Assistant integration, Telegram bot, and REST API for automation.

## Features

- **Calendar Dashboard** - Month/week/day/agenda views with Google & Microsoft calendar sync
- **Photo Slideshow** - Display photos from local albums in a sidebar
- **Home Assistant** - Weather widgets, sensor data, light controls
- **Telegram Bot** - Query your calendar and add events via Telegram
- **REST API** - Full API for n8n, Home Assistant, and custom automations
- **PWA Support** - Installable as an app, works offline

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 16+
- Redis 7+

### Development Setup

1. **Clone and install dependencies:**

```bash
cd openframe
pnpm install
```

2. **Set up environment:**

```bash
cp apps/api/.env.example apps/api/.env
# Edit .env with your configuration
```

3. **Start the database:**

```bash
# Using Docker
docker compose -f docker/docker-compose.yml up postgres redis -d
```

4. **Run database migrations:**

```bash
pnpm db:push
```

5. **Start development servers:**

```bash
pnpm dev
```

The app will be available at:
- Frontend: http://localhost:3000
- API: http://localhost:3001
- API Docs: http://localhost:3001/docs

### Docker Deployment

No build tools required — just Docker.

1. **Clone and start:**

```bash
git clone https://github.com/tyler-danielson/openframe.git
cd openframe/docker
docker compose up -d
```

That's it! The app will be available at:
- Frontend: http://localhost:8080
- API: http://localhost:3001
- API Docs: http://localhost:3001/docs

All secrets (JWT, cookies, encryption keys) are auto-generated on first run and persisted across restarts. OAuth and integrations can be configured via the Setup Wizard in the UI.

2. **Optional: customize settings**

```bash
cp .env.example .env
# Edit .env with your OAuth credentials or other settings
docker compose up -d
```

3. **With Telegram bot:**

```bash
docker compose --profile bot up -d
```

### Portainer / Cosmos Cloud Deployment

If you're using Portainer, Cosmos Cloud, or another Docker management platform:

1. Copy the contents of [`docker/docker-compose.portable.yml`](docker/docker-compose.portable.yml)
2. Paste it into your platform's stack/compose editor
3. (Optional) Add environment variables for OAuth, etc.
4. Deploy!

Images are automatically built and published to GitHub Container Registry on every push to `main`.

## Configuration

### Google Calendar Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable the Google Calendar API and Google Tasks API
4. Create OAuth 2.0 credentials
5. Add `http://localhost:3001/api/v1/auth/oauth/google/callback` as an authorized redirect URI
6. Copy the Client ID and Client Secret to your `.env` file

### Microsoft Outlook Setup

1. Go to [Azure Portal](https://portal.azure.com/)
2. Register a new application
3. Add Microsoft Graph permissions: `Calendars.ReadWrite`, `Tasks.ReadWrite`
4. Add `http://localhost:3001/api/v1/auth/oauth/microsoft/callback` as a redirect URI
5. Copy the Client ID and Client Secret to your `.env` file

### Telegram Bot Setup

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Create a new bot with `/newbot`
3. Copy the bot token to your `.env` file
4. Generate an API key in OpenFrame settings
5. Set the API key in the bot's environment

## Project Structure

```
openframe/
├── apps/
│   ├── web/          # React frontend
│   ├── api/          # Fastify backend
│   └── bot/          # Telegram bot
├── packages/
│   ├── database/     # Drizzle schema
│   ├── shared/       # Types & validators
│   ├── eslint-config/
│   └── typescript-config/
└── docker/
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/refresh` - Refresh access token
- `GET /api/v1/auth/oauth/google` - Google OAuth flow
- `GET /api/v1/auth/oauth/microsoft` - Microsoft OAuth flow
- `POST /api/v1/auth/api-keys` - Create API key

### Calendars
- `GET /api/v1/calendars` - List calendars
- `POST /api/v1/calendars/:id/sync` - Sync calendar

### Events
- `GET /api/v1/events?start=&end=` - Get events
- `POST /api/v1/events` - Create event
- `POST /api/v1/events/quick` - Natural language event

### Bot
- `GET /api/v1/bot/today` - Today's summary
- `GET /api/v1/bot/upcoming` - Next 7 days
- `POST /api/v1/bot/add-event` - Add event

## Raspberry Pi Deployment

1. Install Docker on your Pi
2. Clone this repository
3. Run `cd docker && docker compose up -d`
4. Open a browser in kiosk mode pointing to `http://localhost:8080`

### Kiosk Mode (Raspberry Pi OS)

```bash
# Add to ~/.config/autostart/kiosk.desktop
[Desktop Entry]
Type=Application
Name=OpenFrame
Exec=chromium-browser --kiosk --noerrdialogs http://localhost:3000
```

## Development

```bash
# Run all services
pnpm dev

# Run specific service
pnpm --filter @openframe/api dev
pnpm --filter @openframe/web dev

# Database operations
pnpm db:generate  # Generate migrations
pnpm db:migrate   # Run migrations
pnpm db:push      # Push schema (dev)
pnpm db:studio    # Open Drizzle Studio

# Build
pnpm build

# Lint
pnpm lint
```

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Radix UI
- **Backend:** Fastify, TypeScript, Drizzle ORM
- **Database:** PostgreSQL, Redis
- **Bot:** grammY
- **Build:** Turborepo, pnpm
- **Deploy:** Docker Compose

## Support

If you enjoy OpenFrame, consider buying me a beer!

[![Buy Me a Beer](https://img.shields.io/badge/Buy%20Me%20a%20Beer-%F0%9F%8D%BA-yellow?style=for-the-badge)](https://buymeacoffee.com/pfro7xl)

## License

MIT
