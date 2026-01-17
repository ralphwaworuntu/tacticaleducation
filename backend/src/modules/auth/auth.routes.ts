import { Router } from 'express';
import { authRateLimiter } from '../../middlewares/rateLimiter';
import { authenticate } from '../../middlewares/auth';
import { avatarUpload, optimizeUploadedImages } from '../../config/upload';
import { validateResource } from '../../middlewares/validateResource';
import {
  changePasswordController,
  loginController,
  logoutController,
  profileController,
  refreshController,
  registerController,
  resendVerificationController,
  updateProfileController,
  uploadAvatarController,
  verifyEmailController,
} from './auth.controller';
import {
  changePasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resendVerificationSchema,
  updateProfileSchema,
  verifyEmailSchema,
} from './auth.schemas';

export const authRouter = Router();

authRouter.post('/register', authRateLimiter, validateResource(registerSchema), registerController);
authRouter.post('/verify-email', validateResource(verifyEmailSchema), verifyEmailController);
authRouter.post(
  '/resend-verification',
  authRateLimiter,
  validateResource(resendVerificationSchema),
  resendVerificationController,
);
authRouter.post('/login', authRateLimiter, validateResource(loginSchema), loginController);
authRouter.post('/refresh', validateResource(refreshSchema), refreshController);
authRouter.post('/logout', authenticate, logoutController);
authRouter.get('/me', authenticate, profileController);
authRouter.patch('/me', authenticate, validateResource(updateProfileSchema), updateProfileController);
authRouter.post('/password', authenticate, validateResource(changePasswordSchema), changePasswordController);
authRouter.post('/avatar', authenticate, avatarUpload.single('avatar'), optimizeUploadedImages, uploadAvatarController);
