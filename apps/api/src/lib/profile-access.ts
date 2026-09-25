import { eq, inArray } from "drizzle-orm";
import { familyProfiles, householdMembers } from "@openframe/database/schema";
import type { Database } from "@openframe/database";
import { getUserHouseholdId } from "./household.js";

/**
 * The users whose family profiles `userId` may act on in household-shared
 * features (the leaderboard, chores): the members of `householdId`, or of the
 * user's household when it isn't given, and always the user.
 */
export async function getHouseholdUserIds(
  db: Database,
  userId: string,
  householdId?: string | null
): Promise<string[]> {
  const id = householdId === undefined ? await getUserHouseholdId(db, userId) : householdId;
  if (!id) return [userId];

  const members = await db
    .select({ userId: householdMembers.userId })
    .from(householdMembers)
    .where(eq(householdMembers.householdId, id));

  return [...new Set([userId, ...members.map((m) => m.userId)])];
}

/**
 * Whether every id in `profileIds` is a family profile owned by one of
 * `ownerIds`. Profile ids arrive in request bodies and query strings, so check
 * them before writing rows that reference them.
 */
export async function profilesOwnedBy(
  db: Database,
  profileIds: readonly string[],
  ownerIds: readonly string[]
): Promise<boolean> {
  if (profileIds.length === 0) return true;
  if (ownerIds.length === 0) return false;

  const owned = await db
    .select({ id: familyProfiles.id })
    .from(familyProfiles)
    .where(inArray(familyProfiles.userId, [...ownerIds]));

  const ownedIds = new Set(owned.map((p) => p.id));
  return profileIds.every((id) => ownedIds.has(id));
}
