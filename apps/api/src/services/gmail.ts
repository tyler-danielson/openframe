import { google } from "googleapis";
import type { EmailHighlight } from "@openframe/shared";

export interface GmailServiceOptions {
  accessToken: string;
  refreshToken?: string;
}

/**
 * Fetches email highlights (recent important/unread emails) from Gmail.
 */
export async function getGmailHighlights(
  options: GmailServiceOptions,
  maxResults: number = 10
): Promise<EmailHighlight[]> {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token: options.accessToken,
    refresh_token: options.refreshToken,
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  // Fetch recent messages from inbox (unread first, then recent)
  const response = await gmail.users.messages.list({
    userId: "me",
    maxResults,
    q: "in:inbox -category:promotions -category:social",
    labelIds: ["INBOX"],
  });

  const messages = response.data.messages || [];
  const highlights: EmailHighlight[] = [];

  for (const message of messages) {
    if (!message.id) continue;

    const fullMessage = await gmail.users.messages.get({
      userId: "me",
      id: message.id,
      format: "metadata",
      metadataHeaders: ["From", "Subject", "Date"],
    });

    const headers = fullMessage.data.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";

    const fromHeader = getHeader("From");
    const subject = getHeader("Subject");
    const dateHeader = getHeader("Date");

    // Parse from header to get name/email
    const fromMatch = fromHeader.match(/^(.+?)\s*<(.+?)>$/);
    const from = fromMatch && fromMatch[1] ? fromMatch[1].replace(/"/g, "") : fromHeader;

    // Check if message is unread
    const labelIds = fullMessage.data.labelIds || [];
    const isUnread = labelIds.includes("UNREAD");

    highlights.push({
      id: message.id,
      from,
      subject: subject || "(no subject)",
      snippet: fullMessage.data.snippet || "",
      receivedAt: dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString(),
      isUnread,
    });
  }

  return highlights;
}

/**
 * Checks if Gmail access is available for the user.
 */
export async function checkGmailAccess(options: GmailServiceOptions): Promise<{
  hasAccess: boolean;
  error?: string;
}> {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      access_token: options.accessToken,
      refresh_token: options.refreshToken,
    });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // Try to get the user's profile to verify access
    await gmail.users.getProfile({ userId: "me" });

    return { hasAccess: true };
  } catch (error: any) {
    // Check for specific permission errors
    if (error.code === 403 || error.message?.includes("insufficient")) {
      return {
        hasAccess: false,
        error: "Gmail permission not granted. Please re-authenticate with Google to grant Gmail access.",
      };
    }
    return {
      hasAccess: false,
      error: error.message || "Failed to access Gmail",
    };
  }
}
