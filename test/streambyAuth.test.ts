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
});
