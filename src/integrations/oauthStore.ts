import type { SupabaseClient } from '@supabase/supabase-js';
import type { OAuthClient, OAuthCode, OAuthConsent, OAuthRefreshToken } from '../types';

// Where the OAuth server keeps its records (sql/2026-10-26-oauth.sql). Marking a code used and
// rotating a refresh token are single conditional updates: of two requests with the same one,
// only one gets it.

export interface OAuthStore {
  findClient(clientId: string): Promise<OAuthClient | null>;
  createClient(client: Omit<OAuthClient, 'registration'> & { registration: 'manual' | 'dynamic' }): Promise<void>;

  createCode(code: Omit<OAuthCode, 'used_at'>): Promise<void>;
  /** The code, marked used now; null if it doesn't exist or was used already. */
  useCode(codeHash: string): Promise<OAuthCode | null>;
  findCode(codeHash: string): Promise<OAuthCode | null>;

  createRefreshToken(token: Omit<OAuthRefreshToken, 'rotated_at' | 'revoked_at'>): Promise<void>;
  findRefreshToken(tokenHash: string): Promise<OAuthRefreshToken | null>;
  /** The token, marked rotated now; null if it was rotated or revoked already. */
  rotateRefreshToken(tokenHash: string): Promise<OAuthRefreshToken | null>;
  revokeRefreshToken(tokenHash: string): Promise<void>;
  revokeFamily(familyId: string): Promise<void>;

  /** Revokes every refresh token the user's app holds (all its grants). */
  revokeClientTokens(userId: string, clientId: string): Promise<void>;

  findConsent(userId: string, clientId: string): Promise<OAuthConsent | null>;
  /** The user's consents, the latest approved first. */
  listConsents(userId: string): Promise<OAuthConsent[]>;
  saveConsent(consent: OAuthConsent): Promise<void>;
  deleteConsent(userId: string, clientId: string): Promise<void>;
  /** Marks when the app last used the user's consent. */
  touchConsent(userId: string, clientId: string): Promise<void>;
}

const fail = (what: string, error: { message: string } | null) => {
  if (error) throw new Error(`oauth store: ${what}: ${error.message}`);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the schema the client is for doesn't matter here
export const createSupabaseOAuthStore = (db: SupabaseClient<any, any, any>): OAuthStore => ({
  async findClient(clientId) {
    const { data, error } = await db.from('oauth_clients').select('*').eq('client_id', clientId).maybeSingle();
    fail('findClient', error);
    return (data as OAuthClient | null) ?? null;
  },
  async createClient(client) {
    const { error } = await db.from('oauth_clients').insert(client);
    fail('createClient', error);
  },

  async createCode(code) {
    const { error } = await db.from('oauth_codes').insert(code);
    fail('createCode', error);
  },
  async useCode(codeHash) {
    const { data, error } = await db.from('oauth_codes').update({ used_at: new Date().toISOString() })
      .eq('code_hash', codeHash).is('used_at', null).select();
    fail('useCode', error);
    return (data?.[0] as OAuthCode | undefined) ?? null;
  },
  async findCode(codeHash) {
    const { data, error } = await db.from('oauth_codes').select('*').eq('code_hash', codeHash).maybeSingle();
    fail('findCode', error);
    return (data as OAuthCode | null) ?? null;
  },

  async createRefreshToken(token) {
    const { error } = await db.from('oauth_tokens').insert(token);
    fail('createRefreshToken', error);
  },
  async findRefreshToken(tokenHash) {
    const { data, error } = await db.from('oauth_tokens').select('*').eq('token_hash', tokenHash).maybeSingle();
    fail('findRefreshToken', error);
    return (data as OAuthRefreshToken | null) ?? null;
  },
  async rotateRefreshToken(tokenHash) {
    const { data, error } = await db.from('oauth_tokens').update({ rotated_at: new Date().toISOString() })
      .eq('token_hash', tokenHash).is('rotated_at', null).is('revoked_at', null).select();
    fail('rotateRefreshToken', error);
    return (data?.[0] as OAuthRefreshToken | undefined) ?? null;
  },
  async revokeRefreshToken(tokenHash) {
    const { error } = await db.from('oauth_tokens').update({ revoked_at: new Date().toISOString() })
      .eq('token_hash', tokenHash).is('revoked_at', null);
    fail('revokeRefreshToken', error);
  },
  async revokeFamily(familyId) {
    const { error } = await db.from('oauth_tokens').update({ revoked_at: new Date().toISOString() })
      .eq('family_id', familyId).is('revoked_at', null);
    fail('revokeFamily', error);
  },

  async revokeClientTokens(userId, clientId) {
    const { error } = await db.from('oauth_tokens').update({ revoked_at: new Date().toISOString() })
      .eq('user_id', userId).eq('client_id', clientId).is('revoked_at', null);
    fail('revokeClientTokens', error);
  },

  async findConsent(userId, clientId) {
    const { data, error } = await db.from('oauth_consents').select('*').eq('user_id', userId).eq('client_id', clientId).maybeSingle();
    fail('findConsent', error);
    return (data as OAuthConsent | null) ?? null;
  },
  async listConsents(userId) {
    const { data, error } = await db.from('oauth_consents').select('*').eq('user_id', userId).order('updated_at', { ascending: false });
    fail('listConsents', error);
    return (data as OAuthConsent[] | null) ?? [];
  },
  async saveConsent(consent) {
    const { error } = await db.from('oauth_consents').upsert({ ...consent, updated_at: new Date().toISOString() });
    fail('saveConsent', error);
  },
  async deleteConsent(userId, clientId) {
    const { error } = await db.from('oauth_consents').delete().eq('user_id', userId).eq('client_id', clientId);
    fail('deleteConsent', error);
  },
  async touchConsent(userId, clientId) {
    const { error } = await db.from('oauth_consents').update({ last_used_at: new Date().toISOString() })
      .eq('user_id', userId).eq('client_id', clientId);
    fail('touchConsent', error);
  },
});
