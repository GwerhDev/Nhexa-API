import { Request, RequestHandler } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { message } from '../messages';

// Requests are counted per client address. Behind Fly's proxy the socket's address is the
// proxy's, so there the address is Fly-Client-IP, which Fly's edge sets on every request it
// forwards (a client's own value never gets through). That header is only believed on Fly
// (FLY_APP_NAME is set on its machines): anywhere else anyone could send it. `trust proxy`
// stays off, so req.ip and X-Forwarded-For mean what they always did for the rest of the API.
// Counts live in each machine's memory: with several machines, a client gets each limit per
// machine, which is enough to stop a flood.

export const onFly = (): boolean => !!process.env.FLY_APP_NAME;

/** The address a request came from: Fly-Client-IP on Fly, the socket's elsewhere. */
export const clientAddress = (req: Request, behindFly = onFly()): string => {
  const flyClientIp = req.headers['fly-client-ip'];
  if (behindFly && typeof flyClientIp === 'string' && flyClientIp) return flyClientIp;
  return req.socket.remoteAddress ?? 'unknown';
};

export interface RateLimitOptions {
  windowMs: number;
  limit: number;
  behindFly?: boolean;
}

/** At most `limit` requests per client address in `windowMs`; beyond that, an OAuth error. */
export const oauthRateLimit = ({ windowMs, limit, behindFly = onFly() }: RateLimitOptions): RequestHandler => rateLimit({
  windowMs,
  limit,
  // RateLimit and Retry-After headers, so a client knows when to come back.
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // An IPv6 client is one /56 (it may hold many addresses).
  keyGenerator: req => ipKeyGenerator(clientAddress(req, behindFly)),
  // Fly adds X-Forwarded-For; it's deliberately not used (see above).
  validate: { xForwardedForHeader: false },
  handler: (_req, res) => {
    res.set('Cache-Control', 'no-store').status(429).json({ error: 'temporarily_unavailable', error_description: message.oauth.tooManyRequests });
  },
});
