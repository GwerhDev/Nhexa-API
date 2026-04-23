import { Router } from 'express';

import logout from '../controllers/logout';
import session from '../controllers/session';
import account from '../controllers/account';
import appList from '../controllers/app-list';
import menuList from '../controllers/menu-list';
import loginInner from '../controllers/login-inner';
import loginGoogle from '../controllers/login-google';
import signupInner from '../controllers/signup-inner';
import signupGoogle from '../controllers/signup-google';

const router = Router();

router.use('/logout', logout);
router.use('/session', session);
router.use('/account', account);
router.use('/app-list', appList);
router.use('/menu-list', menuList);
router.use('/login-inner', loginInner);
router.use('/login-google', loginGoogle);
router.use('/signup-inner', signupInner);
router.use('/signup-google', signupGoogle);

export default router;
