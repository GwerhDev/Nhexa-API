import http from 'http';
import { Application } from 'express';
import { WebSocketServer } from 'ws';
import { decodeToken } from './jwt';
import { createStreamByRouter, resolveApiToken } from 'streamby-core';
import {
  awsBucket,
  awsBucketRegion,
  awsAccessKey,
  awsSecretKey,
  mongodbString,
  supabaseString,
  encryptionKey,
} from '../config';
import { supabase } from './supabase';
import { authMiddleware } from '../middleware/auth';
import type { UserRecord } from '../types';
import { createStreamByAuthProvider } from './streambyAuth';
import { STREAMBY_PATH, streambyBodyParser } from '../middleware/body';

// The signed-in user, or an API token's owner with its scope (see streambyAuth).
const authProvider = createStreamByAuthProvider({
  decodeToken,
  findUser: async (id) => {
    const { data: user, error } = await supabase.from('users').select('*').eq('id', id).single<UserRecord>();
    return error || !user ? null : user;
  },
  resolveApiToken,
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
    websocket: { server: wss },
  });

  app.use(STREAMBY_PATH, streambyBodyParser(), authMiddleware, streambyRouter);

  return server;
};
