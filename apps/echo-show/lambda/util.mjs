/**
 * Persistence helpers for Alexa-hosted S3 storage.
 * Config is keyed by Alexa userId and stored as JSON.
 */

/**
 * Get the kiosk config from persistent attributes
 * @param {object} attributesManager - ASK SDK attributes manager
 * @returns {Promise<{serverUrl?: string, kioskToken?: string}>}
 */
export async function getConfig(attributesManager) {
  const attrs = await attributesManager.getPersistentAttributes();
  return {
    serverUrl: attrs.serverUrl || null,
    kioskToken: attrs.kioskToken || null,
  };
}

/**
 * Save kiosk config to persistent attributes
 * @param {object} attributesManager - ASK SDK attributes manager
 * @param {string} serverUrl
 * @param {string} kioskToken
 */
export async function saveConfig(attributesManager, serverUrl, kioskToken) {
  const attrs = await attributesManager.getPersistentAttributes();
  attrs.serverUrl = serverUrl;
  attrs.kioskToken = kioskToken;
  attributesManager.setPersistentAttributes(attrs);
  await attributesManager.savePersistentAttributes();
}

/**
 * Clear kiosk config from persistent attributes
 * @param {object} attributesManager - ASK SDK attributes manager
 */
export async function clearConfig(attributesManager) {
  attributesManager.setPersistentAttributes({});
  await attributesManager.savePersistentAttributes();
}

/**
 * Build the web app URL for the Start directive.
 * Alexa-hosted skills have a media bucket accessible at a known S3 URL.
 * The actual URL is injected via environment or constructed from the skill ID.
 */
export function getWebAppUrl() {
  // Alexa-hosted skills set this env var pointing to the S3 media bucket
  const mediaBucket = process.env.S3_PERSISTENCE_BUCKET;
  const region = process.env.AWS_REGION || "us-east-1";

  if (mediaBucket) {
    return `https://${mediaBucket}.s3.${region}.amazonaws.com/Media/index.html`;
  }

  // Fallback: use a custom URL if configured
  return process.env.WEB_APP_URL || "https://localhost:5181";
}
