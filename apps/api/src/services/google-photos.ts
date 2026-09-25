import type { Database } from "@openframe/database";
import type { OAuthToken } from "@openframe/database/schema";
import { getValidAccessToken } from "./calendar-sync/oauth.js";

const PICKER_API = "https://photospicker.googleapis.com/v1";
const LIBRARY_API = "https://photoslibrary.googleapis.com/v1";

export interface PickerSession {
  id: string;
  pickerUri: string;
  pollingConfig: {
    pollInterval: string;
    timeoutIn: string;
  };
  mediaItemsSet?: boolean;
}

export interface PickedMediaItem {
  id: string;
  type?: string;
  createTime?: string;
  mediaFile: {
    baseUrl: string;
    mimeType: string;
    filename: string;
    filesize: string;
  };
}

interface ListMediaItemsResponse {
  mediaItems?: PickedMediaItem[];
  nextPageToken?: string;
}

/**
 * A usable access token for `token`, refreshed (and saved) through the shared
 * OAuth helper when it's about to expire. The OAuth client credentials are read
 * from settings when refreshing, so rotating them in Settings needs no restart.
 */
export async function getAccessToken(db: Database, token: OAuthToken): Promise<string> {
  return getValidAccessToken(db, token, "google");
}

/**
 * Create a new Picker session.
 * Returns a session with a pickerUri that the user should be directed to.
 */
export async function createPickerSession(
  db: Database,
  token: OAuthToken
): Promise<PickerSession> {
  const accessToken = await getAccessToken(db, token);

  const response = await fetch(`${PICKER_API}/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[createPickerSession] Failed to create picker session:", error);
    throw new Error("Failed to create Google Photos picker session");
  }

  const data = await response.json() as PickerSession;
  console.log(`[createPickerSession] Created session: ${data.id}, pickerUri: ${data.pickerUri}`);
  return data;
}

/**
 * Get the current state of a Picker session.
 * Poll this until mediaItemsSet is true.
 */
export async function getPickerSession(
  db: Database,
  token: OAuthToken,
  sessionId: string
): Promise<PickerSession> {
  const accessToken = await getAccessToken(db, token);

  const response = await fetch(`${PICKER_API}/sessions/${sessionId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[getPickerSession] Failed to get picker session:", error);
    throw new Error("Failed to get Google Photos picker session");
  }

  const data = await response.json() as PickerSession;
  console.log(`[getPickerSession] Session ${sessionId}: mediaItemsSet=${data.mediaItemsSet}`);
  return data;
}

/**
 * List the media items that were selected in a completed Picker session.
 */
export async function listPickedMediaItems(
  db: Database,
  token: OAuthToken,
  sessionId: string
): Promise<PickedMediaItem[]> {
  const accessToken = await getAccessToken(db, token);
  const items: PickedMediaItem[] = [];
  let nextPageToken: string | undefined;

  console.log(`[listPickedMediaItems] Starting fetch for session: ${sessionId}`);

  do {
    const url = new URL(`${PICKER_API}/mediaItems`);
    url.searchParams.set("sessionId", sessionId);
    url.searchParams.set("pageSize", "100");
    if (nextPageToken) {
      url.searchParams.set("pageToken", nextPageToken);
    }

    console.log(`[listPickedMediaItems] Fetching: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[listPickedMediaItems] Failed to list picked media items:", error);
      throw new Error("Failed to list picked media items");
    }

    const rawData = await response.text();
    console.log(`[listPickedMediaItems] Raw response: ${rawData.substring(0, 500)}...`);

    const data = JSON.parse(rawData) as ListMediaItemsResponse;
    console.log(`[listPickedMediaItems] Parsed response - mediaItems count: ${data.mediaItems?.length ?? 0}, hasNextPageToken: ${!!data.nextPageToken}`);

    if (data.mediaItems) {
      items.push(...data.mediaItems);
    }
    nextPageToken = data.nextPageToken;
  } while (nextPageToken);

  console.log(`[listPickedMediaItems] Total items fetched: ${items.length}`);
  return items;
}

/**
 * Delete a Picker session (cleanup).
 */
export async function deletePickerSession(
  db: Database,
  token: OAuthToken,
  sessionId: string
): Promise<void> {
  const accessToken = await getAccessToken(db, token);

  await fetch(`${PICKER_API}/sessions/${sessionId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

/**
 * Get the photo URL with size parameters.
 * baseUrl is valid for 60 minutes.
 */
export function getPhotoUrl(
  baseUrl: string,
  width?: number,
  height?: number
): string {
  if (width && height) {
    return `${baseUrl}=w${width}-h${height}`;
  } else if (width) {
    return `${baseUrl}=w${width}`;
  } else if (height) {
    return `${baseUrl}=h${height}`;
  }
  return `${baseUrl}=w1920-h1080`;
}

// ============ Library API (for browsing albums) ============

export interface GoogleAlbum {
  id: string;
  title: string;
  productUrl: string;
  mediaItemsCount?: string;
  coverPhotoBaseUrl?: string;
  coverPhotoMediaItemId?: string;
}

export interface GoogleMediaItem {
  id: string;
  productUrl: string;
  baseUrl: string;
  mimeType: string;
  filename: string;
  mediaMetadata?: {
    creationTime?: string;
    width?: string;
    height?: string;
    photo?: object;
    video?: object;
  };
}

interface ListAlbumsResponse {
  albums?: GoogleAlbum[];
  nextPageToken?: string;
}

interface SearchMediaItemsResponse {
  mediaItems?: GoogleMediaItem[];
  nextPageToken?: string;
}

/**
 * List all albums from Google Photos
 */
export async function listAlbums(db: Database, token: OAuthToken): Promise<GoogleAlbum[]> {
  const accessToken = await getAccessToken(db, token);
  const albums: GoogleAlbum[] = [];
  let nextPageToken: string | undefined;

  do {
    const url = new URL(`${LIBRARY_API}/albums`);
    url.searchParams.set("pageSize", "50");
    if (nextPageToken) {
      url.searchParams.set("pageToken", nextPageToken);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Failed to list albums:", error);
      throw new Error("Failed to list Google Photos albums");
    }

    const data = (await response.json()) as ListAlbumsResponse;
    if (data.albums) {
      albums.push(...data.albums);
    }
    nextPageToken = data.nextPageToken;
  } while (nextPageToken);

  return albums;
}

/**
 * List photos in a specific album
 */
export async function listAlbumPhotos(
  db: Database,
  token: OAuthToken,
  albumId: string,
  pageToken?: string
): Promise<{ photos: GoogleMediaItem[]; nextPageToken?: string }> {
  const accessToken = await getAccessToken(db, token);

  const response = await fetch(`${LIBRARY_API}/mediaItems:search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      albumId,
      pageSize: 100,
      pageToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Failed to list album photos:", error);
    throw new Error("Failed to list album photos");
  }

  const data = (await response.json()) as SearchMediaItemsResponse;
  return {
    photos: data.mediaItems ?? [],
    nextPageToken: data.nextPageToken,
  };
}
