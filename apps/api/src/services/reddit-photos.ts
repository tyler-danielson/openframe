/**
 * Reddit Photos Service
 * Fetches images from public subreddits via Reddit JSON API
 */

export interface RedditPhoto {
  id: string;
  url: string;
  title: string;
  author: string;
  width: number;
  height: number;
  subreddit: string;
  permalink: string;
}

interface RedditPostData {
  id: string;
  title: string;
  author: string;
  url: string;
  permalink: string;
  subreddit: string;
  post_hint?: string;
  is_video: boolean;
  over_18: boolean;
  preview?: {
    images: Array<{
      source: {
        url: string;
        width: number;
        height: number;
      };
      resolutions: Array<{
        url: string;
        width: number;
        height: number;
      }>;
    }>;
  };
}

interface RedditListingResponse {
  kind: string;
  data: {
    after: string | null;
    children: Array<{
      kind: string;
      data: RedditPostData;
    }>;
  };
}

// Simple in-memory cache
const cache = new Map<string, { data: RedditPhoto[]; timestamp: number }>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// Image hosting domains we can extract direct URLs from
const IMAGE_DOMAINS = [
  "i.redd.it",
  "i.imgur.com",
  "imgur.com",
  "preview.redd.it",
];

function isImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();
    return (
      pathname.endsWith(".jpg") ||
      pathname.endsWith(".jpeg") ||
      pathname.endsWith(".png") ||
      pathname.endsWith(".gif") ||
      pathname.endsWith(".webp") ||
      IMAGE_DOMAINS.some((domain) => parsed.hostname.includes(domain))
    );
  } catch {
    return false;
  }
}

function extractImageUrl(post: RedditPostData): string | null {
  // Direct image URL
  if (isImageUrl(post.url)) {
    // Convert imgur page URLs to direct image URLs
    if (post.url.includes("imgur.com") && !post.url.includes("i.imgur.com")) {
      const match = post.url.match(/imgur\.com\/(\w+)/);
      if (match && match[1]) {
        return `https://i.imgur.com/${match[1]}.jpg`;
      }
    }
    return post.url;
  }

  // Use preview image if available
  if (post.preview?.images?.[0]?.source) {
    // Reddit HTML-encodes the URL, need to decode it
    return post.preview.images[0].source.url.replace(/&amp;/g, "&");
  }

  return null;
}

function getImageDimensions(post: RedditPostData): { width: number; height: number } {
  if (post.preview?.images?.[0]?.source) {
    return {
      width: post.preview.images[0].source.width,
      height: post.preview.images[0].source.height,
    };
  }
  // Default dimensions if unknown
  return { width: 1920, height: 1080 };
}

export interface FetchOptions {
  limit?: number;
  orientation?: "all" | "landscape" | "portrait";
  sort?: "hot" | "new" | "top";
  time?: "hour" | "day" | "week" | "month" | "year" | "all";
}

export async function fetchSubredditPhotos(
  subreddit: string,
  options: FetchOptions = {}
): Promise<RedditPhoto[]> {
  const { limit = 50, orientation = "all", sort = "hot", time = "week" } = options;

  // Check cache
  const cacheKey = `${subreddit}-${sort}-${time}-${limit}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return filterByOrientation(cached.data, orientation);
  }

  // Build URL
  let url = `https://www.reddit.com/r/${subreddit}/${sort}.json?limit=${Math.min(limit * 2, 100)}`;
  if (sort === "top") {
    url += `&t=${time}`;
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "OpenFrame/1.0 (Photo Slideshow Widget)",
      },
    });

    if (!response.ok) {
      throw new Error(`Reddit API error: ${response.status}`);
    }

    const data = (await response.json()) as RedditListingResponse;

    const photos: RedditPhoto[] = [];

    for (const child of data.data.children) {
      const post = child.data;

      // Skip videos, NSFW, and non-image posts
      if (post.is_video || post.over_18) continue;

      const imageUrl = extractImageUrl(post);
      if (!imageUrl) continue;

      const dimensions = getImageDimensions(post);

      photos.push({
        id: post.id,
        url: imageUrl,
        title: post.title,
        author: post.author,
        width: dimensions.width,
        height: dimensions.height,
        subreddit: post.subreddit,
        permalink: `https://reddit.com${post.permalink}`,
      });

      // Stop once we have enough photos
      if (photos.length >= limit) break;
    }

    // Cache the unfiltered results
    cache.set(cacheKey, { data: photos, timestamp: Date.now() });

    return filterByOrientation(photos, orientation);
  } catch (error) {
    console.error(`Failed to fetch photos from r/${subreddit}:`, error);
    throw error;
  }
}

function filterByOrientation(
  photos: RedditPhoto[],
  orientation: "all" | "landscape" | "portrait"
): RedditPhoto[] {
  if (orientation === "all") return photos;

  return photos.filter((photo) => {
    const isLandscape = photo.width > photo.height;
    return orientation === "landscape" ? isLandscape : !isLandscape;
  });
}

// Clear expired cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      cache.delete(key);
    }
  }
}, 5 * 60 * 1000); // Every 5 minutes
