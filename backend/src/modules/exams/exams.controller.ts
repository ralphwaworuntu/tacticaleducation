import type { NextFunction, Request, Response } from 'express';
import { ExamBlockType } from '@prisma/client';
import { HttpError } from '../../middlewares/errorHandler';
import {
  getTryoutDetail,
  getTryoutInfo,
  getTryoutHistory,
  getTryoutReview,
  listTryouts,
  startExamTryout,
  startTryout,
  submitTryout,
} from './tryout.service';
import {
  getPracticeHistory,
  getPracticeInfo,
  getPracticeReview,
  getExamPracticeSet,
  getPracticeSet,
  listPracticeCategories,
  submitPractice,
} from './practice.service';
import { ensureExamAccessAllowed } from './exam-control.service';
import { getCermatHistory, startCermatSession, submitCermatSession } from './cermat.service';
import {
  getExamBlockConfig,
  listUserExamBlocks,
  recordExamViolation,
  unlockExamBlock,
  type ExamBlockContext,
} from './exam-block.service';
import { assertMembershipFeatureByUser } from '../../utils/membership';

export async function tryoutListController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await listTryouts();
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function tryoutDetailController(req: Request, res: Response, next: NextFunction) {
  try {
    const slug = req.params.slug;
    if (!slug) {
      throw new HttpError('Tryout slug is required', 400);
    }
    const data = await getTryoutDetail(slug, req.user!.id);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function tryoutInfoController(req: Request, res: Response, next: NextFunction) {
  try {
    const slug = req.params.slug;
    if (!slug) {
      throw new HttpError('Tryout slug is required', 400);
    }
    const data = await getTryoutInfo(slug);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function tryoutStartController(req: Request, res: Response, next: NextFunction) {
  try {
    const slug = req.params.slug;
    if (!slug) {
      throw new HttpError('Tryout slug is required', 400);
    }
    const data = await startTryout(slug, req.user!.id);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function tryoutSubmitController(req: Request, res: Response, next: NextFunction) {
  try {
    const slug = req.params.slug;
    if (!slug) {
      throw new HttpError('Tryout slug is required', 400);
    }
    const data = await submitTryout(slug, req.user!.id, req.body);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function tryoutHistoryController(req: Request, res: Response, next: NextFunction) {
  try {
    await assertMembershipFeatureByUser(req.user!.id, 'TRYOUT');
    const data = await getTryoutHistory(req.user!.id);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function tryoutReviewController(req: Request, res: Response, next: NextFunction) {
  try {
    const { resultId } = req.params;
    if (!resultId) {
      throw new HttpError('Result id is required', 400);
    }
    const data = await getTryoutReview(resultId, req.user!.id);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function examTryoutListController(req: Request, res: Response, next: NextFunction) {
  try {
    await ensureExamAccessAllowed(req.user!.id);
    const data = await listTryouts();
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function examTryoutDetailController(req: Request, res: Response, next: NextFunction) {
  try {
    const slug = req.params.slug;
    if (!slug) {
      throw new HttpError('Tryout slug is required', 400);
    }
    await ensureExamAccessAllowed(req.user!.id);
    const data = await getTryoutDetail(slug, req.user!.id);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function examTryoutInfoController(req: Request, res: Response, next: NextFunction) {
  try {
    const slug = req.params.slug;
    if (!slug) {
      throw new HttpError('Tryout slug is required', 400);
    }
    await ensureExamAccessAllowed(req.user!.id);
    const data = await getTryoutInfo(slug);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function examTryoutStartController(req: Request, res: Response, next: NextFunction) {
  try {
    const slug = req.params.slug;
    if (!slug) {
      throw new HttpError('Tryout slug is required', 400);
    }
    const data = await startExamTryout(slug, req.user!.id);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function examTryoutSubmitController(req: Request, res: Response, next: NextFunction) {
  try {
    const slug = req.params.slug;
    if (!slug) {
      throw new HttpError('Tryout slug is required', 400);
    }
    await ensureExamAccessAllowed(req.user!.id);
    const data = await submitTryout(slug, req.user!.id, req.body);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function examTryoutHistoryController(req: Request, res: Response, next: NextFunction) {
  try {
    await ensureExamAccessAllowed(req.user!.id);
    const data = await getTryoutHistory(req.user!.id);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function examTryoutReviewController(req: Request, res: Response, next: NextFunction) {
  try {
    const { resultId } = req.params;
    if (!resultId) {
      throw new HttpError('Result id is required', 400);
    }
    await ensureExamAccessAllowed(req.user!.id);
    const data = await getTryoutReview(resultId, req.user!.id);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function practiceCategoriesController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await listPracticeCategories();
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function practiceSetController(req: Request, res: Response, next: NextFunction) {
  try {
    const slug = req.params.slug;
    if (!slug) {
      throw new HttpError('Practice slug is required', 400);
    }
    const data = await getPracticeSet(slug, req.user!.id);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function practiceInfoController(req: Request, res: Response, next: NextFunction) {
  try {
    const slug = req.params.slug;
    if (!slug) {
      throw new HttpError('Practice slug is required', 400);
    }
    const data = await getPracticeInfo(slug);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function practiceSubmitController(req: Request, res: Response, next: NextFunction) {
  try {
    const slug = req.params.slug;
    if (!slug) {
      throw new HttpError('Practice slug is required', 400);
    }
    const data = await submitPractice(slug, req.user!.id, req.body);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function practiceHistoryController(req: Request, res: Response, next: NextFunction) {
  try {
    await assertMembershipFeatureByUser(req.user!.id, 'PRACTICE');
    const data = await getPracticeHistory(req.user!.id);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function practiceReviewController(req: Request, res: Response, next: NextFunction) {
  try {
    const { resultId } = req.params;
    if (!resultId) {
      throw new HttpError('Result id is required', 400);
    }
    const data = await getPracticeReview(resultId, req.user!.id);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function examPracticeCategoriesController(req: Request, res: Response, next: NextFunction) {
  try {
    await ensureExamAccessAllowed(req.user!.id);
    const data = await listPracticeCategories();
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function examPracticeSetController(req: Request, res: Response, next: NextFunction) {
  try {
    const slug = req.params.slug;
    if (!slug) {
      throw new HttpError('Practice slug is required', 400);
    }
    const data = await getExamPracticeSet(slug, req.user!.id);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function examPracticeInfoController(req: Request, res: Response, next: NextFunction) {
  try {
    const slug = req.params.slug;
    if (!slug) {
      throw new HttpError('Practice slug is required', 400);
    }
    await ensureExamAccessAllowed(req.user!.id);
    const data = await getPracticeInfo(slug);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function examPracticeSubmitController(req: Request, res: Response, next: NextFunction) {
  try {
    const slug = req.params.slug;
    if (!slug) {
      throw new HttpError('Practice slug is required', 400);
    }
    await ensureExamAccessAllowed(req.user!.id);
    const data = await submitPractice(slug, req.user!.id, req.body);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function examPracticeHistoryController(req: Request, res: Response, next: NextFunction) {
  try {
    await ensureExamAccessAllowed(req.user!.id);
    const data = await getPracticeHistory(req.user!.id);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function examPracticeReviewController(req: Request, res: Response, next: NextFunction) {
  try {
    const { resultId } = req.params;
    if (!resultId) {
      throw new HttpError('Result id is required', 400);
    }
    await ensureExamAccessAllowed(req.user!.id);
    const data = await getPracticeReview(resultId, req.user!.id);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function cermatStartController(req: Request, res: Response, next: NextFunction) {
  try {
    // eslint-disable-next-line no-console
    console.log('cermatStart body:', req.body);
    await assertMembershipFeatureByUser(req.user!.id, 'CERMAT');
    const mode = req.body.mode === 'LETTER' ? 'LETTER' : 'NUMBER';
    const data = await startCermatSession(req.user!.id, mode);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function cermatSubmitController(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = req.params.sessionId;
    if (!sessionId) {
      throw new HttpError('Session id is required', 400);
    }
    await assertMembershipFeatureByUser(req.user!.id, 'CERMAT');
    const data = await submitCermatSession(req.user!.id, sessionId, req.body.answers);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function cermatHistoryController(req: Request, res: Response, next: NextFunction) {
  try {
    await assertMembershipFeatureByUser(req.user!.id, 'CERMAT');
    const data = await getCermatHistory(req.user!.id);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
}

export async function examBlockStatusController(req: Request, res: Response, next: NextFunction) {
  try {
    const context: ExamBlockContext = req.baseUrl?.includes('/ujian') ? 'UJIAN' : 'STANDARD';
    const blocks = await listUserExamBlocks(req.user!.id, context);
    res.json({ status: 'success', data: blocks });
  } catch (error) {
    next(error);
  }
}

export async function examBlockCreateController(req: Request, res: Response, next: NextFunction) {
  try {
    const { type, reason } = req.body as { type: ExamBlockType; reason?: string };
    const context: ExamBlockContext = req.baseUrl?.includes('/ujian') ? 'UJIAN' : 'STANDARD';
    const block = await recordExamViolation(req.user!.id, type, reason, context);
    if (!block) {
      res.json({ status: 'success', data: { skipped: true, type } });
      return;
    }
    res.status(201).json({ status: 'success', data: { id: block.id, type: block.type, blockedAt: block.blockedAt } });
  } catch (error) {
    next(error);
  }
}

export async function examBlockUnlockController(req: Request, res: Response, next: NextFunction) {
  try {
    const { type, code } = req.body as { type: ExamBlockType; code: string };
    await unlockExamBlock(req.user!.id, type, code);
    res.json({ status: 'success', data: { type } });
  } catch (error) {
    next(error);
  }
}

export async function examBlockConfigController(_req: Request, res: Response, next: NextFunction) {
  try {
    const config = await getExamBlockConfig();
    res.json({ status: 'success', data: config });
  } catch (error) {
    next(error);
  }
}
