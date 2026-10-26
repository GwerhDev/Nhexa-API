import crypto from 'crypto';
import type { OAuthAuthorizeRequest, OAuthClient, OAuthScope, UserRecord } from '../types';
import type { OAuthStore } from './oauthStore';
import type { OAuthSigner } from './oauthKeys';
import { isMetadataClientId } from './oauthClientMetadata';

// Nhexa's OAuth 2 authorization server (the OAuth 2.1 profile): the authorization code grant,
// always with PKCE (S256), and refresh tokens, rotated on every use. Access tokens are JWTs
// for one resource (RFC 8707), signed with Nhexa's private key and checked by resource servers
// with its published public one. What the user sees (login, consent) is accounts.nhexa.cl's.

export const OAUTH_SCOPES: OAuthScope[] = ['profile', 'email', 'streamby:read', 'streamby:write'];

const ACCESS_TOKEN_SECONDS = 60 * 60;
const REFRESH_TOKEN_SECONDS = 30 * 24 * 60 * 60;
const CODE_SECONDS = 10 * 60;
const MAX_REDIRECT_URIS = 10;

/** An OAuth error (RFC 6749 §4.1.2.1 and §5.2): sent back to the client when `redirectable`. */
export class OAuthError extends Error {
  constructor(public error: string, description: string, public status = 400, public redirectable = false) {
    super(description);
  }
}

export interface OAuthServerDeps {
  store: OAuthStore;
  signer: OAuthSigner;
  resolveMetadataClient: (clientId: string) => Promise<OAuthClient>;
  findUser: (id: string) => Promise<UserRecord | null>;
  issuer: string;
  authorizationEndpoint: string;
  // What access tokens can be for (their audience); the first is the default.
  resources: string[];
  now?: () => number;
}

export interface ClientCredentials {
  clientId?: string;
  clientSecret?: string;
}

const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
const randomToken = () => crypto.randomBytes(32).toString('base64url');
const str = (value: unknown): string | undefined => (typeof value === 'string' && value !== '' ? value : undefined);
const sameSecret = (given: string, hash: string) => {
  const a = Buffer.from(sha256(given), 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/** `uri` with these query parameters added (and none of them twice). */
export const withQuery = (uri: string, params: Record<string, string | null | undefined>): string => {
  const url = new URL(uri);
  for (const [key, value] of Object.entries(params)) if (value) url.searchParams.set(key, value);
  return url.toString();
};

// A redirect URI a client may register: https, or plain http to the device itself (a native
// app's loopback, RFC 8252); never a fragment.
const validRedirectUri = (uri: string): boolean => {
  try {
    const url = new URL(uri);
    if (url.hash || url.username || url.password) return false;
    if (url.protocol === 'https:') return true;
    return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch {
    return false;
  }
};

export function createOAuthServer(deps: OAuthServerDeps) {
  const now = () => (deps.now ? deps.now() : Date.now());
  const nowIso = () => new Date(now()).toISOString();
  const inSeconds = (seconds: number) => new Date(now() + seconds * 1000).toISOString();

  async function findClient(clientId: string | undefined): Promise<OAuthClient | null> {
    if (!clientId) return null;
    if (isMetadataClientId(clientId)) {
      try { return await deps.resolveMetadataClient(clientId); } catch { return null; }
    }
    return deps.store.findClient(clientId);
  }

  // The client a token request is from: a confidential one with its secret; a public one by
  // its id alone (its code or refresh token is bound to it, and PKCE proves the rest).
  async function authenticate(credentials: ClientCredentials): Promise<OAuthClient> {
    const client = await findClient(credentials.clientId);
    if (!client) throw new OAuthError('invalid_client', 'Unknown client', 401);
    if (client.type === 'confidential') {
      if (!credentials.clientSecret || !client.client_secret_hash || !sameSecret(credentials.clientSecret, client.client_secret_hash)) {
        throw new OAuthError('invalid_client', 'Client authentication failed', 401);
      }
    }
    return client;
  }

  function scopesOf(requested: string | undefined, allowed: OAuthScope[]): OAuthScope[] {
    if (!requested) return allowed;
    const scopes = [...new Set(requested.split(' ').filter(Boolean))];
    if (!scopes.every(s => (allowed as string[]).includes(s))) throw new OAuthError('invalid_scope', 'A scope asked for is not allowed for this client', 400, true);
    return scopes as OAuthScope[];
  }

  function resourceOf(requested: string | undefined): string {
    if (!requested) return deps.resources[0];
    if (!deps.resources.includes(requested)) throw new OAuthError('invalid_target', 'Unknown resource', 400, true);
    return requested;
  }

  /**
   * An authorization request, checked. Until the client and its redirect URI are known good,
   * an error can't go back to it (it's shown instead); after, it can.
   */
  async function checkAuthorize(params: Record<string, unknown>): Promise<OAuthAuthorizeRequest> {
    const client = await findClient(str(params.client_id));
    if (!client) throw new OAuthError('invalid_client', 'Unknown client');
    const redirectUri = str(params.redirect_uri);
    if (!redirectUri || !client.redirect_uris.includes(redirectUri)) {
      throw new OAuthError('invalid_request', 'redirect_uri is not one the client registered');
    }
    if (params.response_type !== 'code') throw new OAuthError('unsupported_response_type', "response_type must be 'code'", 400, true);
    const codeChallenge = str(params.code_challenge);
    if (!codeChallenge || params.code_challenge_method !== 'S256' || !/^[A-Za-z0-9_-]{43}$/.test(codeChallenge)) {
      throw new OAuthError('invalid_request', 'PKCE is required: code_challenge with code_challenge_method S256', 400, true);
    }
    return {
      client,
      redirectUri,
      scopes: scopesOf(str(params.scope), client.scopes),
      state: str(params.state) ?? null,
      resource: resourceOf(str(params.resource)),
      codeChallenge,
    };
  }

  /** Where an error goes back to: the client's redirect URI, if it's known good. */
  async function errorRedirect(params: Record<string, unknown>, err: OAuthError): Promise<string | null> {
    if (!err.redirectable) return null;
    return withQuery(String(params.redirect_uri), {
      error: err.error, error_description: err.message, state: str(params.state), iss: deps.issuer,
    });
  }

  /** Whether the user already approved every scope asked for, for this client. */
  async function hasConsent(userId: string, request: OAuthAuthorizeRequest): Promise<boolean> {
    const consent = await deps.store.findConsent(userId, request.client.client_id);
    return !!consent && request.scopes.every(s => consent.scopes.includes(s));
  }

  /** The user's answer: where to send them back, with a code, or with access_denied. */
  async function decide(userId: string, request: OAuthAuthorizeRequest, approved: boolean): Promise<string> {
    if (!approved) {
      return withQuery(request.redirectUri, { error: 'access_denied', state: request.state, iss: deps.issuer });
    }
    const previous = await deps.store.findConsent(userId, request.client.client_id);
    await deps.store.saveConsent({
      user_id: userId, client_id: request.client.client_id,
      scopes: [...new Set([...(previous?.scopes ?? []), ...request.scopes])],
    });
    const code = randomToken();
    await deps.store.createCode({
      code_hash: sha256(code), client_id: request.client.client_id, user_id: userId, redirect_uri: request.redirectUri,
      scopes: request.scopes, resource: request.resource, code_challenge: request.codeChallenge,
      code_challenge_method: 'S256', expires_at: inSeconds(CODE_SECONDS),
    });
    return withQuery(request.redirectUri, { code, state: request.state, iss: deps.issuer });
  }

  async function issueTokens(clientId: string, userId: string, scopes: OAuthScope[], resource: string, familyId: string) {
    const issuedAt = Math.floor(now() / 1000);
    const accessToken = deps.signer.sign({
      sub: userId, aud: resource, client_id: clientId, scope: scopes.join(' '),
      jti: crypto.randomUUID(), iat: issuedAt, exp: issuedAt + ACCESS_TOKEN_SECONDS,
    });
    const refreshToken = randomToken();
    await deps.store.createRefreshToken({
      token_hash: sha256(refreshToken), family_id: familyId, client_id: clientId, user_id: userId,
      scopes, resource, expires_at: inSeconds(REFRESH_TOKEN_SECONDS),
    });
    return {
      access_token: accessToken, token_type: 'Bearer', expires_in: ACCESS_TOKEN_SECONDS,
      refresh_token: refreshToken, scope: scopes.join(' '),
    };
  }

  const pkceMatches = (verifier: string, challenge: string) =>
    /^[A-Za-z0-9._~-]{43,128}$/.test(verifier) && crypto.createHash('sha256').update(verifier).digest('base64url') === challenge;

  async function token(body: Record<string, unknown>, credentials: ClientCredentials) {
    const client = await authenticate(credentials);

    if (body.grant_type === 'authorization_code') {
      const code = str(body.code);
      const verifier = str(body.code_verifier);
      if (!code || !verifier || !str(body.redirect_uri)) throw new OAuthError('invalid_request', 'code, redirect_uri and code_verifier are required');
      // Spent now, whatever comes next: a code works once.
      const record = await deps.store.useCode(sha256(code));
      if (!record) throw new OAuthError('invalid_grant', 'The code is invalid or was already used');
      if (record.client_id !== client.client_id || record.redirect_uri !== body.redirect_uri) {
        throw new OAuthError('invalid_grant', 'The code was issued to another client or redirect_uri');
      }
      if (new Date(record.expires_at).getTime() <= now()) throw new OAuthError('invalid_grant', 'The code has expired');
      if (!pkceMatches(verifier, record.code_challenge)) throw new OAuthError('invalid_grant', 'code_verifier does not match the code_challenge');
      if (str(body.resource) && body.resource !== record.resource) throw new OAuthError('invalid_target', 'The code was issued for another resource');
      if (!(await deps.findUser(record.user_id))) throw new OAuthError('invalid_grant', 'The user no longer exists');
      return issueTokens(client.client_id, record.user_id, record.scopes, record.resource, crypto.randomUUID());
    }

    if (body.grant_type === 'refresh_token') {
      const refreshToken = str(body.refresh_token);
      if (!refreshToken) throw new OAuthError('invalid_request', 'refresh_token is required');
      const hash = sha256(refreshToken);
      const record = await deps.store.findRefreshToken(hash);
      if (!record || record.client_id !== client.client_id || record.revoked_at) throw new OAuthError('invalid_grant', 'The refresh token is invalid');
      if (new Date(record.expires_at).getTime() <= now()) throw new OAuthError('invalid_grant', 'The refresh token has expired');
      // A refresh token works once: one used again (stolen, or replayed) ends its whole family.
      const rotated = record.rotated_at ? null : await deps.store.rotateRefreshToken(hash);
      if (!rotated) {
        await deps.store.revokeFamily(record.family_id);
        throw new OAuthError('invalid_grant', 'The refresh token was already used');
      }
      const scopes = str(body.scope) ? scopesOf(str(body.scope), record.scopes) : record.scopes;
      if (str(body.resource) && body.resource !== record.resource) throw new OAuthError('invalid_target', 'The refresh token is for another resource');
      if (!(await deps.findUser(record.user_id))) {
        await deps.store.revokeFamily(record.family_id);
        throw new OAuthError('invalid_grant', 'The user no longer exists');
      }
      return issueTokens(client.client_id, record.user_id, scopes, record.resource, record.family_id);
    }

    throw new OAuthError('unsupported_grant_type', "grant_type must be 'authorization_code' or 'refresh_token'");
  }

  /** The user an access token is for, as its scopes let it see them (profile, email). */
  async function userinfo(accessToken: string) {
    let claims;
    try { claims = deps.signer.verify(accessToken); } catch { throw new OAuthError('invalid_token', 'The access token is invalid', 401); }
    const scopes = claims.scope.split(' ');
    const user = await deps.findUser(claims.sub);
    if (!user) throw new OAuthError('invalid_token', 'The user no longer exists', 401);
    return {
      sub: user.id,
      ...(scopes.includes('profile') ? { name: user.username, preferred_username: user.username, picture: user.profilePic ?? user.googlePic ?? null, role: user.role } : {}),
      ...(scopes.includes('email') ? { email: user.email, email_verified: !!user.isVerified } : {}),
    };
  }

  /** Revokes a refresh token (and every one rotated from the same grant). Always succeeds (RFC 7009). */
  async function revoke(tokenValue: string | undefined, credentials: ClientCredentials): Promise<void> {
    const client = await authenticate(credentials);
    if (!tokenValue) throw new OAuthError('invalid_request', 'token is required');
    const record = await deps.store.findRefreshToken(sha256(tokenValue));
    if (record && record.client_id === client.client_id) await deps.store.revokeFamily(record.family_id);
  }

  /** Dynamic client registration (RFC 7591): what's registered, with its secret if it has one. */
  async function register(body: Record<string, unknown>) {
    const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris : [];
    if (!redirectUris.length || redirectUris.length > MAX_REDIRECT_URIS || !redirectUris.every(u => typeof u === 'string' && validRedirectUri(u))) {
      throw new OAuthError('invalid_redirect_uri', 'redirect_uris must be https URLs (or http to localhost), without fragments');
    }
    const method = body.token_endpoint_auth_method ?? 'none';
    if (!['none', 'client_secret_basic', 'client_secret_post'].includes(String(method))) {
      throw new OAuthError('invalid_client_metadata', "token_endpoint_auth_method must be 'none', 'client_secret_basic' or 'client_secret_post'");
    }
    const grantTypes = Array.isArray(body.grant_types) ? body.grant_types : ['authorization_code'];
    if (!grantTypes.every(g => g === 'authorization_code' || g === 'refresh_token')) throw new OAuthError('invalid_client_metadata', 'Only the authorization_code and refresh_token grants are supported');
    const responseTypes = Array.isArray(body.response_types) ? body.response_types : ['code'];
    if (!responseTypes.every(r => r === 'code')) throw new OAuthError('invalid_client_metadata', "Only the 'code' response type is supported");
    let scopes: OAuthScope[];
    try { scopes = scopesOf(str(body.scope), OAUTH_SCOPES); } catch { throw new OAuthError('invalid_client_metadata', 'A scope asked for is not supported'); }
    const name = str(body.client_name)?.trim().slice(0, 100);
    if (!name) throw new OAuthError('invalid_client_metadata', 'client_name is required');
    const httpsOrNull = (value: unknown) => (typeof value === 'string' && value.startsWith('https://') ? value : null);

    const confidential = method !== 'none';
    const clientId = `dyn_${crypto.randomBytes(16).toString('hex')}`;
    const secret = confidential ? randomToken() : null;
    await deps.store.createClient({
      client_id: clientId, client_secret_hash: secret ? sha256(secret) : null, type: confidential ? 'confidential' : 'public',
      name, logo_uri: httpsOrNull(body.logo_uri), client_uri: httpsOrNull(body.client_uri),
      redirect_uris: redirectUris as string[], scopes, registration: 'dynamic',
    });
    return {
      client_id: clientId,
      ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
      client_id_issued_at: Math.floor(now() / 1000),
      client_name: name,
      redirect_uris: redirectUris,
      token_endpoint_auth_method: method,
      grant_types: grantTypes,
      response_types: responseTypes,
      scope: scopes.join(' '),
    };
  }

  /** Authorization server metadata (RFC 8414). */
  const metadata = () => ({
    issuer: deps.issuer,
    authorization_endpoint: deps.authorizationEndpoint,
    token_endpoint: `${deps.issuer}/oauth/token`,
    registration_endpoint: `${deps.issuer}/oauth/register`,
    revocation_endpoint: `${deps.issuer}/oauth/revoke`,
    userinfo_endpoint: `${deps.issuer}/oauth/userinfo`,
    jwks_uri: `${deps.issuer}/.well-known/jwks.json`,
    scopes_supported: OAUTH_SCOPES,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_basic', 'client_secret_post'],
    revocation_endpoint_auth_methods_supported: ['none', 'client_secret_basic', 'client_secret_post'],
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
  });

  return { checkAuthorize, errorRedirect, hasConsent, decide, token, userinfo, revoke, register, metadata, jwks: () => deps.signer.jwks() };
}

export type OAuthServer = ReturnType<typeof createOAuthServer>;
