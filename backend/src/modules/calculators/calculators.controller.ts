import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../middlewares/errorHandler';
import {
  adminListCalculators,
  adminUpdateCalculator,
  computeCalculator,
  getCalculatorDetail,
  getCalculatorTree,
} from './calculators.service';

export async function calculatorTreeController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getCalculatorTree();
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function calculatorDetailController(req: Request, res: Response, next: NextFunction) {
  try {
    const slug = req.params.slug;
    if (!slug) {
      throw new HttpError('Slug kalkulator wajib ada', 400);
    }
    const calculator = await getCalculatorDetail(slug);
    res.json({ status: 'success', data: calculator });
  } catch (error) {
    next(error);
  }
}

export async function calculatorComputeController(req: Request, res: Response, next: NextFunction) {
  try {
    const slug = req.params.slug;
    if (!slug) {
      throw new HttpError('Slug kalkulator wajib ada', 400);
    }
    const values = (req.body?.values as Record<string, string | number | null | undefined>) ?? {};
    const payload = await computeCalculator(slug, values);
    res.json({ status: 'success', data: payload });
  } catch (error) {
    next(error);
  }
}

export async function adminCalculatorListController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await adminListCalculators();
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function adminCalculatorUpdateController(req: Request, res: Response, next: NextFunction) {
  try {
    const calculatorId = req.params.id;
    if (!calculatorId) {
      throw new HttpError('ID kalkulator wajib diisi', 400);
    }
    const calculator = await adminUpdateCalculator(calculatorId, req.body ?? {});
    res.json({ status: 'success', data: calculator });
  } catch (error) {
    next(error);
  }
}
