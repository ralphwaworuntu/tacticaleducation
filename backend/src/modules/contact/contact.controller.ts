import type { NextFunction, Request, Response } from 'express';
import { createContactMessage } from './contact.service';

export async function contactController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await createContactMessage(req.body);
    res.status(201).json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}
