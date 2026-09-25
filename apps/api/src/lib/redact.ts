/**
 * Request URLs with their credentials blanked, for logs. Media URLs carry a
 * session token or API key in the query string, OAuth callbacks a one-time
 * code, and kiosk, invite and upload links their token in the path; any of
 * those in a log would let whoever reads it act as that account.
 */

const SECRET_QUERY_PARAM = /token|key|secret|password|code|state|signature|auth/i;

// Path segments that are themselves credentials: /public/<kiosk token>,
// /invite/<token>, /upload/<token>, /check/<kiosk token>, ...
const SECRET_PATH_SEGMENT =
  /\/(public|invite|token|upload|upload-public|upload-token|check)\/([^/?#]+)/g;

export function redactUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  const queryStart = url.indexOf("?");
  const path = queryStart === -1 ? url : url.slice(0, queryStart);
  const redactedPath = path.replace(SECRET_PATH_SEGMENT, "/$1/[redacted]");
  if (queryStart === -1) return redactedPath;

  const params = url
    .slice(queryStart + 1)
    .split("&")
    .map((pair) => {
      const separator = pair.indexOf("=");
      if (separator === -1) return pair;
      let name = pair.slice(0, separator);
      try {
        name = decodeURIComponent(name);
      } catch {
        // keep the raw name
      }
      return SECRET_QUERY_PARAM.test(name) ? `${pair.slice(0, separator)}=[redacted]` : pair;
    });
  return `${redactedPath}?${params.join("&")}`;
}
