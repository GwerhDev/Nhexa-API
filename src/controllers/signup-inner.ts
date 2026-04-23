import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { message } from '../messages';
import { roles, methods } from '../misc/consts-user-model';
import { supabase } from '../integrations/supabase';
import { createToken } from '../integrations/jwt';
import { adminEmailList } from '../config';
import { validate } from '../middleware/validate';
import { SignupInnerSchema, type SignupInnerInput } from '../schemas/auth';
import type { UserRecord } from '../types';

const router = Router();

router.post('/', validate(SignupInnerSchema), async (req: Request, res: Response) => {
  try {
    const { username, password, email } = req.body as SignupInnerInput;

    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single<UserRecord>();

    if (existingUser) {
      return res.status(409).send({ logged: false, message: message.signup.alreadyExists });
    }

    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(password, salt);

    const userDataToCreate: Partial<UserRecord> & Record<string, unknown> = {
      username,
      password: hashedPassword,
      email,
      profilePic: null,
      isVerified: true,
      method: methods.inner,
      role: roles.user,
    };

    if (adminEmailList?.includes(email)) {
      userDataToCreate.role = roles.admin;
    }

    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert([userDataToCreate])
      .select()
      .single<UserRecord>();

    if (createError || !newUser) throw createError;

    const token = await createToken({ id: newUser.id, role: newUser.role }, 24);

    return res.status(200).send({ logged: true, message: message.signup.success, token });
  } catch {
    return res.status(400).send({ logged: false, error: message.signup.error });
  }
});

export default router;
