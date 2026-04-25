import http from 'http';
import express, { Application } from 'express';
import cookie from 'cookie';
import { WebSocketServer } from 'ws';
import { decodeToken } from './jwt';
import { createStreamByRouter } from 'streamby-core';
import type { Auth } from 'streamby-core/dist/types';
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
import { ACCESS_TOKEN_COOKIE } from './cookies';
import { authMiddleware } from '../middleware/auth';
import type { UserRecord, UserRole } from '../types';

const toStreambyRole = (role: UserRole): Auth['role'] => {
  if (role === 'admin') return 'admin';
  return 'viewer';
};

const authProvider = async (req: express.Request): Promise<Auth> => {
  const cookies = (req as any).cookies ?? cookie.parse(req.headers.cookie ?? '');
  const userToken: string =
    cookies[ACCESS_TOKEN_COOKIE] ?? req.headers.authorization?.split(' ')?.[1] ?? '';

  const decoded = await decodeToken(userToken);
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', decoded.data.id)
    .single<UserRecord>();

  if (error || !user) throw new Error('User not found');

  return {
    role: toStreambyRole(user.role),
    userId: user.id,
    username: user.username,
/*     profilePic: user.profilePic || user.googlePic || "",
 */  };
};

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

  app.use('/streamby', express.json(), authMiddleware, streambyRouter);

  return server;
};
