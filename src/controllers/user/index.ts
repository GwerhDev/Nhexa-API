import { Router } from 'express';
import device from './device';
import detail from './detail';
import password from './password';

const router = Router();

router.use('/device', device);
router.use('/detail', detail);
router.use('/password', password);

export default router;
