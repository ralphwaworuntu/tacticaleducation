import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth';
import { paymentProofUpload, optimizeUploadedImages } from '../../config/upload';
import { validateResource } from '../../middlewares/validateResource';
import {
  addonPackagesController,
  createTransactionController,
  confirmTransactionController,
  listTransactionsController,
  membershipPackagesController,
  membershipStatusController,
  paymentInfoController,
  updateTransactionController,
} from './commerce.controller';
import { confirmTransactionSchema, createTransactionSchema, updateTransactionSchema } from './commerce.schemas';

export const commerceRouter = Router();

commerceRouter.get('/packages', membershipPackagesController);
commerceRouter.get('/payment-info', paymentInfoController);
commerceRouter.use(authenticate);
commerceRouter.get('/addons', addonPackagesController);
commerceRouter.get('/membership/status', membershipStatusController);
commerceRouter.post('/transactions', validateResource(createTransactionSchema), createTransactionController);
commerceRouter.post(
  '/transactions/:code/confirm',
  paymentProofUpload.single('proof'),
  optimizeUploadedImages,
  validateResource(confirmTransactionSchema),
  confirmTransactionController,
);
commerceRouter.get('/transactions', listTransactionsController);
commerceRouter.patch(
  '/transactions/:id',
  authorize(['ADMIN']),
  validateResource(updateTransactionSchema),
  updateTransactionController,
);
