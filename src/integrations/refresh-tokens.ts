import crypto from 'crypto';
import { supabase } from './supabase';
import { REFRESH_TOKEN_TTL_MS } from './cookies';
import type { RefreshSession, UserRole } from '../types';

export const generateRefreshToken = (): string =>
  crypto.randomBytes(64).toString('hex');

const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

export const createRefreshSession = async (
  userId: string,
  userRole: UserRole,
  token: string,
  meta?: { userAgent?: string; ip?: string }
): Promise<void> => {
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS).toISOString();
  const { error } = await supabase.from('refresh_sessions').insert([{
    user_id: userId,
    user_role: userRole,
    token_hash: hashToken(token),
    expires_at: expiresAt,
    user_agent: meta?.userAgent ?? null,
    ip: meta?.ip ?? null,
  }]);
  if (error) throw error;
};

export const consumeRefreshSession = async (
  token: string
): Promise<RefreshSession | null> => {
  const hash = hashToken(token);

  const { data: session, error } = await supabase
    .from('refresh_sessions')
    .select('*')
    .eq('token_hash', hash)
    .single<RefreshSession>();

  if (error || !session) return null;

  // Reuse detection: token already revoked → revoke all sessions for this user
  if (session.revoked_at) {
    await supabase
      .from('refresh_sessions')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', session.user_id)
      .is('revoked_at', null);
    return null;
  }

  if (new Date(session.expires_at) < new Date()) return null;

  // Consume: revoke this session (caller will issue a new one)
  const { error: revokeError } = await supabase
    .from('refresh_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', session.id);

  if (revokeError) throw revokeError;

  return session;
};

export const revokeUserSessions = async (userId: string): Promise<void> => {
  await supabase
    .from('refresh_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('revoked_at', null);
};
