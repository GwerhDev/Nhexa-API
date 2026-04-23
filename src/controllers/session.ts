import { Router, Request, Response } from 'express';
import type { SessionStatus } from '../types';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const userToken =
    req.cookies['userToken'] ?? req.headers.authorization?.split(' ')[1];

  if (!userToken) {
    return res.status(401).json({ loggedIn: false } satisfies SessionStatus);
  }

  return res.status(200).json({ loggedIn: true, userToken } satisfies SessionStatus);
});

export default router;
