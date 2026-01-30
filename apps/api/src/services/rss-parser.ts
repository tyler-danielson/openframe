/**
 * RSS Parser Service
 * Parses RSS and Atom feeds to extract articles
 */

import Parser from "rss-parser";

export interface ParsedArticle {
  guid: string;
  title: string;
  description: string | null;
  link: string;
  imageUrl: string | null;
  author: string | null;
  publishedAt: Date | null;
}

export interface ParsedFeed {
  title: string;
  description: string | null;
  articles: ParsedArticle[];
}

// Custom fields for media content
type CustomItem = {
  "media:content"?: { $?: { url?: string } };
  "media:thumbnail"?: { $?: { url?: string } };
  enclosure?: { url?: string };
  "content:encoded"?: string;
  id?: string;
  author?: string;
};

const parser = new Parser<Record<string, unknown>, CustomItem>({
  customFields: {
    item: [
      ["media:content", "media:content"],
      ["media:thumbnail", "media:thumbnail"],
      ["enclosure", "enclosure"],
      ["content:encoded", "content:encoded"],
    ],
  },
  timeout: 10000,
});

/**
 * Extract image URL from various RSS feed formats
 */
function extractImageUrl(item: Parser.Item & CustomItem): string | null {
  // Check media:content
  if (item["media:content"]?.$?.url) {
    return item["media:content"].$.url;
  }

  // Check media:thumbnail
  if (item["media:thumbnail"]?.$?.url) {
    return item["media:thumbnail"].$.url;
  }

  // Check enclosure (common for podcasts but sometimes used for images)
  if (item.enclosure?.url && item.enclosure.url.match(/\.(jpg|jpeg|png|gif|webp)/i)) {
    return item.enclosure.url;
  }

  // Try to extract from content/description using regex
  const content = item.content || item.contentSnippet || item["content:encoded"] || "";
  const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch?.[1]) {
    return imgMatch[1];
  }

  return null;
}

/**
 * Clean HTML from text content
 */
function cleanHtml(html: string | undefined): string | null {
  if (!html) return null;

  // Remove HTML tags and decode entities
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 500); // Limit description length
}

/**
 * Parse an RSS or Atom feed URL
 */
export async function parseRssFeed(feedUrl: string): Promise<ParsedFeed> {
  const feed = await parser.parseURL(feedUrl);

  const articles: ParsedArticle[] = (feed.items || []).map((item) => {
    const typedItem = item as Parser.Item & CustomItem;

    // Generate a GUID if not present
    const guid = item.guid || typedItem.id || item.link || `${item.title}-${item.pubDate}`;

    // Parse publication date
    let publishedAt: Date | null = null;
    if (item.pubDate) {
      const parsed = new Date(item.pubDate);
      if (!isNaN(parsed.getTime())) {
        publishedAt = parsed;
      }
    } else if (item.isoDate) {
      const parsed = new Date(item.isoDate);
      if (!isNaN(parsed.getTime())) {
        publishedAt = parsed;
      }
    }

    return {
      guid,
      title: item.title || "Untitled",
      description: cleanHtml(item.contentSnippet || item.content || item.summary),
      link: item.link || "",
      imageUrl: extractImageUrl(typedItem),
      author: item.creator || typedItem.author || null,
      publishedAt,
    };
  });

  return {
    title: feed.title || "Unknown Feed",
    description: feed.description || null,
    articles,
  };
}

/**
 * Validate that a URL is a valid RSS/Atom feed
 */
export async function validateFeedUrl(feedUrl: string): Promise<{
  valid: boolean;
  title?: string;
  error?: string;
}> {
  try {
    const feed = await parser.parseURL(feedUrl);
    return {
      valid: true,
      title: feed.title,
    };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Failed to parse feed",
    };
  }
}
