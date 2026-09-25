import type { FastifyInstance } from "fastify";

/**
 * Emails of the people who run a hosted (HOSTED_MODE) server, from the
 * comma-separated PLATFORM_ADMIN_EMAILS.
 */
function platformAdminEmails(): Set<string> {
  return new Set(
    (process.env.PLATFORM_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * Whether this user may administer the whole server: settings that apply to
 * everyone, every account, the server's logs.
 *
 * On a self-hosted server that is its admins. On the hosted service every
 * account is its owner's "admin", so there the role grants nothing
 * server-wide: only the platform operators listed in PLATFORM_ADMIN_EMAILS.
 */
export function isServerAdmin(
  fastify: Pick<FastifyInstance, "hostedMode">,
  user: { role: string; email: string } | null | undefined
): boolean {
  if (!user || user.role !== "admin") return false;
  if (!fastify.hostedMode) return true;
  return platformAdminEmails().has(user.email.trim().toLowerCase());
}
