import { Router, Request, Response } from 'express';
import { decodeToken } from '../integrations/jwt';
import { ACCESS_TOKEN_COOKIE } from '../integrations/cookies';
import type { SessionStatus } from '../types';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const token: string | undefined =
    req.cookies[ACCESS_TOKEN_COOKIE] ?? req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ loggedIn: false } satisfies SessionStatus);
  }

  try {
    await decodeToken(token);
    return res.status(200).json({ loggedIn: true } satisfies SessionStatus);
  } catch {
    return res.status(401).json({ loggedIn: false } satisfies SessionStatus);
  }
});

// Used by the OAuth relay flow (ChooseAccount) to pass the token to third-party apps
router.get('/token', async (req: Request, res: Response) => {
  const token = req.cookies[ACCESS_TOKEN_COOKIE];
  if (!token) return res.status(401).json({ token: null });
  try {
    await decodeToken(token);
    return res.status(200).json({ token });
  } catch {
    return res.status(401).json({ token: null });
  }
});

export default router;
