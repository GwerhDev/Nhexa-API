import { promises as dns } from 'dns';
import { isIP } from 'net';
import type { OAuthClient, OAuthScope } from '../types';

// Clients identified by a Client ID Metadata Document: their client_id is an https URL, and
// what's at it (JSON) says what they are — their name and redirect URIs. Nothing is stored:
// the document is fetched (from the server, so never at a local or private address, nor
// following a redirect) and kept for a few minutes. Only documents that made a client are
// kept, and only so many: a failure is tried again next time, and a flood of client_ids can't
// fill the memory.

const CACHE_MS = 10 * 60 * 1000;
const MAX_CACHED = 500;
const MAX_BYTES = 64 * 1024;
const TIMEOUT_MS = 5000;
// Who's asking, as a document's host sees it: some (Cloudflare's) turn a datacenter's request
// without one down at once.
export const USER_AGENT = 'Nhexa-OAuth/1.0 (+https://nhexa.cl)';

/**
 * Why a client's metadata document didn't make a client: `temporary` when it couldn't be fetched
 * (the network, a timeout, its host answering 403, 408, 429 or 5xx) — try again later — and not
 * when what it is turns it down. `detail` is the cause, for the log (an error code, a status).
 */
export class ClientMetadataError extends Error {
  constructor(message: string, public temporary = false, public detail?: string) {
    super(message);
  }
}

// What a failed fetch or lookup says of why: its cause's code (ECONNRESET, ENOTFOUND...), or its
// name (TimeoutError). Codes as text only: a DOMException's is a number (a timeout's is 23).
const causeOf = (err: unknown): string | undefined => {
  const e = err as { code?: unknown; name?: unknown; cause?: { code?: unknown; name?: unknown; message?: unknown } } | null;
  return [e?.cause?.code, e?.code, e?.cause?.name, e?.name, e?.cause?.message]
    .find((v): v is string => typeof v === 'string' && !!v && v !== 'Error' && v !== 'TypeError');
};
// The statuses that say "not now", not "not this": the host refusing for now, overloaded, down.
const temporaryStatus = (status: number) => status === 403 || status === 408 || status === 429 || status >= 500;

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

// The body, read as it arrives and given up on as soon as it passes `max` bytes: a huge (or
// endless) document is never held whole.
async function readLimited(res: Response, max: number): Promise<string> {
  if (Number(res.headers.get('content-length')) > max) throw new ClientMetadataError("client_id's document is too large");
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => undefined);
      throw new ClientMetadataError("client_id's document is too large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

// Copies of the documents of clients whose host turns a datacenter's request down (claude.ai's
// Cloudflare answers Fly with 403), as they were fetched from elsewhere. Used only when fetching
// the document fails: one fetched always wins, and a copy is read as one fetched would be.
export const PINNED_DOCUMENTS: Record<string, string> = {
  'https://claude.ai/oauth/mcp-oauth-client-metadata': JSON.stringify({
    client_id: 'https://claude.ai/oauth/mcp-oauth-client-metadata',
    client_name: 'Claude',
    client_uri: 'https://claude.ai',
    redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
    grant_types: ['authorization_code', 'refresh_token', 'urn:ietf:params:oauth:grant-type:jwt-bearer'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  }),
  'https://claude.ai/oauth/claude-code-client-metadata': JSON.stringify({
    client_id: 'https://claude.ai/oauth/claude-code-client-metadata',
    client_name: 'Claude Code',
    client_uri: 'https://claude.ai',
    redirect_uris: ['http://localhost/callback', 'http://127.0.0.1/callback'],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  }),
};

// The client a document makes, or why it makes none.
function clientOf(clientId: string, url: URL, text: string, scopes: OAuthScope[]): OAuthClient {
  let doc: Record<string, unknown>;
  try { doc = JSON.parse(text); } catch { throw new ClientMetadataError("client_id's document is not JSON"); }
  if (doc.client_id !== clientId) throw new ClientMetadataError("client_id's document names another client_id");
  const method = doc.token_endpoint_auth_method ?? 'none';
  if (method !== 'none') throw new ClientMetadataError('A metadata document client authenticates with none (PKCE only)');
  const redirectUris = Array.isArray(doc.redirect_uris) ? doc.redirect_uris.filter((u): u is string => typeof u === 'string') : [];
  if (!redirectUris.length) throw new ClientMetadataError("client_id's document has no redirect_uris");
  const name = typeof doc.client_name === 'string' && doc.client_name.trim() ? doc.client_name.trim().slice(0, 100) : url.host;

  return {
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
}

export function createClientMetadataResolver(
  scopes: OAuthScope[], fetcher: FetchLike = fetch, lookup: LookupLike = defaultLookup,
  log: (line: string) => void = console.info,
) {
  // In insertion order, so the first entry is the oldest.
  const cache = new Map<string, { client: OAuthClient; until: number }>();
  const remember = (clientId: string, client: OAuthClient) => {
    cache.delete(clientId);
    if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value as string);
    cache.set(clientId, { client, until: Date.now() + CACHE_MS });
  };

  // The document at the client_id, from its host: never at a local or private address.
  const fetchDocument = async (clientId: string, url: URL): Promise<string> => {
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (/^(localhost|.*\.local|.*\.internal)$/i.test(host)) throw new ClientMetadataError("client_id's host is not reachable");
    let addresses: string[];
    try {
      addresses = isIP(host) ? [host] : await lookup(host);
    } catch (err) {
      throw new ClientMetadataError("client_id's host couldn't be looked up", true, causeOf(err));
    }
    if (!addresses.length) throw new ClientMetadataError("client_id's host couldn't be looked up", true, 'no address');
    if (addresses.some(isPrivateIp)) throw new ClientMetadataError("client_id's host is not reachable");

    try {
      const res = await fetcher(clientId, {
        redirect: 'error', headers: { Accept: 'application/json', 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new ClientMetadataError(`client_id's document answered ${res.status}`, temporaryStatus(res.status), `HTTP ${res.status}`);
      return await readLimited(res, MAX_BYTES);
    } catch (err) {
      throw err instanceof ClientMetadataError ? err : new ClientMetadataError("client_id's document couldn't be fetched", true, causeOf(err));
    }
  };

  return async function resolve(clientId: string): Promise<OAuthClient> {
    const cached = cache.get(clientId);
    if (cached && cached.until > Date.now()) return cached.client;

    const url = checkUrl(clientId);
    let text: string;
    try {
      text = await fetchDocument(clientId, url);
    } catch (err) {
      const pinned = PINNED_DOCUMENTS[clientId];
      if (!pinned || !(err instanceof ClientMetadataError)) throw err;
      log(`[oauth] client metadata ${clientId}: using the pinned copy, ${err.message}${err.detail ? ` (${err.detail})` : ''}`);
      // Not kept: the next time, the document is fetched again.
      return clientOf(clientId, url, pinned, scopes);
    }
    const client = clientOf(clientId, url, text, scopes);
    remember(clientId, client);
    return client;
  };
}
