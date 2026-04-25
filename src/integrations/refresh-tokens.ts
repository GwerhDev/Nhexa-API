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

export const validateRefreshSession = async (
  token: string
): Promise<RefreshSession | null> => {
  const hash = hashToken(token);

  const { data: session, error } = await supabase
    .from('refresh_sessions')
    .select('*')
    .eq('token_hash', hash)
    .single<RefreshSession>();

  if (error || !session) return null;
  if (session.revoked_at) return null;
  if (new Date(session.expires_at) < new Date()) return null;

  return session;
};

export const revokeSession = async (sessionId: string): Promise<void> => {
  await supabase
    .from('refresh_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', sessionId);
};

export const revokeUserSessions = async (userId: string): Promise<void> => {
  await supabase
    .from('refresh_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('revoked_at', null);
};

export const getUserSessions = async (userId: string): Promise<import('../types').DeviceSession[]> => {
  const { data } = await supabase
    .from('refresh_sessions')
    .select('id, user_id, created_at, expires_at, user_agent, ip')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  return data ?? [];
};

export const revokeDeviceSession = async (sessionId: string, userId: string): Promise<void> => {
  await supabase
    .from('refresh_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('user_id', userId);
};

export const revokeOtherSessions = async (userId: string, currentRefreshToken: string): Promise<void> => {
  const currentHash = hashToken(currentRefreshToken);
  await supabase
    .from('refresh_sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('revoked_at', null)
    .neq('token_hash', currentHash);
};
