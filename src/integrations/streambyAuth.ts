import cookie from 'cookie';
import type { Request } from 'express';
import type { IncomingMessage } from 'http';
import { API_TOKEN_PREFIX, looksLikeOAuthAccessToken } from 'streamby-core';
import type { Auth, ResolvedApiToken, VerifiedOAuthToken } from 'streamby-core';
import type { OAuthConsent, UserRecord, UserRole } from '../types';
import { ACCESS_TOKEN_COOKIE } from './cookies';

// Who a StreamBy request is: the signed-in user (their session's access token, as a cookie or
// a Bearer), an API token (`Authorization: Bearer sbt_...`, for agents and services), or an
// OAuth access token of an app the user signed in to with Nhexa (e.g. claude.ai's connector).
// A user's token is its owner; a project's token is the token itself, on its project, not any
// user; an app acts as its user. A token's request carries its scope (Auth.apiToken), so
// StreamBy lets it reach only that: without it, a token would have all of its owner's access.

export interface StreamByAuthDeps {
  // The session's access token, decoded (throws when it's invalid or expired).
  decodeToken: (token: string) => Promise<{ data: { id: string } }>;
  // A user by id, or null when there's none (a deleted account).
  findUser: (id: string) => Promise<UserRecord | null>;
  // An API token's owner and scope, or null when it's unknown, revoked or expired.
  resolveApiToken: (token: string) => Promise<ResolvedApiToken | null>;
  // An OAuth access token checked (signature, issuer, audience, expiry), or null.
  verifyOAuthToken: (token: string) => Promise<VerifiedOAuthToken | null>;
  // The user's consent to the app, or null once they took its access away.
  appAccess: (userId: string, clientId: string) => Promise<OAuthConsent | null>;
  // Marks that the app used the user's access (for their list of connected apps).
  touchAppAccess: (userId: string, clientId: string) => Promise<void>;
  now?: () => number;
}

// An app's use is marked at most this often, per user and app.
const TOUCH_EVERY_MS = 60 * 1000;

const toStreambyRole = (role: UserRole): Auth['role'] => (role === 'admin' ? 'admin' : 'viewer');

const bearerOf = (req: Request | IncomingMessage): string | undefined => {
  const header = req.headers.authorization;
  return typeof header === 'string' && /^Bearer /i.test(header) ? header.slice(7).trim() : undefined;
};

export const createStreamByAuthProvider = (deps: StreamByAuthDeps) => {
  const now = deps.now ?? Date.now;
  const touched = new Map<string, number>();
  const touch = (userId: string, clientId: string) => {
    const key = `${userId}:${clientId}`;
    if (now() - (touched.get(key) ?? 0) < TOUCH_EVERY_MS) return;
    touched.set(key, now());
    if (touched.size > 10_000) touched.clear();
    deps.touchAppAccess(userId, clientId).catch(err => console.error('[streamby] touchAppAccess:', err instanceof Error ? err.message : err));
  };

  return async (req: Request | IncomingMessage): Promise<Auth> => {
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

    // An app's OAuth access token, even alongside a session cookie: it reaches what its scopes
    // grant, and only while the user's consent stands -- taking the app's access away in
    // accounts ends it at once, not when the token expires.
    if (looksLikeOAuthAccessToken(bearer)) {
      const verified = await deps.verifyOAuthToken(bearer);
      if (!verified) throw new Error('Invalid OAuth access token');
      const consent = await deps.appAccess(verified.userId, verified.clientId);
      if (!consent) throw new Error('The app no longer has access');
      const user = await deps.findUser(verified.userId);
      if (!user) throw new Error('User not found');
      touch(user.id, verified.clientId);
      return {
        role: toStreambyRole(user.role), userId: user.id, username: user.username,
        apiToken: verified.scope,
        oauth: { clientId: verified.clientId, clientName: consent.client_name ?? undefined },
      };
    }

    const cookies = (req as any).cookies ?? cookie.parse(req.headers.cookie ?? '');
    const userToken: string = cookies[ACCESS_TOKEN_COOKIE] ?? bearer ?? '';
    const decoded = await deps.decodeToken(userToken);
    const user = await deps.findUser(decoded.data.id);
    if (!user) throw new Error('User not found');
    return { role: toStreambyRole(user.role), userId: user.id, username: user.username };
  };
};
