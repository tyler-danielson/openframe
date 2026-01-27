# IPTV Streaming Feature Implementation Plan

## Overview
Add IPTV streaming support with Xtreme Codes API integration, including Live TV, EPG, favorites, and watch history.

## 1. Database Schema (packages/database/src/schema/index.ts)

Add 6 new tables:

```typescript
// IPTV Servers - stores Xtreme Codes credentials
export const iptvServers = pgTable("iptv_servers", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  serverUrl: text("server_url").notNull(),
  username: text("username").notNull(),
  password: text("password").notNull(),
  isActive: boolean("is_active").default(true),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// IPTV Categories
export const iptvCategories = pgTable("iptv_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  serverId: uuid("server_id").notNull().references(() => iptvServers.id, { onDelete: "cascade" }),
  externalId: text("external_id").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// IPTV Channels
export const iptvChannels = pgTable("iptv_channels", {
  id: uuid("id").primaryKey().defaultRandom(),
  serverId: uuid("server_id").notNull().references(() => iptvServers.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id").references(() => iptvCategories.id, { onDelete: "set null" }),
  externalId: text("external_id").notNull(),
  name: text("name").notNull(),
  streamUrl: text("stream_url").notNull(),
  logoUrl: text("logo_url"),
  epgChannelId: text("epg_channel_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// IPTV Favorites
export const iptvFavorites = pgTable("iptv_favorites", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  channelId: uuid("channel_id").notNull().references(() => iptvChannels.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// IPTV Watch History
export const iptvWatchHistory = pgTable("iptv_watch_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  channelId: uuid("channel_id").notNull().references(() => iptvChannels.id, { onDelete: "cascade" }),
  watchedAt: timestamp("watched_at").defaultNow().notNull(),
});

// IPTV EPG (Electronic Program Guide)
export const iptvEpg = pgTable("iptv_epg", {
  id: uuid("id").primaryKey().defaultRandom(),
  channelId: uuid("channel_id").notNull().references(() => iptvChannels.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

## 2. Shared Types (packages/shared/src/index.ts)

```typescript
export interface IptvServer {
  id: string;
  userId: string;
  name: string;
  serverUrl: string;
  username: string;
  isActive: boolean;
  lastSyncedAt: string | null;
  createdAt: string;
}

export interface IptvCategory {
  id: string;
  serverId: string;
  externalId: string;
  name: string;
}

export interface IptvChannel {
  id: string;
  serverId: string;
  categoryId: string | null;
  externalId: string;
  name: string;
  streamUrl: string;
  logoUrl: string | null;
  epgChannelId: string | null;
  isFavorite?: boolean;
}

export interface IptvEpgEntry {
  id: string;
  channelId: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
}
```

## 3. Xtreme Codes API Service (apps/api/src/services/xtreme-codes.ts)

```typescript
// XtremeCodesClient class with methods:
// - authenticate() - verify credentials
// - getLiveCategories() - fetch category list
// - getLiveStreams(categoryId?) - fetch channel list
// - getEpg(streamId) - fetch EPG for channel
// - buildStreamUrl(streamId) - construct HLS stream URL
```

## 4. API Routes (apps/api/src/routes/iptv/index.ts)

- `GET /iptv/servers` - List user's IPTV servers
- `POST /iptv/servers` - Add new server
- `DELETE /iptv/servers/:id` - Remove server
- `POST /iptv/servers/:id/sync` - Sync channels from server
- `GET /iptv/categories` - List categories (with optional serverId filter)
- `GET /iptv/channels` - List channels (with category/search filters)
- `GET /iptv/channels/:id/stream` - Get stream URL for channel
- `GET /iptv/channels/:id/epg` - Get EPG for channel
- `GET /iptv/favorites` - List favorite channels
- `POST /iptv/favorites/:channelId` - Add to favorites
- `DELETE /iptv/favorites/:channelId` - Remove from favorites
- `GET /iptv/history` - Get watch history
- `POST /iptv/history/:channelId` - Record watch event

## 5. Frontend Components

### IptvPage (apps/web/src/pages/IptvPage.tsx)
Main page with:
- Category sidebar
- Channel grid
- Video player (expandable/fullscreen)
- EPG bar showing current/next programs

### Components (apps/web/src/components/iptv/)
- `VideoPlayer.tsx` - HLS.js video player with controls
- `ChannelGrid.tsx` - Grid of channel cards with logos
- `CategorySidebar.tsx` - Category list with All/Favorites/History
- `EpgBar.tsx` - Current and upcoming program info
- `AddServerModal.tsx` - Modal for adding Xtreme Codes servers

### Zustand Store (apps/web/src/stores/iptv.ts)
```typescript
// State: currentChannel, servers, categories, favorites
// Actions: setCurrentChannel, toggleFavorite, addServer, etc.
```

## 6. Navigation Update (apps/web/src/components/ui/Layout.tsx)

Add "Live TV" with Tv icon to sidebar navigation.

## 7. Dependencies

- `hls.js` - HLS video streaming support (apps/web)

## Implementation Order

1. Database schema + migration
2. Shared types
3. Xtreme Codes API service
4. API routes
5. Install hls.js dependency
6. Zustand store
7. Frontend components
8. Navigation update
9. Testing
