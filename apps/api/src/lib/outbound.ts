/**
 * Requests to addresses people type in: calendar feeds, Home Assistant, media
 * and storage servers, news feeds. On the hosted service these may only reach
 * the public internet, never the server's own network (the other containers,
 * the database, cloud metadata), whose responses a user could otherwise read
 * back through the feature.
 *
 * Self-hosted servers are left alone: reaching a Home Assistant or a NAS on
 * the home network is what they're for.
 */
import dns from "node:dns";
import net from "node:net";
import { Agent, buildConnector } from "undici";

export class BlockedDestinationError extends Error {
  constructor(destination: string) {
    super(`Connections to ${destination} are not allowed`);
    this.name = "BlockedDestinationError";
  }
}

/** Only the hosted service restricts where these requests may go. */
export function restrictsOutboundRequests(): boolean {
  return process.env.HOSTED_MODE === "true";
}

const privateRanges = new net.BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], // "this" network
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, cloud metadata
  ["172.16.0.0", 12], // private (Docker networks)
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // documentation
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // documentation
  ["203.0.113.0", 24], // documentation
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, broadcast
] as const) {
  privateRanges.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 96], // unspecified, loopback, IPv4-compatible
  ["64:ff9b::", 96], // NAT64
  ["100::", 64], // discard
  ["2001:db8::", 32], // documentation
  ["2002::", 16], // 6to4
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["ff00::", 8], // multicast
] as const) {
  privateRanges.addSubnet(network, prefix, "ipv6");
}

/** Whether an IP address is on a private, local or otherwise non-public network. */
export function isPrivateAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) return privateRanges.check(address, "ipv4");
  // BlockList also matches IPv4-mapped IPv6 addresses against the IPv4 ranges
  if (family === 6) return privateRanges.check(address, "ipv6");
  return true;
}

function publicOnlyLookup(
  hostname: string,
  options: dns.LookupOptions,
  callback: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void
): void {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "");
    // Refuse the host if any of its addresses is private, so a name can't mix
    // a public address with an internal one
    if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
      return callback(new BlockedDestinationError(hostname), "");
    }
    if (options.all) return callback(null, addresses);
    return callback(null, addresses[0]!.address, addresses[0]!.family);
  });
}

const connectPublic = buildConnector({ lookup: publicOnlyLookup } as buildConnector.BuildOptions);

/**
 * Checks every connection as it is made: after DNS resolves, and again for
 * each redirect, so neither a redirect nor a DNS answer that changes between
 * requests can lead somewhere internal.
 */
const publicOnlyDispatcher = new Agent({
  connect(options, callback) {
    const host = options.hostname.replace(/^\[(.*)\]$/, "$1");
    if (net.isIP(host) && isPrivateAddress(host)) {
      callback(new BlockedDestinationError(host), null);
      return;
    }
    connectPublic(options, callback);
  },
});

/**
 * fetch() for a URL a user supplied. Only http(s); on the hosted service, only
 * public addresses. Fails with a BlockedDestinationError (wrapped by fetch in
 * a TypeError's `cause`) otherwise.
 */
export async function fetchPublic(input: string | URL, init: RequestInit = {}): Promise<Response> {
  const url = new URL(input);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BlockedDestinationError(`${url.protocol}//`);
  }
  if (!restrictsOutboundRequests()) return fetch(url, init);
  return fetch(url, { ...init, dispatcher: publicOnlyDispatcher } as RequestInit);
}

/**
 * For clients that open their own connections (FTP, SFTP, WebDAV, SMB): on
 * the hosted service, refuses hosts that resolve to a non-public address.
 * Unlike fetchPublic this checks once, before connecting.
 */
export async function assertPublicHost(hostname: string): Promise<void> {
  if (!restrictsOutboundRequests()) return;
  const host = hostname.replace(/^\[(.*)\]$/, "$1");
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) throw new BlockedDestinationError(host);
    return;
  }
  const addresses = await dns.promises.lookup(host, { all: true });
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new BlockedDestinationError(hostname);
  }
}

/** assertPublicHost for a URL, which must be http(s). */
export async function assertPublicUrl(input: string | URL): Promise<URL> {
  const url = new URL(input);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BlockedDestinationError(`${url.protocol}//`);
  }
  await assertPublicHost(url.hostname);
  return url;
}

/** Whether an error (or a fetch TypeError's cause) is a refused destination. */
export function isBlockedDestination(err: unknown): boolean {
  return (
    err instanceof BlockedDestinationError ||
    (err instanceof Error && err.cause instanceof BlockedDestinationError)
  );
}
