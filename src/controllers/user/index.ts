import { Router } from 'express';
import device from './device';
import password from './password';

const router = Router();

router.use('/device', device);
router.use('/password', password);

export default router;
