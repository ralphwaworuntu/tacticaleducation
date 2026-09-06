import { Router } from 'express';
import { getSystemMetrics } from './admin.monitoring.controller';
import { authenticate, authorize } from '../../../middlewares/auth';

const router = Router();

router.use(authenticate, authorize(['ADMIN']));

router.get('/system-metrics', getSystemMetrics);

export default router;
