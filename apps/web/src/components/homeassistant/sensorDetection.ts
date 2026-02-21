import type { HomeAssistantEntityState } from "@openframe/shared";

/**
 * Detect if an entity is a laundry appliance (washer/dryer).
 * Matches sensor.* where entity_id or friendly_name contains laundry-related keywords.
 * Excludes numeric sub-sensors (e.g., washer_temperature) that have unit_of_measurement.
 */
export function isLaundryEntity(state: HomeAssistantEntityState): boolean {
  const domain = state.entity_id.split(".")[0];
  if (domain !== "sensor") return false;

  const entityId = state.entity_id.toLowerCase();
  const friendlyName = (typeof state.attributes.friendly_name === "string" ? state.attributes.friendly_name : "").toLowerCase();

  const keywords = ["washer", "dryer", "washing_machine", "tumble_dryer", "laundry"];
  const matchesKeyword = keywords.some(kw => entityId.includes(kw) || friendlyName.includes(kw));
  if (!matchesKeyword) return false;

  // Exclude numeric attribute sub-sensors (e.g., sensor.washer_temperature)
  const hasUnit = typeof state.attributes.unit_of_measurement === "string" && state.attributes.unit_of_measurement !== "";
  const isNumericState = !isNaN(parseFloat(state.state));
  if (hasUnit && isNumericState) return false;

  return true;
}

/**
 * Detect if an entity is a speedtest sensor.
 * Matches sensor.* with entity_id containing "speedtest" OR device_class "data_rate".
 */
export function isSpeedtestEntity(state: HomeAssistantEntityState): boolean {
  const domain = state.entity_id.split(".")[0];
  if (domain !== "sensor") return false;

  const entityId = state.entity_id.toLowerCase();
  const deviceClass = state.attributes.device_class as string | undefined;

  return entityId.includes("speedtest") || deviceClass === "data_rate";
}

/**
 * Detect if an entity is a motion sensor.
 * Matches binary_sensor.* with device_class "motion".
 */
export function isMotionSensorEntity(state: HomeAssistantEntityState): boolean {
  const domain = state.entity_id.split(".")[0];
  if (domain !== "binary_sensor") return false;

  const deviceClass = state.attributes.device_class as string | undefined;
  return deviceClass === "motion";
}

/**
 * Format an ISO timestamp as a relative time string.
 */
export function formatTimeAgo(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  if (diffMs < 0) return "Just now";

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "Just now";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;

  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d ago`;
}
