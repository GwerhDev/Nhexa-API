import cookie from 'cookie';
import { NextFunction, Request, Response } from 'express';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, setAccessTokenCookie, setRefreshTokenCookie } from '../integrations/cookies';
import { createToken, decodeToken } from '../integrations/jwt';
import { createRefreshSession, generateRefreshToken, revokeSession, validateRefreshSession } from '../integrations/refresh-tokens';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const cookies = (req as any).cookies ?? cookie.parse(req.headers.cookie ?? '');
  const accessToken: string = cookies[ACCESS_TOKEN_COOKIE] ?? req.headers.authorization?.split(' ')?.[1] ?? '';

  if (accessToken) {
    try {
      await decodeToken(accessToken);
      return next();
    } catch {
      // expired or invalid — fall through to refresh
    }
  }

  const refreshToken: string = cookies[REFRESH_TOKEN_COOKIE] ?? '';
  if (!refreshToken) return next();

  try {
    const session = await validateRefreshSession(refreshToken);
    if (!session) return next();

    const newAccessToken = await createToken({ id: session.user_id, role: session.user_role }, 15 / 60);
    const newRefreshToken = generateRefreshToken();

    await createRefreshSession(session.user_id, session.user_role, newRefreshToken, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    setAccessTokenCookie(res, newAccessToken);
    setRefreshTokenCookie(res, newRefreshToken);

    if ((req as any).cookies) {
      (req as any).cookies[ACCESS_TOKEN_COOKIE] = newAccessToken;
      (req as any).cookies[REFRESH_TOKEN_COOKIE] = newRefreshToken;
    }

    revokeSession(session.id).catch((err) => console.error('[authMiddleware] revokeSession failed:', err));
  } catch (err) {
    console.error('[authMiddleware] refresh failed:', err);
  }

  next();
};
