import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { createToken } from '../integrations/jwt';
import { message } from '../messages';
import { supabase } from '../integrations/supabase';
import { production } from '../misc/consts';
import { validate } from '../middleware/validate';
import { LoginInnerSchema, type LoginInnerInput } from '../schemas/auth';
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

    const token = await createToken({ id: user.id, role: user.role }, 24);

    if (process.env.NODE_ENV === production) {
      res.cookie('userToken', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        domain: '.nhexa.cl',
        path: '/',
        maxAge: 24 * 60 * 60 * 1000,
      });
    } else {
      res.cookie('userToken', token, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
        maxAge: 24 * 60 * 60 * 1000,
      });
    }

    return res.status(200).send({ logged: true, message: message.login.success, token });
  } catch {
    return res.status(400).send({ logged: false, message: message.login.error });
  }
});

export default router;
