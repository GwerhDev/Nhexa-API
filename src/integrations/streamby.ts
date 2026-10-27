import http from 'http';
import { Application } from 'express';
import { WebSocketServer } from 'ws';
import { decodeToken } from './jwt';
import { createOAuthTokenVerifier, createStreamByRouter, resolveApiToken } from 'streamby-core';
import {
  awsBucket,
  awsBucketRegion,
  awsAccessKey,
  awsSecretKey,
  mongodbString,
  supabaseString,
  encryptionKey,
  apiUrl,
} from '../config';
import { supabase } from './supabase';
import { authMiddleware } from '../middleware/auth';
import type { UserRecord } from '../types';
import { createStreamByAuthProvider } from './streambyAuth';
import { getOAuthServer, oauthResourceList } from './oauth';
import { STREAMBY_PATH, streambyBodyParser } from '../middleware/body';

// StreamBy as an OAuth protected resource of Nhexa's own authorization server (this same API):
// its MCP server is what clients such as claude.ai connect to.
const streambyOAuth = { issuer: apiUrl, resource: `${apiUrl}${STREAMBY_PATH}/mcp` };

// Nhexa's access tokens, checked with its keys (here, no request needed) and for StreamBy alone.
const verifyOAuthToken = createOAuthTokenVerifier({
  issuer: apiUrl,
  audiences: oauthResourceList(),
  jwks: async () => getOAuthServer()?.jwks() ?? { keys: [] },
});

// The signed-in user, an API token's owner with its scope, or an app the user connected with
// OAuth, with what they approved (see streambyAuth).
const authProvider = createStreamByAuthProvider({
  decodeToken,
  findUser: async (id) => {
    const { data: user, error } = await supabase.from('users').select('*').eq('id', id).single<UserRecord>();
    return error || !user ? null : user;
  },
  resolveApiToken,
  verifyOAuthToken,
  appAccess: async (userId, clientId) => getOAuthServer()?.appAccess(userId, clientId) ?? null,
  touchAppAccess: async (userId, clientId) => { await getOAuthServer()?.touchAppAccess(userId, clientId); },
});

export default (app: Application): http.Server => {
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/streamby/ws' });

  const streambyRouter = createStreamByRouter({
    authProvider,
    databases: [
      { id: 'mongo', type: 'nosql', connectionString: mongodbString },
      { id: 'supabase', type: 'sql', main: true, connectionString: supabaseString },
    ],
    storageProviders: [
      {
        id: 'builtin',
        type: 's3',
        config: {
          bucket: awsBucket,
          region: awsBucketRegion,
          accessKeyId: awsAccessKey,
          secretAccessKey: awsSecretKey,
        },
      },
    ],
    encrypt: encryptionKey,
    oauth: streambyOAuth,
    websocket: { server: wss },
    // Where workers call back: the public https URL. Behind Fly's proxy (TLS ends there, and
    // there's no trust proxy) the request's own URL would come out as http://.
    workerOptions: { callbackBaseUrl: `${apiUrl}${STREAMBY_PATH}` },
  });

  app.use(STREAMBY_PATH, streambyBodyParser(), authMiddleware, streambyRouter);

  return server;
};
