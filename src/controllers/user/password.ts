import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { message } from '../../messages';
import { decodeToken } from '../../integrations/jwt';
import { supabase } from '../../integrations/supabase';
import { ACCESS_TOKEN_COOKIE } from '../../integrations/cookies';
import { UserRecord } from '../../types';
import { defaultPassword } from '../../config';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const decoded = await decodeToken(req.cookies[ACCESS_TOKEN_COOKIE]);
    const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', decoded.data.id)
    .single<UserRecord>();
    
    if (error || !user) return res.status(401).json({ message: message.user.unauthorized });

    return res.status(200).json({
      hasPassword: user.password !== defaultPassword,
    });
  } catch {
    return res.status(401).json({ message: message.user.unauthorized });
  }
});

router.patch('/', async (req: Request, res: Response) => {
  try {
    const decoded = await decodeToken(req.cookies[ACCESS_TOKEN_COOKIE]);
    const { password } = req.body as { password?: string };

    if (!password || password.length < 8) {
      return res.status(400).json({ message: 'La contraseña debe tener al menos 8 caracteres' });
    }

    const salt = await bcrypt.genSalt();
    const hashed = await bcrypt.hash(password, salt);

    const { error } = await supabase
      .from('users')
      .update({ password: hashed })
      .eq('id', decoded.data.id);

    if (error) throw error;

    return res.status(200).json({ success: true });
  } catch {
    return res.status(500).json({ message: message.user.error });
  }
});

export default router;
