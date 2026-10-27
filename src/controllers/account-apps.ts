import { Request, Response, Router } from 'express';
import { message } from '../messages';
import { getOAuthServer } from '../integrations/oauth';
import { sessionUserId } from '../integrations/session';
import type { OAuthServer } from '../integrations/oauthServer';

export interface AccountAppsRouterOptions {
  sessionUserId: (req: Request) => Promise<string | null>;
}

/**
 * The apps the user connected with their account (OAuth), for accounts.nhexa.cl: each one's
 * access can be taken away. (The Nhexa environment's apps are a StreamBy export the browser
 * reads itself: it answers only allowed origins.)
 */
export function createAccountAppsRouter(getServer: () => OAuthServer | null, options: AccountAppsRouterOptions): Router {
  const router = Router();

  router.use(async (req: Request, res: Response, next) => {
    const userId = await options.sessionUserId(req);
    if (!userId) return res.status(401).json({ message: message.user.unauthorized });
    res.locals.userId = userId;
    next();
  });

  router.get('/', async (_req: Request, res: Response) => {
    try {
      const server = getServer();
      const connected = server ? await server.connectedApps(res.locals.userId) : [];
      res.set('Cache-Control', 'no-store').json({ connected });
    } catch (err) {
      console.error('[account-apps]', err);
      res.status(500).json({ message: message.oauth.error });
    }
  });

  router.delete('/:clientId', async (req: Request, res: Response) => {
    const server = getServer();
    if (!server) return res.status(503).json({ message: message.oauth.notConfigured });
    try {
      const removed = await server.disconnectApp(res.locals.userId, String(req.params.clientId));
      if (!removed) return res.status(404).json({ message: message.oauth.appNotFound });
      res.status(204).end();
    } catch (err) {
      console.error('[account-apps]', err);
      res.status(500).json({ message: message.oauth.error });
    }
  });

  return router;
}

export default createAccountAppsRouter(getOAuthServer, { sessionUserId });
