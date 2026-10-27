import { Request, Response, Router } from 'express';
import { clientAccountsUrl } from '../config';
import { message } from '../messages';
import { validate } from '../middleware/validate';
import { OAuthDecisionSchema, OAuthRegisterSchema, OAuthRevokeSchema, OAuthTokenSchema } from '../schemas/auth';
import { sessionUserId } from '../integrations/session';
import { getOAuthServer } from '../integrations/oauth';
import { ClientCredentials, OAuthError, OAuthServer } from '../integrations/oauthServer';
import { oauthRateLimit, RateLimitOptions } from '../middleware/rateLimit';

export interface OAuthRouterOptions {
  // The signed-in user's id (their Nhexa session), or null.
  sessionUserId: (req: Request) => Promise<string | null>;
  // accounts.nhexa.cl's origin: the only one that may send the user's answer.
  accountsOrigin: string;
  // How many requests a client address may make to the endpoints anyone can call.
  rateLimits?: Partial<Record<'authorizeRequest' | 'token' | 'register', RateLimitOptions>>;
}

const MINUTE = 60 * 1000;
// Generous for people and apps, short of a flood. /token is called by app servers on behalf of
// all their users (one address, many refreshes); /register is a client's once-in-a-while step.
const DEFAULT_RATE_LIMITS: Record<'authorizeRequest' | 'token' | 'register', RateLimitOptions> = {
  authorizeRequest: { windowMs: MINUTE, limit: 60 },
  token: { windowMs: MINUTE, limit: 300 },
  register: { windowMs: 60 * MINUTE, limit: 20 },
};

// The client's credentials: HTTP Basic (client_secret_basic) or in the body (client_secret_post).
const credentialsOf = (req: Request): ClientCredentials => {
  const basic = req.headers.authorization?.match(/^Basic\s+(.+)$/i)?.[1];
  if (basic) {
    const [id, ...secret] = Buffer.from(basic, 'base64').toString('utf8').split(':');
    return { clientId: decodeURIComponent(id), clientSecret: decodeURIComponent(secret.join(':')) };
  }
  return {
    clientId: typeof req.body?.client_id === 'string' ? req.body.client_id : undefined,
    clientSecret: typeof req.body?.client_secret === 'string' ? req.body.client_secret : undefined,
  };
};

const noStore = (res: Response) => res.set({ 'Cache-Control': 'no-store', Pragma: 'no-cache' });

const sendError = (res: Response, err: unknown) => {
  if (err instanceof OAuthError) {
    if (err.status === 401) res.set('WWW-Authenticate', `Bearer error="${err.error}"`);
    return res.status(err.status).json({ error: err.error, error_description: err.message });
  }
  console.error('[oauth]', err);
  return res.status(500).json({ error: 'server_error', error_description: message.oauth.error });
};

/** The OAuth endpoints; `server` is the OAuth server, or null while it isn't configured. */
export function createOAuthRouter(getServer: () => OAuthServer | null, options: OAuthRouterOptions): Router {
  const router = Router();

  router.use((_req, res, next) => {
    if (!getServer()) return res.status(503).json({ error: 'temporarily_unavailable', error_description: message.oauth.notConfigured });
    next();
  });
  const server = () => getServer()!;
  const limit = (endpoint: keyof typeof DEFAULT_RATE_LIMITS) => oauthRateLimit(options.rateLimits?.[endpoint] ?? DEFAULT_RATE_LIMITS[endpoint]);

  // What accounts.nhexa.cl shows: the client and the scopes the request asks for, once
  // checked, and whether the signed-in user already approved them.
  router.get('/authorize/request', limit('authorizeRequest'), async (req: Request, res: Response) => {
    const params = req.query as Record<string, unknown>;
    try {
      const request = await server().checkAuthorize(params);
      const userId = await options.sessionUserId(req);
      noStore(res).json({
        client: {
          id: request.client.client_id,
          name: request.client.name,
          logoUri: request.client.logo_uri,
          clientUri: request.client.client_uri,
          verified: request.client.registration === 'manual',
        },
        scopes: request.scopes,
        redirectUri: request.redirectUri,
        consented: userId ? await server().hasConsent(userId, request) : false,
      });
    } catch (err) {
      if (!(err instanceof OAuthError)) return sendError(res, err);
      const redirectTo = await server().errorRedirect(params, err);
      res.status(400).json({ error: err.error, error_description: err.message, ...(redirectTo ? { redirectTo } : {}) });
    }
  });

  // The user's answer, sent by accounts.nhexa.cl with their session: where to send them back.
  router.post('/authorize/decision', validate(OAuthDecisionSchema), async (req: Request, res: Response) => {
    if (req.headers.origin !== options.accountsOrigin || !req.is('application/json')) {
      return res.status(403).json({ error: 'access_denied', error_description: message.oauth.forbiddenOrigin });
    }
    const userId = await options.sessionUserId(req);
    if (!userId) return res.status(401).json({ error: 'login_required', error_description: message.oauth.loginRequired });
    try {
      const request = await server().checkAuthorize(req.body.request);
      noStore(res).json({ redirectTo: await server().decide(userId, request, req.body.approve) });
    } catch (err) {
      if (!(err instanceof OAuthError)) return sendError(res, err);
      const redirectTo = await server().errorRedirect(req.body.request, err);
      res.status(400).json({ error: err.error, error_description: err.message, ...(redirectTo ? { redirectTo } : {}) });
    }
  });

  router.post('/token', limit('token'), validate(OAuthTokenSchema), async (req: Request, res: Response) => {
    try {
      noStore(res).json(await server().token(req.body, credentialsOf(req)));
    } catch (err) {
      noStore(res);
      sendError(res, err);
    }
  });

  const userinfo = async (req: Request, res: Response) => {
    const bearer = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!bearer) {
      res.set('WWW-Authenticate', 'Bearer');
      return res.status(401).json({ error: 'invalid_token', error_description: message.user.unauthorized });
    }
    try {
      noStore(res).json(await server().userinfo(bearer));
    } catch (err) {
      sendError(res, err);
    }
  };
  router.get('/userinfo', userinfo);
  router.post('/userinfo', userinfo);

  router.post('/revoke', validate(OAuthRevokeSchema), async (req: Request, res: Response) => {
    try {
      await server().revoke(req.body.token, credentialsOf(req));
      res.status(200).end();
    } catch (err) {
      sendError(res, err);
    }
  });

  router.post('/register', limit('register'), validate(OAuthRegisterSchema), async (req: Request, res: Response) => {
    try {
      noStore(res).status(201).json(await server().register(req.body));
    } catch (err) {
      sendError(res, err);
    }
  });

  return router;
}

export default createOAuthRouter(getOAuthServer, { sessionUserId, accountsOrigin: new URL(clientAccountsUrl || 'http://localhost').origin });
