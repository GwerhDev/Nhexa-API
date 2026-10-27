import { nhexaEnvironmentUrl } from '../config';
import type { NhexaAppCategory } from '../types';

// The apps of the Nhexa environment, by category: the catalog published as a StreamBy export,
// read from there and kept for a few minutes. If it can't be read, the last one read is kept
// (none yet: an empty catalog), so the list of connected apps still answers.

const CACHE_MS = 5 * 60 * 1000;
const TIMEOUT_MS = 5000;

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

// The export's shape: each category's _id and _name, and its apps under keys '0', '1', ...
type RawCategory = Record<string, unknown> & { _id?: unknown; _name?: unknown };

/** The export's categories, with their apps in order. */
export const normalizeNhexaEnvironment = (raw: unknown): NhexaAppCategory[] =>
  (Array.isArray(raw) ? (raw as RawCategory[]) : [])
    .filter(category => category && typeof category === 'object')
    .map(category => ({
      id: String(category._id ?? ''),
      name: String(category._name ?? ''),
      apps: Object.entries(category)
        .filter(([key]) => /^\d+$/.test(key))
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([, app]) => app as NhexaAppCategory['apps'][number]),
    }));

export function createNhexaEnvironment(url: string | undefined, fetcher: Fetcher = fetch, now: () => number = Date.now) {
  let cached: NhexaAppCategory[] = [];
  let until = 0;
  let inFlight: Promise<NhexaAppCategory[]> | null = null;

  const load = async (): Promise<NhexaAppCategory[]> => {
    if (!url) return [];
    try {
      const res = await fetcher(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) throw new Error(`answered ${res.status}`);
      cached = normalizeNhexaEnvironment(await res.json());
    } catch (err) {
      console.error('[nhexa-environment] could not read the catalog:', err instanceof Error ? err.message : err);
    }
    until = now() + CACHE_MS;
    return cached;
  };

  return function nhexaApps(): Promise<NhexaAppCategory[]> {
    if (now() < until) return Promise.resolve(cached);
    inFlight ??= load().finally(() => { inFlight = null; });
    return inFlight;
  };
}

export const nhexaApps = createNhexaEnvironment(nhexaEnvironmentUrl);
