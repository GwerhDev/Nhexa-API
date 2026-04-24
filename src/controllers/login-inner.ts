import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { createToken } from '../integrations/jwt';
import { message } from '../messages';
import { supabase } from '../integrations/supabase';
import { validate } from '../middleware/validate';
import { LoginInnerSchema, type LoginInnerInput } from '../schemas/auth';
import { setAccessTokenCookie, setRefreshTokenCookie } from '../integrations/cookies';
import { createRefreshSession, generateRefreshToken } from '../integrations/refresh-tokens';
import type { UserRecord } from '../types';

const router = Router();

router.post('/', validate(LoginInnerSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as LoginInnerInput;
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single<UserRecord>();

    if (error || !user) {
      return res.status(400).send({ logged: false, message: message.login.failure });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(400).send({ logged: false, message: message.login.error });
    }

    if (!user.isVerified) {
      return res.status(403).send({ logged: false, verified: false, message: message.login.unverified });
    }

    const accessToken = await createToken({ id: user.id, role: user.role }, 15 / 60);
    const refreshToken = generateRefreshToken();

    await createRefreshSession(user.id, user.role, refreshToken, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    setAccessTokenCookie(res, accessToken);
    setRefreshTokenCookie(res, refreshToken);

    return res.status(200).send({ logged: true, message: message.login.success });
  } catch {
    return res.status(400).send({ logged: false, message: message.login.error });
  }
});

export default router;
