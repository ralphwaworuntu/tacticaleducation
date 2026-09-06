import type { NextFunction, Request, Response } from 'express';
import { getReferralOverview } from './referrals.service';

export async function referralsMeController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getReferralOverview(req.user!.id);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}
