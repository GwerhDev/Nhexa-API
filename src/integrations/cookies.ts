import { Response } from 'express';
import { production } from '../misc/consts';

export const ACCESS_TOKEN_COOKIE = 'accessToken';
export const REFRESH_TOKEN_COOKIE = 'refreshToken';

export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const isProduction = () => process.env.NODE_ENV === production;

const cookieOptions = (maxAge: number) => ({
  httpOnly: true as const,
  secure: isProduction(),
  sameSite: (isProduction() ? 'none' : 'lax') as 'none' | 'lax',
  ...(isProduction() ? { domain: '.nhexa.cl' } : {}),
  path: '/',
  maxAge,
});

export const setAccessTokenCookie = (res: Response, token: string): void => {
  res.cookie(ACCESS_TOKEN_COOKIE, token, cookieOptions(ACCESS_TOKEN_TTL_MS));
};

export const setRefreshTokenCookie = (res: Response, token: string): void => {
  res.cookie(REFRESH_TOKEN_COOKIE, token, cookieOptions(REFRESH_TOKEN_TTL_MS));
};

export const clearAuthCookies = (res: Response): void => {
  const clearOpts = {
    httpOnly: true as const,
    secure: isProduction(),
    sameSite: (isProduction() ? 'none' : 'lax') as 'none' | 'lax',
    ...(isProduction() ? { domain: '.nhexa.cl' } : {}),
    path: '/',
  };
  res.clearCookie(ACCESS_TOKEN_COOKIE, clearOpts);
  res.clearCookie(REFRESH_TOKEN_COOKIE, clearOpts);
};
