import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import { supabase } from '../integrations/supabase';
import { clientAccountsUrl, privateSecret } from '../config';
import { createToken } from '../integrations/jwt';
import { production } from '../misc/consts';
import type { GoogleAuthResult, GoogleUserData, UserRecord } from '../types';

const router = Router();

router.get('/', (req: Request, res: Response, next: NextFunction) => {
  const state = (req.query.callback as string) || undefined;
  passport.authenticate('login-google', { state })(req, res, next);
});

router.get('/callback', (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('login-google', async (err: Error | null, user: GoogleAuthResult | false) => {
    if (err || !user) {
      return res.redirect(`${clientAccountsUrl}/login/failed?status=401`);
    }

    const { userData, callback } = user;
    const token = jwt.sign(userData as object, privateSecret, { expiresIn: '5m' });
    const nextUrl = callback ?? clientAccountsUrl;

    return res.redirect(`/login-google/success?token=${token}&next=${encodeURIComponent(nextUrl)}`);
  })(req, res, next);
});

router.get('/success', async (req: Request, res: Response) => {
  try {
    const token = req.query.token as string | undefined;
    const next = (req.query.next as string) || clientAccountsUrl;

    if (!token) {
      return res.redirect(`${clientAccountsUrl}/login/failed?status=403`);
    }

    const userData = jwt.verify(token, privateSecret) as GoogleUserData;

    const { data: userExist, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', userData.email)
      .single<UserRecord>();

    if (error || !userExist) {
      return res.status(400).redirect(`${clientAccountsUrl}/account/not-found`);
    }

    const sessionToken = await createToken({ id: userExist.id, role: userExist.role }, 24);

    if (process.env.NODE_ENV === production) {
      res.cookie('userToken', sessionToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        domain: '.nhexa.cl',
        path: '/',
        maxAge: 24 * 60 * 60 * 1000,
      });
    } else {
      res.cookie('userToken', sessionToken, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
        maxAge: 24 * 60 * 60 * 1000,
      });
    }

    return res.redirect(next);
  } catch {
    return res.status(500).redirect(`${clientAccountsUrl}/login/failed?status=500`);
  }
});

export default router;
