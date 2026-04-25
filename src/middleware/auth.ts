import cookie from 'cookie';
import { NextFunction, Request, Response } from 'express';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, setAccessTokenCookie, setRefreshTokenCookie } from '../integrations/cookies';
import { createToken, decodeToken } from '../integrations/jwt';
import { consumeRefreshSession, createRefreshSession, generateRefreshToken } from '../integrations/refresh-tokens';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const cookies = (req as any).cookies ?? cookie.parse(req.headers.cookie ?? '');
  const accessToken: string = cookies[ACCESS_TOKEN_COOKIE] ?? req.headers.authorization?.split(' ')?.[1] ?? '';

  if (accessToken) {
    try {
      await decodeToken(accessToken);
      return next();
    } catch {
      // access token expired — attempt refresh below
    }
  }

  const refreshToken: string = cookies[REFRESH_TOKEN_COOKIE] ?? '';
  if (!refreshToken) return next();

  try {
    const session = await consumeRefreshSession(refreshToken);
    if (!session) return next();

    const newAccessToken = await createToken({ id: session.user_id, role: session.user_role }, 15 / 60);
    const newRefreshToken = generateRefreshToken();

    setAccessTokenCookie(res, newAccessToken);
    setRefreshTokenCookie(res, newRefreshToken);

    createRefreshSession(session.user_id, session.user_role, newRefreshToken, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    }).catch((err) => console.error('[authMiddleware] createRefreshSession failed:', err));

    if ((req as any).cookies) {
      (req as any).cookies[ACCESS_TOKEN_COOKIE] = newAccessToken;
      (req as any).cookies[REFRESH_TOKEN_COOKIE] = newRefreshToken;
    }
  } catch {
    // refresh failed — downstream handler will reject
  }

  next();
};
