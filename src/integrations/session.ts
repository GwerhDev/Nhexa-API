import cookie from 'cookie';
import type { Request } from 'express';
import { ACCESS_TOKEN_COOKIE } from './cookies';
import { decodeToken } from './jwt';

/** The signed-in user's id, from their session cookie (refreshed first by authMiddleware), or null. */
export const sessionUserId = async (req: Request): Promise<string | null> => {
  const cookies = req.cookies ?? cookie.parse(req.headers.cookie ?? '');
  const token: string | undefined = cookies[ACCESS_TOKEN_COOKIE];
  if (!token) return null;
  try {
    return (await decodeToken(token)).data.id;
  } catch {
    return null;
  }
};
