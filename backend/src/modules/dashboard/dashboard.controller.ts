import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../../middlewares/errorHandler';
import {
  getAnnouncements,
  getDashboardOverview,
  getFaqs,
  getNews,
  getMemberBackgroundConfig,
  getWelcomeModalConfig,
  submitCalculator,
} from './dashboard.service';
import { getExamSectionStatus } from '../exams/exam-control.service';

export async function dashboardOverviewController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getDashboardOverview(req.user!.id);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function announcementsController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getAnnouncements(req.user!.id);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function faqController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getFaqs();
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function newsController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getNews();
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function welcomeModalController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getWelcomeModalConfig();
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function memberBackgroundController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getMemberBackgroundConfig();
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function examControlStatusController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getExamSectionStatus(req.user!.id);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function calculatorController(req: Request, res: Response, next: NextFunction) {
  try {
    const slug = req.params.slug;
    if (!slug) {
      throw new HttpError('Calculator slug is required', 400);
    }
    const submission = await submitCalculator(req.user!.id, {
      slug,
      answers: req.body.answers,
    });
    res.json({ status: 'success', data: submission });
  } catch (error) {
    next(error);
  }
}
