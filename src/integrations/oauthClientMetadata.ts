import { promises as dns } from 'dns';
import { isIP } from 'net';
import type { OAuthClient, OAuthScope } from '../types';

// Clients identified by a Client ID Metadata Document: their client_id is an https URL, and
// what's at it (JSON) says what they are — their name and redirect URIs. Nothing is stored:
// the document is fetched (from the server, so never at a local or private address, nor
// following a redirect) and kept for a few minutes.

const CACHE_MS = 10 * 60 * 1000;
const MAX_BYTES = 64 * 1024;
const TIMEOUT_MS = 5000;

export class ClientMetadataError extends Error {}

/** Whether a client_id is a metadata document's URL (and not a registered client's id). */
export const isMetadataClientId = (clientId: string): boolean => clientId.startsWith('https://');

const ipv4Private = (ip: string) => {
  const [a, b, c] = ip.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 0 && c === 0) || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19)) || a >= 224;
};

/** Whether an address is a local, private, link-local, multicast or reserved one. */
export function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) return ipv4Private(ip);
  if (isIP(ip) !== 6) return true;
  const lower = ip.toLowerCase();
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipv4Private(mapped[1]);
  return lower === '::' || lower === '::1' || /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower) || lower.startsWith('ff') || lower.startsWith('::ffff:');
}

const checkUrl = (clientId: string): URL => {
  let url: URL;
  try { url = new URL(clientId); } catch { throw new ClientMetadataError('client_id is not a URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.pathname === '/' || url.toString() !== clientId) {
    throw new ClientMetadataError('client_id must be an https URL with a path, no credentials and no fragment');
  }
  return url;
};

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;
export type LookupLike = (host: string) => Promise<string[]>;

const defaultLookup: LookupLike = async host => (await dns.lookup(host, { all: true })).map(a => a.address);

export function createClientMetadataResolver(scopes: OAuthScope[], fetcher: FetchLike = fetch, lookup: LookupLike = defaultLookup) {
  const cache = new Map<string, { client: OAuthClient; until: number }>();

  return async function resolve(clientId: string): Promise<OAuthClient> {
    const cached = cache.get(clientId);
    if (cached && cached.until > Date.now()) return cached.client;

    const url = checkUrl(clientId);
    const host = url.hostname.replace(/^\[|\]$/g, '');
    const addresses = isIP(host) ? [host] : await lookup(host).catch(() => []);
    if (!addresses.length || addresses.some(isPrivateIp) || /^(localhost|.*\.local|.*\.internal)$/i.test(host)) {
      throw new ClientMetadataError("client_id's host is not reachable");
    }

    let text: string;
    try {
      const res = await fetcher(clientId, { redirect: 'error', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) throw new ClientMetadataError(`client_id's document answered ${res.status}`);
      text = await res.text();
    } catch (err) {
      throw err instanceof ClientMetadataError ? err : new ClientMetadataError("client_id's document couldn't be fetched");
    }
    if (text.length > MAX_BYTES) throw new ClientMetadataError("client_id's document is too large");

    let doc: Record<string, unknown>;
    try { doc = JSON.parse(text); } catch { throw new ClientMetadataError("client_id's document is not JSON"); }
    if (doc.client_id !== clientId) throw new ClientMetadataError("client_id's document names another client_id");
    const method = doc.token_endpoint_auth_method ?? 'none';
    if (method !== 'none') throw new ClientMetadataError('A metadata document client authenticates with none (PKCE only)');
    const redirectUris = Array.isArray(doc.redirect_uris) ? doc.redirect_uris.filter((u): u is string => typeof u === 'string') : [];
    if (!redirectUris.length) throw new ClientMetadataError("client_id's document has no redirect_uris");
    const name = typeof doc.client_name === 'string' && doc.client_name.trim() ? doc.client_name.trim().slice(0, 100) : url.host;

    const client: OAuthClient = {
      client_id: clientId,
      client_secret_hash: null,
      type: 'public',
      name,
      logo_uri: typeof doc.logo_uri === 'string' && doc.logo_uri.startsWith('https://') ? doc.logo_uri : null,
      client_uri: typeof doc.client_uri === 'string' && doc.client_uri.startsWith('https://') ? doc.client_uri : null,
      redirect_uris: redirectUris,
      scopes,
      registration: 'metadata',
    };
    cache.set(clientId, { client, until: Date.now() + CACHE_MS });
    return client;
  };
}
