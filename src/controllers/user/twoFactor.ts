import { Router, Request, Response } from 'express';
import { message } from '../../messages';
import { decodeToken } from '../../integrations/jwt';
import { supabase } from '../../integrations/supabase';
import { ACCESS_TOKEN_COOKIE } from '../../integrations/cookies';
import {
  generateTOTPSecret,
  getOtpauthUrl,
  getQRCodeDataUrl,
  verifyTOTP,
  encryptSecret,
  decryptSecret,
  generateBackupCodes,
  hashBackupCode,
} from '../../integrations/totp';
import type { UserRecord } from '../../types';

const router = Router();

router.get('/setup', async (req: Request, res: Response) => {
  try {
    const decoded = await decodeToken(req.cookies[ACCESS_TOKEN_COOKIE]);
    const { data: user, error } = await supabase
      .from('users')
      .select('email, twoFactorEnabled')
      .eq('id', decoded.data.id)
      .single<Pick<UserRecord, 'email' | 'twoFactorEnabled'>>();

    if (error || !user) return res.status(401).json({ message: message.user.unauthorized });
    if (user.twoFactorEnabled) return res.status(400).json({ message: '2FA ya está habilitado.' });

    const secret = generateTOTPSecret();
    const otpauthUrl = getOtpauthUrl(user.email, secret);
    const qrDataUrl = await getQRCodeDataUrl(otpauthUrl);

    return res.status(200).json({ secret, qrDataUrl });
  } catch {
    return res.status(401).json({ message: message.user.unauthorized });
  }
});

router.post('/enable', async (req: Request, res: Response) => {
  try {
    const decoded = await decodeToken(req.cookies[ACCESS_TOKEN_COOKIE]);
    const { secret, code } = req.body as { secret?: string; code?: string };

    if (!secret || !code) return res.status(400).json({ message: 'Faltan parámetros.' });

    if (!verifyTOTP(code, secret)) {
      return res.status(400).json({ message: 'Código inválido. Intenta nuevamente.' });
    }

    const plainCodes = generateBackupCodes();
    const hashedCodes = plainCodes.map(hashBackupCode);

    const { error } = await supabase
      .from('users')
      .update({
        twoFactorSecret: encryptSecret(secret),
        twoFactorEnabled: true,
        backupCodes: hashedCodes,
      })
      .eq('id', decoded.data.id);

    if (error) throw error;

    return res.status(200).json({ backupCodes: plainCodes });
  } catch {
    return res.status(500).json({ message: message.user.error });
  }
});

router.post('/disable', async (req: Request, res: Response) => {
  try {
    const decoded = await decodeToken(req.cookies[ACCESS_TOKEN_COOKIE]);
    const { code } = req.body as { code?: string };

    if (!code) return res.status(400).json({ message: 'Faltan parámetros.' });

    const { data: user, error } = await supabase
      .from('users')
      .select('twoFactorSecret, twoFactorEnabled, backupCodes')
      .eq('id', decoded.data.id)
      .single<Pick<UserRecord, 'twoFactorSecret' | 'twoFactorEnabled' | 'backupCodes'>>();

    if (error || !user) return res.status(401).json({ message: message.user.unauthorized });
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({ message: '2FA no está habilitado.' });
    }

    const secret = decryptSecret(user.twoFactorSecret);
    const validTotp = verifyTOTP(code, secret);
    const hashedInput = hashBackupCode(code);
    const validBackup = user.backupCodes?.includes(hashedInput) ?? false;

    if (!validTotp && !validBackup) {
      return res.status(400).json({ message: 'Código inválido.' });
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ twoFactorSecret: null, twoFactorEnabled: false, backupCodes: null })
      .eq('id', decoded.data.id);

    if (updateError) throw updateError;

    return res.status(200).json({ success: true });
  } catch {
    return res.status(500).json({ message: message.user.error });
  }
});

export default router;
