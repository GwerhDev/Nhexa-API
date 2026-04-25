import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { message } from '../messages';
import { decodeToken } from '../integrations/jwt';
import { supabase } from '../integrations/supabase';
import { validate } from '../middleware/validate';
import { AccountUpdateSchema, type AccountUpdateInput } from '../schemas/auth';
import type { AccountResponse, UserRecord } from '../types';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const userToken: string | undefined =
      req.cookies['accessToken'] ?? req.headers.authorization?.split(' ')[1];

    if (!userToken) {
      return res.status(401).send({ logged: false, message: message.user.unauthorized });
    }

    const decodedToken = await decodeToken(userToken);
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', decodedToken.data?.id)
      .single<UserRecord>();

    if (error || !user) {
      return res.status(404).send({ logged: false, message: message.user.notfound });
    }

    const userData: AccountResponse = {
      id: user.id,
      username: user.username,
      email: user.email,
      isVerified: user.isVerified,
      role: user.role,
      profilePic: user.profilePic ?? user.googlePic ?? null,
      hasPassword: !!user.password,
    };

    return res.status(200).send({ logged: true, userData });
  } catch {
    return res.status(500).send({ error: message.user.error });
  }
});

router.post('/link-email', async (req: Request, res: Response) => {
  const token = req.cookies['accessToken'];
  if (!token) return res.status(401).json({ message: message.user.unauthorized });
  try {
    const decoded = await decodeToken(token);
    const { password } = req.body as { password?: string };
    if (!password || password.length < 8) {
      return res.status(400).json({ message: 'La contraseña debe tener al menos 8 caracteres' });
    }
    const salt = await bcrypt.genSalt();
    const hashed = await bcrypt.hash(password, salt);
    const { error } = await supabase
      .from('users')
      .update({ password: hashed, isVerified: true })
      .eq('id', decoded.data.id);
    if (error) throw error;
    return res.status(200).json({ success: true });
  } catch {
    return res.status(500).json({ message: message.user.error });
  }
});

router.patch('/update/:id', validate(AccountUpdateSchema), async (req: Request, res: Response) => {
  const body = req.body as AccountUpdateInput;
  const { id } = req.params;
  const userToken: string | undefined = req.cookies?.['accessToken'];

  if (!userToken) {
    return res.status(403).json({ message: message.admin.permissionDenied });
  }

  try {
    const decodedToken = await decodeToken(userToken);
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', decodedToken.data?.id)
      .single<UserRecord>();

    if (userError || !user) {
      return res.status(404).send({ logged: false, message: message.user.notfound });
    }

    if (user.id !== id) {
      return res.status(403).json({ message: message.admin.permissionDenied });
    }

    const { data: existingUser, error: existingUserError } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single<UserRecord>();

    if (existingUserError || !existingUser) {
      return res.status(404).json({ message: message.admin.updateuser.failure });
    }

    const updateData: Record<string, unknown> = { ...body };
    if (body.password) {
      const salt = await bcrypt.genSalt();
      updateData.password = await bcrypt.hash(body.password, salt);
    }

    const { error: updateError } = await supabase.from('users').update(updateData).eq('id', id);

    if (updateError) throw updateError;

    return res.status(200).json({ message: message.admin.updateuser.success });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ error: message.admin.updateuser.error });
  }
});

export default router;
