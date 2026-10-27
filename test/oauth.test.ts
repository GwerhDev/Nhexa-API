/// <reference types="node" />
import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createOAuthRouter } from '../src/controllers/oauth';
import { createWellKnownRouter } from '../src/controllers/well-known';
import { createOAuthServer, OAUTH_SCOPES } from '../src/integrations/oauthServer';
import { createOAuthSigner, ephemeralSigningKey } from '../src/integrations/oauthKeys';
import type { OAuthStore } from '../src/integrations/oauthStore';
import type { OAuthClient, OAuthCode, OAuthConsent, OAuthRefreshToken, UserRecord } from '../src/types';

// ── An OAuth server over records in memory ──

const ISSUER = 'https://api.nhexa.test';
const ACCOUNTS = 'https://accounts.nhexa.test';
const STREAMBY = `${ISSUER}/streamby`;
const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');

const memory = () => {
  const clients = new Map<string, OAuthClient>();
  const codes = new Map<string, OAuthCode>();
  const tokens = new Map<string, OAuthRefreshToken>();
  const consents = new Map<string, OAuthConsent>();
  const store: OAuthStore = {
    findClient: async id => clients.get(id) ?? null,
    createClient: async c => { clients.set(c.client_id, { ...c }); },
    createCode: async c => { codes.set(c.code_hash, { ...c, used_at: null }); },
    useCode: async h => {
      const c = codes.get(h);
      if (!c || c.used_at) return null;
      c.used_at = new Date().toISOString();
      return { ...c };
    },
    findCode: async h => codes.get(h) ?? null,
    createRefreshToken: async t => { tokens.set(t.token_hash, { ...t, rotated_at: null, revoked_at: null }); },
    findRefreshToken: async h => (tokens.has(h) ? { ...tokens.get(h)! } : null),
    rotateRefreshToken: async h => {
      const t = tokens.get(h);
      if (!t || t.rotated_at || t.revoked_at) return null;
      t.rotated_at = new Date().toISOString();
      return { ...t };
    },
    revokeRefreshToken: async h => { const t = tokens.get(h); if (t) t.revoked_at = new Date().toISOString(); },
    revokeFamily: async f => { for (const t of tokens.values()) if (t.family_id === f) t.revoked_at ??= new Date().toISOString(); },
    findConsent: async (u, c) => consents.get(`${u}:${c}`) ?? null,
    saveConsent: async c => { consents.set(`${c.user_id}:${c.client_id}`, { ...c }); },
  };
  return { store, clients, codes, tokens, consents };
};

const USERS: Record<string, Partial<UserRecord>> = {
  ada: { id: 'ada', username: 'ada', email: 'ada@nhexa.cl', role: 'admin', isVerified: true, profilePic: 'https://pic/ada.png' },
};

let db = memory();
let clock = Date.now();
const signer = createOAuthSigner(ISSUER, ephemeralSigningKey());
const metadataClient: OAuthClient = {
  client_id: 'https://claude.example/oauth/client.json', client_secret_hash: null, type: 'public', name: 'Claude',
  logo_uri: null, client_uri: null, redirect_uris: ['https://claude.example/callback'], scopes: OAUTH_SCOPES, registration: 'metadata',
};
const server = () => createOAuthServer({
  store: db.store, signer,
  resolveMetadataClient: async id => { if (id === metadataClient.client_id) return metadataClient; throw new Error('no'); },
  findUser: async id => (USERS[id] as UserRecord) ?? null,
  issuer: ISSUER, authorizationEndpoint: `${ACCOUNTS}/oauth/authorize`,
  resources: [STREAMBY, `${STREAMBY}/mcp`], now: () => clock,
});

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
let current = server();
app.use('/oauth', createOAuthRouter(() => current, {
  sessionUserId: async req => (req.headers['x-test-user'] as string) ?? null,
  accountsOrigin: ACCOUNTS,
}));
app.use('/.well-known', createWellKnownRouter(() => current));

let http: Server;
let base: string;
before(async () => {
  http = app.listen(0);
  await new Promise(resolve => http.once('listening', resolve));
  base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
});
after(() => http.close());

// ── Helpers: a client, a PKCE pair, the flow's steps ──

const SECRET = 'streamby-secret';
const STREAMBY_CLIENT: OAuthClient = {
  client_id: 'streamby', client_secret_hash: sha256(SECRET), type: 'confidential', name: 'StreamBy', logo_uri: null, client_uri: null,
  redirect_uris: ['https://streamby.nhexa.test/oauth/callback'], scopes: OAUTH_SCOPES, registration: 'manual',
};
const pkce = () => {
  const verifier = crypto.randomBytes(32).toString('base64url');
  return { verifier, challenge: crypto.createHash('sha256').update(verifier).digest('base64url') };
};
const authorizeParams = (over: Record<string, string> = {}, challenge = pkce().challenge) => ({
  client_id: 'streamby', redirect_uri: STREAMBY_CLIENT.redirect_uris[0], response_type: 'code', scope: 'profile email streamby:read',
  state: 'xyz', code_challenge: challenge, code_challenge_method: 'S256', resource: STREAMBY, ...over,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the answers' shapes are what's tested
const json = async (res: Response): Promise<{ status: number; body: any }> => ({
  status: res.status,
  body: res.headers.get('content-type')?.includes('json') ? await res.json() : null,
});
const getRequest = async (params: Record<string, string>, user?: string) =>
  json(await fetch(`${base}/oauth/authorize/request?${new URLSearchParams(params)}`, { headers: user ? { 'x-test-user': user } : {} }));
const decide = async (params: Record<string, string>, approve = true, { user = 'ada', origin = ACCOUNTS } = {}) =>
  json(await fetch(`${base}/oauth/authorize/decision`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...(user ? { 'x-test-user': user } : {}) },
    body: JSON.stringify({ request: params, approve }),
  }));
const tokenRequest = async (fields: Record<string, string>, basic?: [string, string]) =>
  json(await fetch(`${base}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(basic ? { Authorization: `Basic ${Buffer.from(`${basic[0]}:${basic[1]}`).toString('base64')}` } : {}) },
    body: new URLSearchParams(fields).toString(),
  }));
const codeFrom = (redirectTo: string) => new URL(redirectTo).searchParams.get('code')!;

// The whole flow, to tokens.
const flow = async (over: Record<string, string> = {}) => {
  const { verifier, challenge } = pkce();
  const params = authorizeParams(over, challenge);
  const decision = await decide(params);
  const code = codeFrom(decision.body.redirectTo);
  const tokens = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: params.redirect_uri, code_verifier: verifier }, [params.client_id, SECRET]);
  return { params, verifier, code, tokens };
};

beforeEach(() => {
  db = memory();
  db.clients.set('streamby', { ...STREAMBY_CLIENT });
  clock = Date.now();
  current = server();
});

// ── Tests ──

describe('the authorization request', () => {
  it("shows the client and the scopes asked for, and whether they're already approved", async () => {
    const res = await getRequest(authorizeParams(), 'ada');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.client, { id: 'streamby', name: 'StreamBy', logoUri: null, clientUri: null, verified: true });
    assert.deepEqual(res.body.scopes, ['profile', 'email', 'streamby:read']);
    assert.equal(res.body.consented, false);
  });

  it("isn't sent back to an unknown client or an unregistered redirect_uri", async () => {
    for (const over of [{ client_id: 'nope' }, { redirect_uri: 'https://evil.example/cb' }] as Record<string, string>[]) {
      const res = await getRequest(authorizeParams(over));
      assert.equal(res.status, 400);
      assert.equal(res.body.redirectTo, undefined, JSON.stringify(over));
    }
  });

  it('goes back to the client with its error once the client and redirect_uri are good', async () => {
    const noPkce = await getRequest(authorizeParams({ code_challenge_method: 'plain' }));
    assert.equal(new URL(noPkce.body.redirectTo).searchParams.get('error'), 'invalid_request');
    const badScope = await getRequest(authorizeParams({ scope: 'admin' }));
    const url = new URL(badScope.body.redirectTo);
    assert.equal(url.searchParams.get('error'), 'invalid_scope');
    assert.equal(url.searchParams.get('state'), 'xyz');
    assert.equal(new URL(((await getRequest(authorizeParams({ resource: 'https://other.example' }))).body.redirectTo)).searchParams.get('error'), 'invalid_target');
  });

  it('remembers what the user approved, and asks again only for more', async () => {
    await decide(authorizeParams());
    assert.equal((await getRequest(authorizeParams(), 'ada')).body.consented, true);
    assert.equal((await getRequest(authorizeParams({ scope: 'streamby:write' }), 'ada')).body.consented, false);
  });
});

describe("the user's answer", () => {
  it('approved: back to the client with a code, its state and the issuer', async () => {
    const res = await decide(authorizeParams());
    const url = new URL(res.body.redirectTo);
    assert.equal(url.origin + url.pathname, STREAMBY_CLIENT.redirect_uris[0]);
    assert.ok(url.searchParams.get('code'));
    assert.equal(url.searchParams.get('state'), 'xyz');
    assert.equal(url.searchParams.get('iss'), ISSUER);
  });

  it('turned down: back with access_denied', async () => {
    const res = await decide(authorizeParams(), false);
    assert.equal(new URL(res.body.redirectTo).searchParams.get('error'), 'access_denied');
    assert.equal(db.codes.size, 0);
  });

  it('only from accounts, and only with a session', async () => {
    assert.equal((await decide(authorizeParams(), true, { origin: 'https://evil.example' })).status, 403);
    assert.equal((await decide(authorizeParams(), true, { user: '' })).status, 401);
    assert.equal(db.codes.size, 0);
  });
});

describe('the token endpoint', () => {
  it('exchanges a code, with PKCE, for an access token checked with the JWKS alone, and a refresh token', async () => {
    const { tokens } = await flow();
    assert.equal(tokens.status, 200);
    assert.equal(tokens.body.token_type, 'Bearer');
    assert.equal(tokens.body.scope, 'profile email streamby:read');
    assert.ok(tokens.body.refresh_token);

    // As a resource server would: the published key only.
    const jwks = (await json(await fetch(`${base}/.well-known/jwks.json`))).body;
    const header = jwt.decode(tokens.body.access_token, { complete: true })!.header;
    const jwk = jwks.keys.find((k: any) => k.kid === header.kid);
    const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    const claims = jwt.verify(tokens.body.access_token, key, { algorithms: ['RS256'], issuer: ISSUER, audience: STREAMBY }) as any;
    assert.equal(claims.sub, 'ada');
    assert.equal(claims.client_id, 'streamby');
    assert.equal(header.alg, 'RS256');
  });

  it('issues a token for the resource asked for, and only that one', async () => {
    const { tokens } = await flow({ resource: `${STREAMBY}/mcp` });
    assert.equal((jwt.decode(tokens.body.access_token) as any).aud, `${STREAMBY}/mcp`);
  });

  it('turns down a wrong code_verifier, a code used twice, and an expired one', async () => {
    const { verifier, challenge } = pkce();
    const params = authorizeParams({}, challenge);
    const code = codeFrom((await decide(params)).body.redirectTo);
    const wrong = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: params.redirect_uri, code_verifier: pkce().verifier }, ['streamby', SECRET]);
    assert.equal(wrong.body.error, 'invalid_grant');
    // Spent by the failed attempt too: a code works once.
    const again = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: params.redirect_uri, code_verifier: verifier }, ['streamby', SECRET]);
    assert.equal(again.body.error, 'invalid_grant');

    const fresh = pkce();
    const later = authorizeParams({}, fresh.challenge);
    const laterCode = codeFrom((await decide(later)).body.redirectTo);
    clock += 11 * 60 * 1000;
    const expired = await tokenRequest({ grant_type: 'authorization_code', code: laterCode, redirect_uri: later.redirect_uri, code_verifier: fresh.verifier }, ['streamby', SECRET]);
    assert.equal(expired.body.error, 'invalid_grant');
    assert.match(expired.body.error_description, /expired/);
  });

  it('a code used again ends the tokens it was exchanged for', async () => {
    const { params, verifier, code, tokens } = await flow();
    assert.equal(tokens.status, 200);
    const again = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: params.redirect_uri, code_verifier: verifier }, ['streamby', SECRET]);
    assert.equal(again.body.error, 'invalid_grant');
    const refreshed = await tokenRequest({ grant_type: 'refresh_token', refresh_token: tokens.body.refresh_token }, ['streamby', SECRET]);
    assert.equal(refreshed.body.error, 'invalid_grant');
    // Another grant of the same user and client is left alone.
    const other = await flow();
    assert.equal((await tokenRequest({ grant_type: 'refresh_token', refresh_token: other.tokens.body.refresh_token }, ['streamby', SECRET])).status, 200);
  });

  it("turns down a confidential client without its secret, and another client's code", async () => {
    const { verifier, challenge } = pkce();
    const params = authorizeParams({}, challenge);
    const code = codeFrom((await decide(params)).body.redirectTo);
    const noSecret = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: params.redirect_uri, code_verifier: verifier, client_id: 'streamby' });
    assert.equal(noSecret.status, 401);
    assert.equal(noSecret.body.error, 'invalid_client');

    db.clients.set('other', { ...STREAMBY_CLIENT, client_id: 'other', client_secret_hash: sha256('other-secret') });
    const stolen = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: params.redirect_uri, code_verifier: verifier }, ['other', 'other-secret']);
    assert.equal(stolen.body.error, 'invalid_grant');
  });

  it('rotates the refresh token; using a rotated one ends the whole grant', async () => {
    const { tokens } = await flow();
    const first = tokens.body.refresh_token;
    const second = await tokenRequest({ grant_type: 'refresh_token', refresh_token: first }, ['streamby', SECRET]);
    assert.equal(second.status, 200);
    assert.notEqual(second.body.refresh_token, first);

    const replayed = await tokenRequest({ grant_type: 'refresh_token', refresh_token: first }, ['streamby', SECRET]);
    assert.equal(replayed.body.error, 'invalid_grant');
    // The token rotated from it is ended too.
    const afterReplay = await tokenRequest({ grant_type: 'refresh_token', refresh_token: second.body.refresh_token }, ['streamby', SECRET]);
    assert.equal(afterReplay.body.error, 'invalid_grant');
  });

  it('a revoked refresh token no longer works', async () => {
    const { tokens } = await flow();
    const revoked = await fetch(`${base}/oauth/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${Buffer.from(`streamby:${SECRET}`).toString('base64')}` },
      body: new URLSearchParams({ token: tokens.body.refresh_token }).toString(),
    });
    assert.equal(revoked.status, 200);
    const refreshed = await tokenRequest({ grant_type: 'refresh_token', refresh_token: tokens.body.refresh_token }, ['streamby', SECRET]);
    assert.equal(refreshed.body.error, 'invalid_grant');
  });

  it('answers OAuth errors for what it does not support', async () => {
    assert.equal((await tokenRequest({ grant_type: 'password' }, ['streamby', SECRET])).body.error, 'unsupported_grant_type');
  });
});

describe('userinfo', () => {
  it("is the user, as the token's scopes let it see them", async () => {
    const { tokens } = await flow({ scope: 'profile' });
    const res = await json(await fetch(`${base}/oauth/userinfo`, { headers: { Authorization: `Bearer ${tokens.body.access_token}` } }));
    assert.deepEqual(res.body, { sub: 'ada', name: 'ada', preferred_username: 'ada', picture: 'https://pic/ada.png', role: 'admin' });
    const noToken = await fetch(`${base}/oauth/userinfo`);
    assert.equal(noToken.status, 401);
  });
});

describe('clients that register by themselves', () => {
  it('dynamic registration (RFC 7591): a public client, then the whole flow with PKCE alone', async () => {
    const reg = await json(await fetch(`${base}/oauth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_name: 'An agent', redirect_uris: ['https://agent.example/callback'], token_endpoint_auth_method: 'none' }),
    }));
    assert.equal(reg.status, 201);
    assert.equal(reg.body.client_secret, undefined);
    const clientId = reg.body.client_id;
    assert.equal((await getRequest(authorizeParams({ client_id: clientId, redirect_uri: 'https://agent.example/callback' }))).body.client.verified, false);

    const { verifier, challenge } = pkce();
    const params = authorizeParams({ client_id: clientId, redirect_uri: 'https://agent.example/callback' }, challenge);
    const code = codeFrom((await decide(params)).body.redirectTo);
    const tokens = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: params.redirect_uri, code_verifier: verifier, client_id: clientId });
    assert.equal(tokens.status, 200);
  });

  it("registration turns down redirect URIs that aren't https (or a local loopback)", async () => {
    for (const uris of [['http://agent.example/cb'], ['https://agent.example/cb#frag'], []]) {
      const res = await json(await fetch(`${base}/oauth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_name: 'x', redirect_uris: uris }),
      }));
      assert.equal(res.status, 400, JSON.stringify(uris));
      assert.equal(res.body.error, 'invalid_redirect_uri');
    }
  });

  it('a confidential one gets its secret, once', async () => {
    const reg = await json(await fetch(`${base}/oauth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_name: 'Service', redirect_uris: ['http://localhost:8080/cb'], token_endpoint_auth_method: 'client_secret_post' }),
    }));
    assert.ok(reg.body.client_secret);
    assert.equal(db.clients.get(reg.body.client_id)!.client_secret_hash, sha256(reg.body.client_secret));
  });

  it('a client_id that is a metadata document URL is used as its document says', async () => {
    const res = await getRequest(authorizeParams({ client_id: metadataClient.client_id, redirect_uri: 'https://claude.example/callback' }));
    assert.equal(res.status, 200);
    assert.equal(res.body.client.name, 'Claude');
  });
});

describe('the metadata', () => {
  it('describes the server (RFC 8414)', async () => {
    const meta = (await json(await fetch(`${base}/.well-known/oauth-authorization-server`))).body;
    assert.equal(meta.issuer, ISSUER);
    assert.equal(meta.authorization_endpoint, `${ACCOUNTS}/oauth/authorize`);
    assert.deepEqual(meta.code_challenge_methods_supported, ['S256']);
    assert.equal(meta.client_id_metadata_document_supported, true);
    assert.equal(meta.registration_endpoint, `${ISSUER}/oauth/register`);
  });
});

describe('how often a client may call', () => {
  // A router of its own, with tiny limits, so the counts are only this suite's.
  const limited = async (behindFly: boolean) => {
    const few = { windowMs: 60 * 1000, limit: 2, behindFly };
    const limitedApp = express();
    limitedApp.use(express.json());
    limitedApp.use(express.urlencoded({ extended: true }));
    limitedApp.use('/oauth', createOAuthRouter(() => current, {
      sessionUserId: async () => null, accountsOrigin: ACCOUNTS,
      rateLimits: { authorizeRequest: few, token: few, register: few },
    }));
    const listening = limitedApp.listen(0);
    await new Promise(resolve => listening.once('listening', resolve));
    return { url: `http://127.0.0.1:${(listening.address() as AddressInfo).port}`, close: () => listening.close() };
  };
  const tokenCall = (url: string, headers: Record<string, string> = {}) =>
    fetch(`${url}/oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...headers }, body: 'grant_type=password' });

  it('past the limit, an OAuth error with when to come back', async () => {
    const { url, close } = await limited(false);
    try {
      for (let i = 0; i < 2; i++) assert.notEqual((await tokenCall(url)).status, 429);
      const over = await tokenCall(url);
      assert.equal(over.status, 429);
      assert.ok(Number(over.headers.get('retry-after')) > 0);
      assert.equal(((await over.json()) as { error: string }).error, 'temporarily_unavailable');

      const request = `${url}/oauth/authorize/request?${new URLSearchParams(authorizeParams())}`;
      for (let i = 0; i < 2; i++) assert.equal((await fetch(request)).status, 200);
      assert.equal((await fetch(request)).status, 429);

      const register = () => fetch(`${url}/oauth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_name: 'X', redirect_uris: ['https://x.example/cb'], token_endpoint_auth_method: 'none' }) });
      for (let i = 0; i < 2; i++) assert.equal((await register()).status, 201);
      assert.equal((await register()).status, 429);
    } finally {
      close();
    }
  });

  it("behind Fly, counts each client by Fly-Client-IP (not the proxy's address)", async () => {
    const { url, close } = await limited(true);
    try {
      for (let i = 0; i < 2; i++) await tokenCall(url, { 'Fly-Client-IP': '203.0.113.7' });
      assert.equal((await tokenCall(url, { 'Fly-Client-IP': '203.0.113.7' })).status, 429);
      assert.notEqual((await tokenCall(url, { 'Fly-Client-IP': '198.51.100.9' })).status, 429);
    } finally {
      close();
    }
  });

  it("anywhere else, a Fly-Client-IP sent by the client doesn't get it a fresh count", async () => {
    const { url, close } = await limited(false);
    try {
      for (let i = 0; i < 2; i++) await tokenCall(url, { 'Fly-Client-IP': `203.0.113.${i}` });
      assert.equal((await tokenCall(url, { 'Fly-Client-IP': '203.0.113.99' })).status, 429);
    } finally {
      close();
    }
  });
});
