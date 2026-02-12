import { Router } from 'express';
import { authenticate } from '../../middlewares/auth';
import { validateResource } from '../../middlewares/validateResource';
import {
  cermatStartController,
  cermatSubmitController,
  cermatHistoryController,
  examBlockConfigController,
  examBlockCreateController,
  examBlockStatusController,
  examBlockUnlockController,
  examPracticeCategoriesController,
  examPracticeInfoController,
  examPracticeHistoryController,
  examPracticeReviewController,
  examPracticeSetController,
  examPracticeSubmitController,
  examTryoutInfoController,
  examTryoutDetailController,
  examTryoutHistoryController,
  examTryoutListController,
  examTryoutReviewController,
  examTryoutStartController,
  examTryoutSubmitController,
  practiceCategoriesController,
  practiceInfoController,
  practiceHistoryController,
  practiceReviewController,
  practiceSetController,
  practiceSubmitController,
  tryoutInfoController,
  tryoutDetailController,
  tryoutHistoryController,
  tryoutListController,
  tryoutReviewController,
  tryoutStartController,
  tryoutSubmitController,
} from './exams.controller';
import {
  examBlockCreateSchema,
  examBlockUnlockSchema,
  startTryoutSchema,
  submitTryoutSchema,
  submitPracticeSchema,
  startCermatSchema,
  submitCermatSchema,
  reviewResultSchema,
} from './exams.schemas';

export const examsRouter = Router();
export const examUjianRouter = Router();

examsRouter.use(authenticate);
examUjianRouter.use(authenticate);

examsRouter.get('/tryouts', tryoutListController);
examsRouter.get('/tryouts/:slug/info', tryoutInfoController);
examsRouter.get('/tryouts/:slug', tryoutDetailController);
examsRouter.post('/tryouts/:slug/start', validateResource(startTryoutSchema), tryoutStartController);
examsRouter.post('/tryouts/:slug/submit', validateResource(submitTryoutSchema), tryoutSubmitController);
examsRouter.get('/tryouts-history', tryoutHistoryController);
examsRouter.get('/tryouts/results/:resultId/review', validateResource(reviewResultSchema), tryoutReviewController);

examsRouter.get('/practice/categories', practiceCategoriesController);
examsRouter.get('/practice/:slug/info', practiceInfoController);
examsRouter.get('/practice/:slug', practiceSetController);
examsRouter.post('/practice/:slug/submit', validateResource(submitPracticeSchema), practiceSubmitController);
examsRouter.get('/practice-history', practiceHistoryController);
examsRouter.get('/practice/results/:resultId/review', validateResource(reviewResultSchema), practiceReviewController);

examsRouter.post('/cermat/session', validateResource(startCermatSchema), cermatStartController);
examsRouter.post('/cermat/session/:sessionId/submit', validateResource(submitCermatSchema), cermatSubmitController);
examsRouter.get('/cermat/history', cermatHistoryController);

examsRouter.get('/blocks', examBlockStatusController);
examsRouter.get('/block-config', examBlockConfigController);
examsRouter.post('/blocks', validateResource(examBlockCreateSchema), examBlockCreateController);
examsRouter.post('/blocks/unlock', validateResource(examBlockUnlockSchema), examBlockUnlockController);

examUjianRouter.get('/tryouts', examTryoutListController);
examUjianRouter.get('/tryouts/:slug/info', examTryoutInfoController);
examUjianRouter.get('/tryouts/:slug', examTryoutDetailController);
examUjianRouter.post('/tryouts/:slug/start', validateResource(startTryoutSchema), examTryoutStartController);
examUjianRouter.post('/tryouts/:slug/submit', validateResource(submitTryoutSchema), examTryoutSubmitController);
examUjianRouter.get('/tryouts-history', examTryoutHistoryController);
examUjianRouter.get('/tryouts/results/:resultId/review', validateResource(reviewResultSchema), examTryoutReviewController);

examUjianRouter.get('/practice/categories', examPracticeCategoriesController);
examUjianRouter.get('/practice/:slug/info', examPracticeInfoController);
examUjianRouter.get('/practice/:slug', examPracticeSetController);
examUjianRouter.post('/practice/:slug/submit', validateResource(submitPracticeSchema), examPracticeSubmitController);
examUjianRouter.get('/practice-history', examPracticeHistoryController);
examUjianRouter.get('/practice/results/:resultId/review', validateResource(reviewResultSchema), examPracticeReviewController);

examUjianRouter.get('/blocks', examBlockStatusController);
examUjianRouter.get('/block-config', examBlockConfigController);
examUjianRouter.post('/blocks', validateResource(examBlockCreateSchema), examBlockCreateController);
examUjianRouter.post('/blocks/unlock', validateResource(examBlockUnlockSchema), examBlockUnlockController);
