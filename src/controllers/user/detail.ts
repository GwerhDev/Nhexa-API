import { Router, Request, Response } from 'express';
import { message } from '../../messages';
import { decodeToken } from '../../integrations/jwt';
import { supabase } from '../../integrations/supabase';
import { ACCESS_TOKEN_COOKIE } from '../../integrations/cookies';
import type { UserDetail, UserRecord } from '../../types';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const decoded = await decodeToken(req.cookies[ACCESS_TOKEN_COOKIE]);
    const { data: user, error } = await supabase
      .from('users')
      .select('firstName, lastName, birthDate, countryId, phone, phoneCode, passwordSetAt')
      .eq('id', decoded.data.id)
      .single<Pick<UserRecord, 'firstName' | 'lastName' | 'birthDate' | 'countryId' | 'phone' | 'phoneCode' | 'passwordSetAt'>>();

    if (error || !user) return res.status(401).json({ message: message.user.unauthorized });

    const detail: UserDetail = {
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      birthDate: user.birthDate ?? null,
      countryId: user.countryId ?? null,
      phone: user.phone ?? null,
      phoneCode: user.phoneCode ?? null,
      passwordSetAt: user.passwordSetAt ?? null,
    };

    return res.status(200).json(detail);
  } catch {
    return res.status(401).json({ message: message.user.unauthorized });
  }
});

export default router;
