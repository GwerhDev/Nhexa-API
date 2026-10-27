/// <reference types="node" />
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Request } from 'express';
import { createStreamByAuthProvider, type StreamByAuthDeps } from '../src/integrations/streambyAuth';
import { ACCESS_TOKEN_COOKIE } from '../src/integrations/cookies';

const OWNER = { id: 'user-1', username: 'owner', role: 'user' } as any;
const SCOPE = { tokenId: 'tok-1', kind: 'user' as const, permissions: ['project:read' as const], projectIds: ['p1'] };
const PROJECT_TOKEN = 'sbt_a-project-token';
const PROJECT_SCOPE = { tokenId: 'tok-2', kind: 'project' as const, permissions: ['assets:read' as const], projectIds: ['p1'] };
const PROJECT_PRINCIPAL = 'project-token:tok-2:p1';
const TOKEN = 'sbt_a-token';
const SESSION_JWT = 'eyJ.session.jwt';
// Shaped as an OAuth access token (a JWT signed with RS256): what verifyOAuthToken checks.
const jwtWith = (sig: string) => `${Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'k' })).toString('base64url')}.${Buffer.from('{}').toString('base64url')}.${sig}`;
const APP_TOKEN = jwtWith('good');
const APP_SCOPE = { tokenId: 'oauth:dyn_claude:user-1', kind: 'user' as const, permissions: ['project:read' as const], projectIds: '*' as const };
const VERIFIED = { userId: OWNER.id, clientId: 'dyn_claude', scopes: ['streamby:read'], expiresAt: new Date(Date.now() + 3600_000), scope: APP_SCOPE };
const CONSENT = { user_id: OWNER.id, client_id: 'dyn_claude', scopes: ['streamby:read' as const], client_name: 'Claude' };

const requestWith = ({ bearer, cookie }: { bearer?: string; cookie?: string }): Request =>
  ({
    headers: { ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
    cookies: cookie ? { [ACCESS_TOKEN_COOKIE]: cookie } : {},
  }) as unknown as Request;

const deps = (over: Partial<StreamByAuthDeps> = {}): StreamByAuthDeps => ({
  decodeToken: async (token) => {
    if (token !== SESSION_JWT) throw new Error('invalid token');
    return { data: { id: OWNER.id } };
  },
  findUser: async (id) => (id === OWNER.id ? OWNER : null),
  resolveApiToken: async (token) => {
    if (token === TOKEN) return { userId: OWNER.id, name: 'Laptop', scope: SCOPE };
    if (token === PROJECT_TOKEN) return { userId: PROJECT_PRINCIPAL, name: 'CI', scope: PROJECT_SCOPE };
    return null;
  },
  verifyOAuthToken: async (token) => (token === APP_TOKEN ? VERIFIED : null),
  appAccess: async (userId, clientId) => (userId === OWNER.id && clientId === 'dyn_claude' ? CONSENT : null),
  touchAppAccess: async () => {},
  ...over,
});

describe('StreamBy authProvider', () => {
  it('an API token is its owner, with the token\'s scope', async () => {
    const auth = await createStreamByAuthProvider(deps())(requestWith({ bearer: TOKEN }));
    assert.deepEqual(auth, { role: 'viewer', userId: OWNER.id, username: OWNER.username, apiToken: SCOPE });
  });

  it('an API token sent with a session cookie is still only its scope', async () => {
    const auth = await createStreamByAuthProvider(deps())(requestWith({ bearer: TOKEN, cookie: SESSION_JWT }));
    assert.deepEqual(auth.apiToken, SCOPE);
  });

  // A project's token isn't any user: it's never looked up as one, and goes by its name.
  it('a project\'s API token is the token on its project, with its scope, not a user', async () => {
    let lookedUp = 0;
    const provider = createStreamByAuthProvider(deps({ findUser: async (id) => { lookedUp++; return id === OWNER.id ? OWNER : null; } }));
    const auth = await provider(requestWith({ bearer: PROJECT_TOKEN }));
    assert.deepEqual(auth, { role: 'viewer', userId: PROJECT_PRINCIPAL, username: 'CI', apiToken: PROJECT_SCOPE });
    assert.equal(lookedUp, 0);
  });

  it('an unknown, revoked or expired API token opens nothing', async () => {
    await assert.rejects(createStreamByAuthProvider(deps())(requestWith({ bearer: 'sbt_revoked' })), /Invalid API token/);
  });

  it('a token of a deleted account opens nothing', async () => {
    const provider = createStreamByAuthProvider(deps({ findUser: async () => null }));
    await assert.rejects(provider(requestWith({ bearer: TOKEN })), /User not found/);
  });

  it('a session (cookie or Bearer) is its user, with no token scope', async () => {
    for (const request of [requestWith({ cookie: SESSION_JWT }), requestWith({ bearer: SESSION_JWT })]) {
      const auth = await createStreamByAuthProvider(deps())(request);
      assert.equal(auth.userId, OWNER.id);
      assert.equal(auth.apiToken, undefined);
    }
  });

  it('a session token is never taken for an API token, nor the other way round', async () => {
    let resolved = 0;
    const provider = createStreamByAuthProvider(deps({ resolveApiToken: async () => { resolved++; return null; } }));
    await provider(requestWith({ cookie: SESSION_JWT }));
    assert.equal(resolved, 0);
    await assert.rejects(createStreamByAuthProvider(deps())(requestWith({ cookie: TOKEN })), /invalid token/);
  });

  it("an app's OAuth access token is its user, with what its scopes grant, and the app", async () => {
    const auth = await createStreamByAuthProvider(deps())(requestWith({ bearer: APP_TOKEN, cookie: SESSION_JWT }));
    assert.deepEqual(auth, {
      role: 'viewer', userId: OWNER.id, username: OWNER.username, apiToken: APP_SCOPE,
      oauth: { clientId: 'dyn_claude', clientName: 'Claude' },
    });
  });

  it("an app's token opens nothing once it's invalid, its access was taken away, or its user is gone", async () => {
    await assert.rejects(createStreamByAuthProvider(deps())(requestWith({ bearer: jwtWith('forged'), cookie: SESSION_JWT })), /Invalid OAuth access token/);
    await assert.rejects(createStreamByAuthProvider(deps({ appAccess: async () => null }))(requestWith({ bearer: APP_TOKEN })), /no longer has access/);
    await assert.rejects(createStreamByAuthProvider(deps({ findUser: async () => null }))(requestWith({ bearer: APP_TOKEN })), /User not found/);
  });

  it("marks an app's use now and then, not on every request", async () => {
    let touched = 0;
    let clock = 0;
    const provider = createStreamByAuthProvider(deps({ touchAppAccess: async () => { touched++; }, now: () => clock }));
    clock = 120_000;
    await provider(requestWith({ bearer: APP_TOKEN }));
    await provider(requestWith({ bearer: APP_TOKEN }));
    assert.equal(touched, 1);
    clock += 61_000;
    await provider(requestWith({ bearer: APP_TOKEN }));
    assert.equal(touched, 2);
  });
});
