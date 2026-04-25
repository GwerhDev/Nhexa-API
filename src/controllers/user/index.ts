import { Router } from 'express';
import device from './device';
import detail from './detail';
import password from './password';
import twoFactor from './twoFactor';

const router = Router();

router.use('/device', device);
router.use('/detail', detail);
router.use('/password', password);
router.use('/2fa', twoFactor);

export default router;
