import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { createToken, createMfaToken, decodeMfaToken } from '../integrations/jwt';
import { message } from '../messages';
import { supabase } from '../integrations/supabase';
import { validate } from '../middleware/validate';
import { LoginInnerSchema, type LoginInnerInput } from '../schemas/auth';
import { setAccessTokenCookie, setRefreshTokenCookie } from '../integrations/cookies';
import { createRefreshSession, generateRefreshToken } from '../integrations/refresh-tokens';
import { verifyTOTP, decryptSecret, hashBackupCode } from '../integrations/totp';
import type { UserRecord } from '../types';

const router = Router();

const issueSession = async (res: Response, req: Request, user: UserRecord) => {
  const accessToken = await createToken({ id: user.id, role: user.role }, 15 / 60);
  const refreshToken = generateRefreshToken();
  setAccessTokenCookie(res, accessToken);
  setRefreshTokenCookie(res, refreshToken);
  createRefreshSession(user.id, user.role, refreshToken, {
    userAgent: req.headers['user-agent'],
    ip: req.ip,
  }).catch((err) => console.error('[login-inner] createRefreshSession failed:', err));
};

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

    if (!user.password) {
      return res.status(400).send({ logged: false, message: message.login.error });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(400).send({ logged: false, message: message.login.error });
    }

    if (user.twoFactorEnabled) {
      const mfaToken = createMfaToken(user.id);
      return res.status(200).send({ logged: false, mfaRequired: true, mfaToken });
    }

    await issueSession(res, req, user);
    return res.status(200).send({ logged: true, message: message.login.success });
  } catch {
    return res.status(400).send({ logged: false, message: message.login.error });
  }
});

router.post('/verify-2fa', async (req: Request, res: Response) => {
  try {
    const { mfaToken, code } = req.body as { mfaToken?: string; code?: string };

    if (!mfaToken || !code) {
      return res.status(400).send({ logged: false, message: message.login.error });
    }

    const claims = decodeMfaToken(mfaToken);

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', claims.sub)
      .single<UserRecord>();

    if (error || !user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(401).send({ logged: false, message: message.login.error });
    }

    const secret = decryptSecret(user.twoFactorSecret);
    const validTotp = await verifyTOTP(code, secret);

    if (!validTotp) {
      const hashedInput = hashBackupCode(code);
      const codeIndex = user.backupCodes?.indexOf(hashedInput) ?? -1;

      if (codeIndex === -1) {
        return res.status(400).send({ logged: false, message: 'Código inválido.' });
      }

      const updatedCodes = [...(user.backupCodes ?? [])];
      updatedCodes.splice(codeIndex, 1);

      await supabase.from('users').update({ backupCodes: updatedCodes }).eq('id', user.id);
    }

    await issueSession(res, req, user);
    return res.status(200).send({ logged: true, message: message.login.success });
  } catch {
    return res.status(401).send({ logged: false, message: message.login.error });
  }
});

export default router;
