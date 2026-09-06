import type { NextFunction, Request, Response } from 'express';
import {
  changePassword,
  getProfile,
  loginUser,
  logoutUser,
  refreshTokens,
  registerUser,
  resendEmailVerification,
  updateProfile,
  verifyEmailToken,
} from './auth.service';
import { buildPublicUploadPath } from '../../config/upload';
import { prisma } from '../../config/prisma';
import { HttpError } from '../../middlewares/errorHandler';

export async function registerController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await registerUser(req.body);
    res.status(201).json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
}

export async function loginController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await loginUser(req.body);
    res.json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
}

export async function refreshController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await refreshTokens(req.body.refreshToken);
    res.json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
}

export async function profileController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getProfile(req.user!.id);
    res.json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
}

export async function updateProfileController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await updateProfile(req.user!.id, req.body);
    res.json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
}

export async function logoutController(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await logoutUser(req.user!.id, refreshToken);
    }
    res.json({ status: 'success', message: 'Logged out' });
  } catch (error) {
    next(error);
  }
}

export async function verifyEmailController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await verifyEmailToken(req.body.token);
    res.json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
}

export async function resendVerificationController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await resendEmailVerification(req.body.email);
    res.json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
}

export async function changePasswordController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await changePassword(req.user!.id, req.body);
    res.json({ status: 'success', data: result });
  } catch (error) {
    next(error);
  }
}

export async function uploadAvatarController(req: Request, res: Response, next: NextFunction) {
  try {
    const file = req.file;
    if (!file) {
      throw new HttpError('File avatar wajib diunggah', 400);
    }
    const avatarUrl = buildPublicUploadPath(file.path);
    const data = await prisma.user.update({
      where: { id: req.user!.id },
      data: { avatarUrl },
      select: { id: true, name: true, email: true, avatarUrl: true, phone: true },
    });
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}
