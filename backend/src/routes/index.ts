import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes';
import { contentRouter } from '../modules/content/content.routes';
import { dashboardRouter } from '../modules/dashboard/dashboard.routes';
import { examsRouter, examUjianRouter } from '../modules/exams/exams.routes';
import { materialsRouter } from '../modules/materials/materials.routes';
import { commerceRouter } from '../modules/commerce/commerce.routes';
import { referralsRouter } from '../modules/referrals/referrals.routes';
import { contactRouter } from '../modules/contact/contact.routes';
import { adminRouter } from '../modules/admin/admin.routes';
import { calculatorsRouter } from '../modules/calculators/calculators.routes';
import { authenticate, authorize } from '../middlewares/auth';

export const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.use('/auth', authRouter);
router.use('/landing', contentRouter);
router.use('/dashboard', dashboardRouter);
router.use('/exams', examsRouter);
router.use('/ujian', examUjianRouter);
router.use('/materials', materialsRouter);
router.use('/commerce', commerceRouter);
router.use('/referrals', referralsRouter);
router.use('/contact', contactRouter);
router.use('/calculators', calculatorsRouter);
router.use('/admin', authenticate, authorize(['ADMIN']), adminRouter);
