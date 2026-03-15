import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY not set");
  return Buffer.from(key, "hex");
}

export function encrypt(text: string): string {
  const keyBuffer = getKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  const keyBuffer = getKey();

  const [ivHex, authTagHex, encrypted] = encryptedText.split(":");
  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error("Invalid encrypted format");
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Check if a string looks like our encrypted format (hex:hex:hex).
 */
export function isEncrypted(text: string): boolean {
  const parts = text.split(":");
  if (parts.length !== 3) return false;
  return parts.every((p) => /^[0-9a-f]+$/i.test(p));
}

/**
 * Null-safe encrypt. Returns null if input is null/undefined.
 */
export function encryptField(value: string | null | undefined): string | null {
  if (value == null) return null;
  return encrypt(value);
}

/**
 * Null-safe decrypt that gracefully handles both encrypted and plaintext values.
 * Returns plaintext as-is if not encrypted (for migration compatibility).
 */
export function decryptField(value: string | null | undefined): string | null {
  if (value == null) return null;
  if (!isEncrypted(value)) return value;
  try {
    return decrypt(value);
  } catch {
    // If decryption fails, return as-is (likely plaintext that matched the pattern)
    return value;
  }
}

/**
 * Decrypt accessToken and refreshToken on an OAuth token row.
 */
export function decryptOAuthToken<T extends { accessToken: string; refreshToken: string | null }>(
  row: T
): T {
  return {
    ...row,
    accessToken: decryptField(row.accessToken) ?? row.accessToken,
    refreshToken: row.refreshToken ? (decryptField(row.refreshToken) ?? row.refreshToken) : null,
  };
}

/**
 * Decrypt multiple OAuth token rows.
 */
export function decryptOAuthTokens<T extends { accessToken: string; refreshToken: string | null }>(
  rows: T[]
): T[] {
  return rows.map(decryptOAuthToken);
}

/**
 * Encrypt sensitive event fields (title, description, location) before storing.
 */
export function encryptEventFields<T>(data: T): T {
  const result = { ...data } as any;
  if (typeof result.title === "string") {
    result.title = encryptField(result.title);
  }
  if (typeof result.description === "string") {
    result.description = encryptField(result.description);
  }
  if (typeof result.location === "string") {
    result.location = encryptField(result.location);
  }
  return result as T;
}

/**
 * Decrypt sensitive event fields after reading from DB.
 */
export function decryptEventFields<T>(event: T): T {
  const result = { ...event } as any;
  if (typeof result.title === "string") {
    result.title = decryptField(result.title);
  }
  if (typeof result.description === "string") {
    result.description = decryptField(result.description);
  }
  if (typeof result.location === "string") {
    result.location = decryptField(result.location);
  }
  return result as T;
}
