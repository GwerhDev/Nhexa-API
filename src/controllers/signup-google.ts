import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import { supabase } from '../integrations/supabase';
import { clientAccountsUrl, defaultPassword, defaultUsername, adminEmailList, privateSecret } from '../config';
import { methods, roles } from '../misc/consts-user-model';
import { createToken } from '../integrations/jwt';
import type { GoogleAuthResult, GoogleUserData, UserRecord } from '../types';

const router = Router();

router.get('/', (req: Request, res: Response, next: NextFunction) => {
  const state = (req.query.callback as string) || undefined;
  passport.authenticate('signup-google', { state })(req, res, next);
});

router.get('/callback', (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('signup-google', async (err: Error | null, user: GoogleAuthResult | false) => {
    if (err || !user) {
      return res.redirect(`${clientAccountsUrl}/register/failed`);
    }

    const { userData, callback } = user;
    const token = jwt.sign({ userData, callback }, privateSecret, { expiresIn: '5m' });

    return res.redirect(`/signup-google/success?token=${token}`);
  })(req, res, next);
});

router.get('/success', async (req: Request, res: Response) => {
  try {
    const { token } = req.query as { token?: string };
    if (!token) return res.redirect(`${clientAccountsUrl}/register/failed`);

    const { userData } = jwt.verify(token, privateSecret) as { userData: GoogleUserData; callback: string | null };

    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', userData.email)
      .single<UserRecord>();

    if (existingUser) return res.redirect(`${clientAccountsUrl}/account/already-exists`);

    const userDataToCreate: Partial<UserRecord> & Record<string, unknown> = {
      username: userData.username ?? defaultUsername,
      password: defaultPassword,
      email: userData.email,
      profilePic: null,
      isVerified: true,
      method: methods.google,
      googleId: userData.googleId,
      googlePic: userData.photo ?? null,
      role: roles.user,
    };

    if (adminEmailList?.includes(userData.email)) {
      userDataToCreate.role = roles.admin;
    }

    const { error: createError } = await supabase.from('users').insert([userDataToCreate]);

    if (createError) throw createError;

    return res.redirect(`${clientAccountsUrl}/register/success`);
  } catch (error) {
    console.error('Error en signup-google:', error);
    return res.status(500).redirect(`${clientAccountsUrl}/register/failed?status=500`);
  }
});

router.get('/failure', (_req: Request, res: Response) => {
  return res.status(500).redirect(`${clientAccountsUrl}/register/failed?status=500`);
});

export default router;
