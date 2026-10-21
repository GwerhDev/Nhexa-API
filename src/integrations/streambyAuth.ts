import cookie from 'cookie';
import type { Request } from 'express';
import type { IncomingMessage } from 'http';
import { API_TOKEN_PREFIX } from 'streamby-core';
import type { Auth, ResolvedApiToken } from 'streamby-core';
import type { UserRecord, UserRole } from '../types';
import { ACCESS_TOKEN_COOKIE } from './cookies';

// Who a StreamBy request is: the signed-in user (their session's access token, as a cookie or
// a Bearer), or an API token (`Authorization: Bearer sbt_...`, for agents and services). A
// user's token is its owner; a project's token is the token itself, on its project, not any
// user. A token's request carries its scope (Auth.apiToken), so StreamBy lets it reach only
// that: without it, a token would have all of its owner's access.

export interface StreamByAuthDeps {
  // The session's access token, decoded (throws when it's invalid or expired).
  decodeToken: (token: string) => Promise<{ data: { id: string } }>;
  // A user by id, or null when there's none (a deleted account).
  findUser: (id: string) => Promise<UserRecord | null>;
  // An API token's owner and scope, or null when it's unknown, revoked or expired.
  resolveApiToken: (token: string) => Promise<ResolvedApiToken | null>;
}

const toStreambyRole = (role: UserRole): Auth['role'] => (role === 'admin' ? 'admin' : 'viewer');

const bearerOf = (req: Request | IncomingMessage): string | undefined => {
  const header = req.headers.authorization;
  return typeof header === 'string' && /^Bearer /i.test(header) ? header.slice(7).trim() : undefined;
};

export const createStreamByAuthProvider = (deps: StreamByAuthDeps) =>
  async (req: Request | IncomingMessage): Promise<Auth> => {
    const bearer = bearerOf(req);

    // An API token, even alongside a session cookie: what it reaches is its scope.
    if (bearer?.startsWith(API_TOKEN_PREFIX)) {
      const resolved = await deps.resolveApiToken(bearer);
      if (!resolved) throw new Error('Invalid API token');
      // A project's token isn't a user: its userId names the token on its project (StreamBy
      // treats it as that project's alone), and it goes by its name.
      if (resolved.scope.kind === 'project') {
        return { role: 'viewer', userId: resolved.userId, username: resolved.name, apiToken: resolved.scope };
      }
      // A user's token: its owner must still have an account; a deleted one's tokens open nothing.
      const user = await deps.findUser(resolved.userId);
      if (!user) throw new Error('User not found');
      return { role: toStreambyRole(user.role), userId: user.id, username: user.username, apiToken: resolved.scope };
    }

    const cookies = (req as any).cookies ?? cookie.parse(req.headers.cookie ?? '');
    const userToken: string = cookies[ACCESS_TOKEN_COOKIE] ?? bearer ?? '';
    const decoded = await deps.decodeToken(userToken);
    const user = await deps.findUser(decoded.data.id);
    if (!user) throw new Error('User not found');
    return { role: toStreambyRole(user.role), userId: user.id, username: user.username };
  };
