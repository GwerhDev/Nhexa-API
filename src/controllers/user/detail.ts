import { Router, Request, Response } from 'express';
import { message } from '../../messages';
import { decodeToken } from '../../integrations/jwt';
import { supabase } from '../../integrations/supabase';
import { ACCESS_TOKEN_COOKIE } from '../../integrations/cookies';
import type { AccountResponse, UserDetail, UserRecord } from '../../types';

const router = Router();

const buildResponse = (user: UserRecord): { userData: AccountResponse; accountDetail: UserDetail } => ({
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
});

const DETAIL_SELECT = 'id, username, email, isVerified, role, profilePic, googlePic, firstName, lastName, birthDate, countryId, phone, phoneCode, passwordSetAt';

router.get('/', async (req: Request, res: Response) => {
  try {
    const decoded = await decodeToken(req.cookies[ACCESS_TOKEN_COOKIE]);
    const { data: user, error } = await supabase
      .from('users')
      .select(DETAIL_SELECT)
      .eq('id', decoded.data.id)
      .single<UserRecord>();

    if (error || !user) return res.status(401).json({ message: message.user.unauthorized });

    return res.status(200).json(buildResponse(user));
  } catch {
    return res.status(401).json({ message: message.user.unauthorized });
  }
});

router.patch('/', async (req: Request, res: Response) => {
  try {
    const decoded = await decodeToken(req.cookies[ACCESS_TOKEN_COOKIE]);
    const { username, email, firstName, lastName, birthDate, countryId, phone, phoneCode } =
      req.body as Partial<Pick<UserRecord, 'username' | 'email' | 'firstName' | 'lastName' | 'birthDate' | 'countryId' | 'phone' | 'phoneCode'>>;

    const updateData: Record<string, unknown> = {};
    if (username !== undefined) updateData.username = username;
    if (email !== undefined) updateData.email = email;
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (birthDate !== undefined) updateData.birthDate = birthDate;
    if (countryId !== undefined) updateData.countryId = countryId;
    if (phone !== undefined) updateData.phone = phone;
    if (phoneCode !== undefined) updateData.phoneCode = phoneCode;

    const { data: user, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', decoded.data.id)
      .select(DETAIL_SELECT)
      .single<UserRecord>();

    if (error || !user) throw error;

    return res.status(200).json(buildResponse(user));
  } catch {
    return res.status(500).json({ message: message.user.error });
  }
});

export default router;
