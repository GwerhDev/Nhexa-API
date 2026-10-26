import { Request, Response, Router } from 'express';
import { message } from '../messages';
import { getOAuthServer } from '../integrations/oauth';
import type { OAuthServer } from '../integrations/oauthServer';

/** The OAuth server's metadata (RFC 8414) and its public keys (JWKS), for anyone to read. */
export function createWellKnownRouter(getServer: () => OAuthServer | null): Router {
  const router = Router();

  const publish = (body: (server: OAuthServer) => object) => (_req: Request, res: Response) => {
    const server = getServer();
    if (!server) return res.status(503).json({ error: 'temporarily_unavailable', error_description: message.oauth.notConfigured });
    res.set({ 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=300' }).json(body(server));
  };

  router.get('/oauth-authorization-server', publish(server => server.metadata()));
  router.get('/jwks.json', publish(server => server.jwks()));

  return router;
}

export default createWellKnownRouter(getOAuthServer);
