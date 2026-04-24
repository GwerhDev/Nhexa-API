import { Router, Request, Response } from 'express';
import { clearAuthCookies, ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '../integrations/cookies';
import { consumeRefreshSession, revokeUserSessions } from '../integrations/refresh-tokens';
import { decodeToken } from '../integrations/jwt';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const refreshToken: string | undefined = req.cookies[REFRESH_TOKEN_COOKIE];
    const accessToken: string | undefined = req.cookies[ACCESS_TOKEN_COOKIE];

    if (refreshToken) {
      // Consume without rotation to revoke the refresh session
      const session = await consumeRefreshSession(refreshToken);
      if (session) {
        await revokeUserSessions(session.user_id);
      }
    } else if (accessToken) {
      // Fallback: revoke all sessions for the user identified by the access token
      try {
        const decoded = await decodeToken(accessToken);
        await revokeUserSessions(decoded.data.id);
      } catch {
        // Access token invalid — clear cookies anyway
      }
    }
  } catch {
    // Best-effort revocation; always clear cookies
  }

  clearAuthCookies(res);
  return res.status(200).json({ loggedOut: true });
});

export default router;
