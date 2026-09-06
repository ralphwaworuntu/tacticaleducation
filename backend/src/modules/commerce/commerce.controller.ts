import type { Express, NextFunction, Request, Response } from 'express';
import { buildPublicUploadPath } from '../../config/upload';
import { HttpError } from '../../middlewares/errorHandler';
import {
  adminUpdateTransaction,
  confirmTransaction,
  createTransaction,
  getMembershipStatus,
  getPaymentSetting,
  listAddonPackages,
  listMembershipPackages,
  listTransactions,
} from './commerce.service';

export async function membershipPackagesController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await listMembershipPackages();
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function addonPackagesController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await listAddonPackages();
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function paymentInfoController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getPaymentSetting();
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function createTransactionController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await createTransaction(req.user!.id, req.body);
    res.status(201).json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function confirmTransactionController(req: Request, res: Response, next: NextFunction) {
  try {
    const { code } = req.params;
    if (!code) {
      throw new HttpError('Transaction code is required', 400);
    }
    const file = req.file as Express.Multer.File | undefined;
    if (!file) {
      throw new HttpError('Bukti pembayaran wajib diunggah', 400);
    }

    const description = typeof req.body.description === 'string' && req.body.description.length > 0 ? req.body.description : undefined;
    const proofPath = buildPublicUploadPath(file.path);
    const data = await confirmTransaction(req.user!.id, code, { proofPath, description });
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function listTransactionsController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await listTransactions(req.user!.id);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function membershipStatusController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getMembershipStatus(req.user!.id);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function updateTransactionController(req: Request, res: Response, next: NextFunction) {
  try {
    const transactionId = req.params.id;
    if (!transactionId) {
      throw new HttpError('Transaction id is required', 400);
    }

    const status = req.body.status as 'PENDING' | 'PAID' | 'REJECTED';
    if (!['PENDING', 'PAID', 'REJECTED'].includes(status)) {
      throw new HttpError('Invalid transaction status', 400);
    }

    const data = await adminUpdateTransaction(transactionId, status);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}
