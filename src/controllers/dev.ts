import { Router, Request, Response } from 'express';
import { supabase } from '../integrations/supabase';
import { createToken } from '../integrations/jwt';
import { setAccessTokenCookie, setRefreshTokenCookie } from '../integrations/cookies';
import { createRefreshSession, generateRefreshToken } from '../integrations/refresh-tokens';
import type { AccountResponse, UserRecord } from '../types';

const router = Router();

router.post('/account', async (req: Request, res: Response) => {
  const { id } = req.body as { id?: string };
  if (!id) return res.status(400).json({ message: 'id required' });

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single<UserRecord>();

  if (error || !user) return res.status(404).json({ logged: false });

  const accessToken = await createToken({ id: user.id, role: user.role }, 15 / 60);
  const refreshToken = generateRefreshToken();

  await createRefreshSession(user.id, user.role, refreshToken, {
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  });

  setAccessTokenCookie(res, accessToken);
  setRefreshTokenCookie(res, refreshToken);

  const userData: AccountResponse = {
    id: user.id,
    username: user.username,
    email: user.email,
    isVerified: user.isVerified,
    role: user.role,
    profilePic: user.profilePic ?? user.googlePic ?? null,
  };

  return res.status(200).json({ logged: true, userData });
});

export default router;
