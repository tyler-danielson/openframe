import type { FastifyRequest } from "fastify";

export function isPrivateIp(hostname: string): boolean {
  return /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(hostname);
}

export function getRequestOrigin(request: FastifyRequest): string {
  const forwardedHost = request.headers["x-forwarded-host"];
  const host =
    (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost) ||
    request.headers.host ||
    "localhost:3000";
  const forwardedProto = request.headers["x-forwarded-proto"];
  const rawProto = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  const hostname: string = host.split(":")[0]!;
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1" || isPrivateIp(hostname);
  // Non-local hosts always use https (reverse proxies often misreport proto)
  const protocol = isLocal ? (rawProto || "http") : "https";
  return `${protocol}://${host}`.replace(/\/+$/, "");
}
