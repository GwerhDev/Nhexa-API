import { allowedOrigins } from '../config';

// Where a login (or a signup) may send the user back to once it's done: only Nhexa's own
// sites (https://nhexa.cl and its subdomains) and the origins registered in ALLOWED_ORIGINS.
// Anything else -- another site, a relative path, a javascript: URL -- is never followed:
// it would hand the user, signed in, to whoever wrote the link.

const NHEXA_DOMAIN = 'nhexa.cl';

/** The origins in a list like ALLOWED_ORIGINS ("['https://a', 'https://b']" or "https://a,https://b"). */
export const parseOrigins = (raw: string | undefined): string[] =>
  (raw ?? '')
    .replace(/[[\]'"\s]/g, '')
    .split(',')
    .flatMap((entry) => {
      try {
        return entry ? [new URL(entry).origin] : [];
      } catch {
        return [];
      }
    });

/** Whether a login may send the user to `target`: a full URL on Nhexa's sites (https) or a
 * registered origin. */
export const isAllowedRedirect = (target: unknown, registered: string[]): target is string => {
  if (typeof target !== 'string' || !target) return false;
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return false;
  }
  if (url.username || url.password) return false;
  if (registered.includes(url.origin)) return true;
  const host = url.hostname.toLowerCase();
  return url.protocol === 'https:' && (host === NHEXA_DOMAIN || host.endsWith(`.${NHEXA_DOMAIN}`));
};

/** The origins registered in ALLOWED_ORIGINS: the only ones allowed cross-origin requests
 * with the user's session (CORS), and the only ones besides Nhexa's sites a login may send
 * the user back to. */
export const registeredOrigins = parseOrigins(allowedOrigins);

/** Whether `origin` (a request's Origin header) is one of `registered`, exactly. */
export const isRegisteredOrigin = (origin: unknown, registered: string[]): origin is string =>
  typeof origin === 'string' && registered.includes(origin);

/** `target` if a login may send the user there, else `fallback`. */
export const safeRedirect = (target: unknown, fallback: string): string =>
  isAllowedRedirect(target, registeredOrigins) ? target : fallback;

/** `target` if a login may send the user there, else nothing. */
export const allowedRedirect = (target: unknown): string | undefined =>
  isAllowedRedirect(target, registeredOrigins) ? target : undefined;
