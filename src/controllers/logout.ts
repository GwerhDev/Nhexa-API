import { Router, Request, Response } from 'express';
import { production } from '../misc/consts';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  if (process.env.NODE_ENV === production) {
    res.clearCookie('userToken', {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      domain: '.nhexa.cl',
      path: '/',
    });
  } else {
    res.clearCookie('userToken', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
    });
  }

  return res.status(200).json({ loggedOut: true });
});

export default router;
