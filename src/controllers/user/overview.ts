import { Router, Request, Response } from 'express';
import { message } from '../../messages';
import { decodeToken } from '../../integrations/jwt';
import { supabase } from '../../integrations/supabase';
import { ACCESS_TOKEN_COOKIE } from '../../integrations/cookies';
import type { UserRecord, AccountResponse, UserDetail } from '../../types';

const router = Router();

const OVERVIEW_SELECT = 'id, username, email, isVerified, role, profilePic, googlePic, firstName, lastName, birthDate, countryId, phone, phoneCode, passwordSetAt, twoFactorEnabled';

export interface UserOverview {
  userData: AccountResponse;
  accountDetail: UserDetail;
  securityStatus: {
    passwordSetAt: string | null;
    twoFactorEnabled: boolean;
  };
}

const buildOverview = (user: UserRecord): UserOverview => ({
  userData: {
    id: user.id,
    username: user.username,
    email: user.email,
    isVerified: user.isVerified,
    role: user.role,
    profilePic: user.profilePic ?? user.googlePic ?? null,
  },
  accountDetail: {
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    birthDate: user.birthDate ?? null,
    countryId: user.countryId ?? null,
    phone: user.phone ?? null,
    phoneCode: user.phoneCode ?? null,
    passwordSetAt: user.passwordSetAt ?? null,
  },
  securityStatus: {
    passwordSetAt: user.passwordSetAt ?? null,
    twoFactorEnabled: user.twoFactorEnabled ?? false,
  },
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const decoded = await decodeToken(req.cookies[ACCESS_TOKEN_COOKIE]);
    const { data: user, error } = await supabase
      .from('users')
      .select(OVERVIEW_SELECT)
      .eq('id', decoded.data.id)
      .single<UserRecord>();

    if (error || !user) return res.status(401).json({ message: message.user.unauthorized });

    return res.status(200).json(buildOverview(user));
  } catch {
    return res.status(401).json({ message: message.user.unauthorized });
  }
});

export default router;
