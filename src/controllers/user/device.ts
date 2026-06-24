import { Router, Request, Response } from 'express';
import { UAParser } from 'ua-parser-js';
import { decodeToken } from '../../integrations/jwt';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '../../integrations/cookies';
import { getUserSessions, revokeDeviceSession, revokeOtherSessions, revokeUserSessions, validateRefreshSession } from '../../integrations/refresh-tokens';
import { message } from '../../messages';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const decoded = await decodeToken(req.cookies[ACCESS_TOKEN_COOKIE]);
    const sessions = await getUserSessions(decoded.data.id);

    // Identify the current session by matching the refresh token
    const currentRefreshToken: string | undefined = req.cookies[REFRESH_TOKEN_COOKIE];
    const currentSession = currentRefreshToken
      ? await validateRefreshSession(currentRefreshToken)
      : null;
    const currentSessionId = currentSession?.id ?? null;

    const enriched = sessions.map(s => {
      const parser = new UAParser(s.user_agent ?? '');
      const browser = parser.getBrowser();
      const os = parser.getOS();
      const device = parser.getDevice();
      return {
        ...s,
        isCurrent: s.id === currentSessionId,
        device: {
          browser: browser.name ?? 'Navegador desconocido',
          os: os.name ?? null,
          type: device.type ?? 'desktop',
        },
      };
    });
    return res.status(200).json({ sessions: enriched });
  } catch {
    return res.status(401).json({ message: message.user.unauthorized });
  }
});

router.delete('/all', async (req: Request, res: Response) => {
  try {
    const decoded = await decodeToken(req.cookies[ACCESS_TOKEN_COOKIE]);
    const refreshToken: string | undefined = req.cookies[REFRESH_TOKEN_COOKIE];
    if (refreshToken) {
      await revokeOtherSessions(decoded.data.id, refreshToken);
    } else {
      await revokeUserSessions(decoded.data.id);
    }
    return res.status(200).json({ success: true });
  } catch {
    return res.status(500).json({ message: message.user.error });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const decoded = await decodeToken(req.cookies[ACCESS_TOKEN_COOKIE]);
    await revokeDeviceSession(req.params.id.toString(), decoded.data.id);
    return res.status(200).json({ success: true });
  } catch {
    return res.status(500).json({ message: message.user.error });
  }
});

export default router;
