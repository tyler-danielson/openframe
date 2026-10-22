import { and, eq, isNull } from "drizzle-orm";
import { systemSettings } from "@openframe/database/schema";
import { decrypt, encrypt } from "./encryption.js";

/**
 * API keys the server's operator provides for everyone: the keys behind the
 * premium services, and the browser key the web app embeds Google Maps with.
 * Set in the admin panel (global system_settings rows in the "platform"
 * category), with the env var as the fallback.
 */
export interface PlatformKeyDefinition {
  key: string;
  label: string;
  description: string;
  envVar: string;
  placeholder: string;
  docsUrl: string;
}

export const PLATFORM_CATEGORY = "platform";

export const PLATFORM_KEY_DEFINITIONS: PlatformKeyDefinition[] = [
  {
    key: "openweathermap_api_key",
    label: "OpenWeatherMap (Premium Weather)",
    description:
      "Used for households with the premium weather service and no key of their own. Without it they fall back to Open-Meteo.",
    envVar: "OPENWEATHERMAP_PLATFORM_KEY",
    placeholder: "Your OpenWeatherMap API key",
    docsUrl: "https://home.openweathermap.org/api_keys",
  },
  {
    key: "google_maps_api_key",
    label: "Google Maps (Premium Traffic)",
    description:
      "Server key for Distance Matrix and Places, used for households with the premium traffic service and no key of their own.",
    envVar: "GOOGLE_MAPS_PLATFORM_KEY",
    placeholder: "AIzaSy...",
    docsUrl: "https://console.cloud.google.com/google/maps-apis/credentials",
  },
  {
    key: "google_maps_embed_key",
    label: "Google Maps Embed (Browser)",
    description:
      "Browser key for the directions map in event details. It is sent to browsers, so restrict it to the Maps Embed API and your domain.",
    envVar: "VITE_GOOGLE_MAPS_API_KEY",
    placeholder: "AIzaSy...",
    docsUrl: "https://console.cloud.google.com/google/maps-apis/credentials",
  },
];

export type PlatformKeySource = "admin" | "env" | null;

async function getStoredPlatformKey(db: any, key: string): Promise<string | null> {
  const [row] = await db
    .select()
    .from(systemSettings)
    .where(
      and(
        eq(systemSettings.category, PLATFORM_CATEGORY),
        eq(systemSettings.key, key),
        isNull(systemSettings.userId)
      )
    )
    .limit(1);

  if (!row?.value) return null;
  try {
    return decrypt(row.value);
  } catch {
    return null;
  }
}

/** The platform key and where it came from: the admin panel, else its env var. */
export async function resolvePlatformKey(
  db: any,
  key: string
): Promise<{ value: string | null; source: PlatformKeySource }> {
  const stored = await getStoredPlatformKey(db, key);
  if (stored) return { value: stored, source: "admin" };

  const def = PLATFORM_KEY_DEFINITIONS.find((d) => d.key === key);
  const fromEnv = def ? process.env[def.envVar] : undefined;
  if (fromEnv) return { value: fromEnv, source: "env" };

  return { value: null, source: null };
}

export async function getPlatformKey(db: any, key: string): Promise<string | null> {
  return (await resolvePlatformKey(db, key)).value;
}

/** Saves (or, with an empty value, clears) a platform key, encrypted. */
export async function setPlatformKey(db: any, key: string, value: string | null): Promise<void> {
  const where = and(
    eq(systemSettings.category, PLATFORM_CATEGORY),
    eq(systemSettings.key, key),
    isNull(systemSettings.userId)
  );

  if (!value) {
    await db.delete(systemSettings).where(where);
    return;
  }

  const [existing] = await db.select().from(systemSettings).where(where).limit(1);
  if (existing) {
    await db
      .update(systemSettings)
      .set({ value: encrypt(value), isSecret: true, updatedAt: new Date() })
      .where(eq(systemSettings.id, existing.id));
  } else {
    await db.insert(systemSettings).values({
      userId: null,
      category: PLATFORM_CATEGORY,
      key,
      value: encrypt(value),
      isSecret: true,
    });
  }
}
