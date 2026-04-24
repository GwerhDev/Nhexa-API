import { Router, Request, Response } from 'express';
import { createToken } from '../integrations/jwt';
import { consumeRefreshSession, createRefreshSession, generateRefreshToken } from '../integrations/refresh-tokens';
import { setAccessTokenCookie, setRefreshTokenCookie, REFRESH_TOKEN_COOKIE } from '../integrations/cookies';
import { message } from '../messages';
import type { SessionStatus } from '../types';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const token: string | undefined = req.cookies[REFRESH_TOKEN_COOKIE];

    if (!token) {
      return res.status(401).json({ loggedIn: false, message: message.session.expired });
    }

    const session = await consumeRefreshSession(token);

    if (!session) {
      return res.status(401).json({ loggedIn: false, message: message.session.expired });
    }

    const accessToken = await createToken(
      { id: session.user_id, role: session.user_role },
      15 / 60
    );

    const newRefreshToken = generateRefreshToken();
    await createRefreshSession(session.user_id, session.user_role, newRefreshToken, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    setAccessTokenCookie(res, accessToken);
    setRefreshTokenCookie(res, newRefreshToken);

    return res.status(200).json({ loggedIn: true } satisfies SessionStatus);
  } catch {
    return res.status(500).json({ loggedIn: false, message: message.session.error });
  }
});

export default router;
