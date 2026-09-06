import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { referralsMeController } from './referrals.controller';

export const referralsRouter = Router();

referralsRouter.get('/me', authenticate, referralsMeController);
