import { eq } from "drizzle-orm";
import { householdMembers } from "@openframe/database/schema";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Get the household ID for a user. Returns the first household the user belongs to.
 * Returns null if the user has no household.
 */
export async function getUserHouseholdId(
  db: PostgresJsDatabase<any>,
  userId: string
): Promise<string | null> {
  const [membership] = await db
    .select({ householdId: householdMembers.householdId })
    .from(householdMembers)
    .where(eq(householdMembers.userId, userId))
    .limit(1);

  return membership?.householdId ?? null;
}

/**
 * Get the household ID for a user, throwing if not found.
 */
export async function requireUserHouseholdId(
  db: PostgresJsDatabase<any>,
  userId: string
): Promise<string> {
  const householdId = await getUserHouseholdId(db, userId);
  if (!householdId) {
    throw new Error("User has no household. Please create one first.");
  }
  return householdId;
}
