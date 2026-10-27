import { Request, Response, Router } from 'express';
import { message } from '../messages';
import { getOAuthServer } from '../integrations/oauth';
import { nhexaApps } from '../integrations/nhexaEnvironment';
import { sessionUserId } from '../integrations/session';
import type { OAuthServer } from '../integrations/oauthServer';
import type { NhexaAppCategory } from '../types';

export interface AccountAppsRouterOptions {
  sessionUserId: (req: Request) => Promise<string | null>;
  nhexaApps: () => Promise<NhexaAppCategory[]>;
}

/**
 * The user's apps, for accounts.nhexa.cl: the Nhexa environment's, and the ones they connected
 * with OAuth (each one's access can be taken away).
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
      const [nhexa, connected] = await Promise.all([
        options.nhexaApps(),
        server ? server.connectedApps(res.locals.userId) : Promise.resolve([]),
      ]);
      res.set('Cache-Control', 'no-store').json({ nhexa, connected });
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

export default createAccountAppsRouter(getOAuthServer, { sessionUserId, nhexaApps });
