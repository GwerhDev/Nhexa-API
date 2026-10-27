import { Request, Response, Router } from 'express';
import { protectedResourceMetadata } from 'streamby-core';
import { apiUrl } from '../config';
import { message } from '../messages';
import { getOAuthServer, oauthResourceList } from '../integrations/oauth';
import type { OAuthServer } from '../integrations/oauthServer';

/**
 * For anyone to read: the OAuth server's metadata (RFC 8414) and its public keys (JWKS), and,
 * for each resource its tokens are for (StreamBy and its MCP server), that resource's metadata
 * (RFC 9728) at its place, /.well-known/oauth-protected-resource<the resource's path>.
 */
export function createWellKnownRouter(getServer: () => OAuthServer | null, issuer: string, resources: string[]): Router {
  const router = Router();

  const publish = (body: (server: OAuthServer) => object) => (_req: Request, res: Response) => {
    const server = getServer();
    if (!server) return res.status(503).json({ error: 'temporarily_unavailable', error_description: message.oauth.notConfigured });
    res.set({ 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=300' }).json(body(server));
  };

  router.get('/oauth-authorization-server', publish(server => server.metadata()));
  router.get('/jwks.json', publish(server => server.jwks()));

  for (const resource of resources) {
    const path = new URL(resource).pathname.replace(/\/$/, '');
    router.get(`/oauth-protected-resource${path}`, publish(() => protectedResourceMetadata({ issuer, resource })));
  }

  return router;
}

// Without the API's URL (tests, a broken config) there's no resource to describe.
export default createWellKnownRouter(getOAuthServer, apiUrl, apiUrl ? oauthResourceList() : []);
