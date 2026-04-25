import { Router } from 'express';

import user from '../controllers/user';
import logout from '../controllers/logout';
import session from '../controllers/session';
import account from '../controllers/account';
import appList from '../controllers/app-list';
import menuList from '../controllers/menu-list';
import loginInner from '../controllers/login-inner';
import loginGoogle from '../controllers/login-google';
import signupInner from '../controllers/signup-inner';
import signupGoogle from '../controllers/signup-google';
import dev from '../controllers/dev';
import { authMiddleware } from '../middleware/auth';

const router = Router();

if (process.env.NODE_ENV !== 'production') {
  router.use('/dev', dev);
}

router.use('/logout', logout);
router.use('/user', authMiddleware, user);
router.use('/session', authMiddleware, session);
router.use('/account', authMiddleware, account);
router.use('/app-list', appList);
router.use('/menu-list', menuList);
router.use('/login-inner', loginInner);
router.use('/login-google', loginGoogle);
router.use('/signup-inner', signupInner);
router.use('/signup-google', signupGoogle);

export default router;
