import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { validateResource } from '../../middlewares/validateResource';
import {
  announcementsController,
  calculatorController,
  dashboardOverviewController,
  faqController,
  newsController,
  welcomeModalController,
  memberBackgroundController,
  examControlStatusController,
} from './dashboard.controller';
import { calculatorSubmissionSchema } from './dashboard.schemas';

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);
dashboardRouter.get('/overview', dashboardOverviewController);
dashboardRouter.get('/announcements', announcementsController);
dashboardRouter.get('/faq', faqController);
dashboardRouter.get('/news', newsController);
dashboardRouter.get('/welcome-modal', welcomeModalController);
dashboardRouter.get('/member-background', memberBackgroundController);
dashboardRouter.get('/exam-control', examControlStatusController);
dashboardRouter.post('/calculator/:slug', validateResource(calculatorSubmissionSchema), calculatorController);
