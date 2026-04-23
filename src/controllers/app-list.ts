import { Router, Request, Response } from 'express';
import { decodeToken } from '../integrations/jwt';
import { appList } from '../misc/app-list';
import { roles } from '../misc/consts-user-model';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const userToken =
    req.cookies['userToken'] ?? req.headers.authorization?.split(' ')[1];

  if (!userToken) {
    return res.status(200).send({ user: appList.user });
  }

  try {
    const decoded = await decodeToken(userToken);
    const { role } = decoded.data;

    if (role === roles.admin) return res.status(200).send(appList);
    return res.status(200).send({ user: appList.user });
  } catch {
    return res.status(200).send({ user: appList.user });
  }
});

export default router;
