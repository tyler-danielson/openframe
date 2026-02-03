# OpenFrame Build Notes

> Reference document for development sessions. Updated as the project evolves.

---

## 1. Project Overview

**App Name:** OpenFrame
**Purpose:** Self-hosted dashboard/calendar hub (Skylight/Dakboard alternative)

**Core Features:**
- Unified calendar view (Google, Outlook, local events)
- Photo slideshows (Google Photos, local storage)
- Weather, sports scores, home automation widgets
- Spotify now-playing integration
- Kiosk mode for always-on displays
- Telegram bot for remote control

---

## 2. Monorepo Structure

```
openframe/
├── apps/
│   ├── api/                # Fastify REST API (port 6001)
│   ├── web/                # React + Vite frontend (port 5176)
│   └── bot/                # Telegram bot (grammY)
├── packages/
│   ├── database/           # Drizzle ORM schema
│   ├── shared/             # Types & Zod validators
│   ├── eslint-config/      # Shared ESLint configuration
│   └── typescript-config/  # Shared TypeScript configuration
└── docker/                 # Docker Compose & Dockerfiles
```

---

## 3. Tech Stack Reference

### Backend
- **Framework:** Fastify 5
- **Language:** TypeScript
- **ORM:** Drizzle ORM
- **Database:** PostgreSQL
- **Queue/Cache:** Redis + BullMQ

### Frontend
- **Framework:** React 18
- **Build Tool:** Vite 6
- **Styling:** Tailwind CSS
- **State (UI):** Zustand
- **State (Server):** TanStack Query (React Query)

### UI Components
- **Primitives:** Radix UI
- **Icons:** Lucide React
- **Animation:** Framer Motion

---

## 4. Key Patterns & Conventions

### API Routes
- **Versioning:** `/api/v1/<domain>` (e.g., `/api/v1/calendars`)
- **Response Format:**
  ```typescript
  {
    success: boolean;
    data: T;
    error?: {
      code: string;
      message: string;
    };
  }
  ```
- **Authentication:** `onRequest: [fastify.authenticate]` decorator

### Services

**Singleton Pattern** (shared across requests):
```typescript
export function getServiceName(fastify: FastifyInstance) {
  if (!fastify.serviceName) {
    fastify.decorate('serviceName', new ServiceName(fastify.db));
  }
  return fastify.serviceName;
}
```

**Instance Pattern** (user-scoped):
```typescript
const service = new ServiceClass(db, userId);
```

### Frontend

- **Component Organization:** Feature-based folders (`features/calendar/`, `features/photos/`)
- **State Management:**
  - Zustand for UI state (modals, sidebar, theme)
  - React Query for server state (data fetching, caching)
- **API Client:** Single `ApiClient` class in `services/api.ts`
- **Hooks:** Custom hooks in `hooks/` directory

### Database

- **User Scoping:** All tables have `userId` column with index
- **Naming:** snake_case columns in DB, camelCase in TypeScript
- **Validation:** Zod schemas in `@openframe/shared`
- **Migrations:** Drizzle Kit for schema changes

---

## 5. Authentication

### JWT Strategy
- **Access Token:** 15 minutes expiry
- **Refresh Token:** 7 days expiry, family rotation (revoke all on reuse)

### API Keys
- **Format:** `openframe_<prefix>_<secret>`
- **Usage:** Header `X-API-Key` or query param `?apiKey=`

### OAuth Providers
- Google (Calendar, Tasks, Photos)
- Microsoft (Outlook Calendar)
- Spotify

### Kiosk Mode
- Unauthenticated display access
- Device-specific tokens
- Read-only dashboard rendering

---

## 6. External Integrations

| Service | Features |
|---------|----------|
| **Google** | Calendar, Tasks, Photos albums |
| **Microsoft** | Outlook Calendar |
| **Spotify** | Now playing, recently played |
| **Home Assistant** | Entity states, service calls |
| **ESPN** | Sports scores, schedules |
| **reMarkable** | Document sync, screenshots |
| **IPTV/XtremeCodes** | Live TV streams |
| **MediaMTX** | RTSP/WebRTC streaming |
| **RSS** | Feed aggregation |

---

## 7. Development Commands

```bash
# Development
pnpm dev              # Start all services (API, Web, Bot)
pnpm dev:api          # Start API only
pnpm dev:web          # Start frontend only

# Building
pnpm build            # Build all packages and apps
pnpm build:api        # Build API only
pnpm build:web        # Build frontend only

# Database
pnpm db:push          # Push schema changes to database
pnpm db:generate      # Generate migration files
pnpm db:migrate       # Run migrations
pnpm db:studio        # Open Drizzle Studio UI

# Testing & Linting
pnpm lint             # Run ESLint
pnpm typecheck        # Run TypeScript type checking
pnpm test             # Run tests
```

---

## 8. Current Focus / Roadmap

<!-- Update this section with current development priorities -->

- [ ] _Add current sprint goals here_
- [ ] _Add upcoming features here_

---

## 9. Known Issues / Tech Debt

<!-- Track issues that need addressing -->

- [ ] _Add known issues here_
- [ ] _Add tech debt items here_

---

## 10. Quick Reference

| Resource | URL |
|----------|-----|
| API Docs (Swagger) | http://localhost:6001/docs |
| Frontend | http://localhost:5176 |
| Drizzle Studio | http://localhost:4983 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

### Environment Variables
- API: `apps/api/.env`
- Web: `apps/web/.env`
- Shared: `.env` (root)

### Key Files
- Database schema: `packages/database/src/schema/`
- Shared types: `packages/shared/src/types/`
- API routes: `apps/api/src/routes/`
- React components: `apps/web/src/features/`

---

*Last updated: January 2026*
