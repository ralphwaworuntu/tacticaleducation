import { Router } from 'express';
import type { Request, Response } from 'express';
import { buildPublicUploadPath, liveQuizImageUpload, optimizeUploadedImages } from '../../config/upload';
import { HttpError } from '../../middlewares/errorHandler';
import { validateResource } from '../../middlewares/validateResource';
import { liveEngine } from './liveEngine';
import {
  createQuizSchema,
  createSessionSchema,
  globalSettingsSchema,
  updateQuizSchema,
  type QuizBody,
} from './liveQuiz.schemas';
import {
  buildCsv,
  buildPlayerDetail,
  buildReport,
  createQuiz,
  dashboardStats,
  deleteQuiz,
  deleteSessionHistory,
  duplicateQuiz,
  getGlobalSettings,
  getQuiz,
  getSessionMeta,
  joinInfo,
  listBankSources,
  listQuizzes,
  listSessions,
  loadBankQuestions,
  saveGlobalSettings,
  sanitizeSettingsInput,
  updateQuiz,
  type BankSourceType,
} from './liveQuiz.service';

export const liveQuizAdminRouter = Router();

const ok = (res: Response, data: unknown, status = 200) => res.status(status).json({ status: 'success', data });
const param = (req: Request, key: string) => String(req.params[key] ?? '');
const parseBankType = (value: unknown): BankSourceType => {
  const type = String(value ?? '').toUpperCase();
  if (type !== 'TRYOUT' && type !== 'PRACTICE') throw new HttpError('Tipe sumber harus TRYOUT atau PRACTICE.', 422);
  return type;
};

/* Dashboard & pengaturan */
liveQuizAdminRouter.get('/dashboard', async (_req, res) => ok(res, await dashboardStats()));
liveQuizAdminRouter.get('/settings', async (_req, res) => ok(res, await getGlobalSettings()));
liveQuizAdminRouter.put('/settings', validateResource(globalSettingsSchema), async (req, res) =>
  ok(res, await saveGlobalSettings((req.body as { settings: unknown }).settings)),
);

/* Kuis */
liveQuizAdminRouter.get('/quizzes', async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
  ok(res, await listQuizzes(search || undefined));
});
liveQuizAdminRouter.post('/quizzes', validateResource(createQuizSchema), async (req, res) =>
  ok(res, await createQuiz(req.user!.id, req.body as QuizBody), 201),
);
liveQuizAdminRouter.get('/quizzes/:id', async (req, res) => ok(res, await getQuiz(param(req, 'id'))));
liveQuizAdminRouter.put('/quizzes/:id', validateResource(updateQuizSchema), async (req, res) =>
  ok(res, await updateQuiz(param(req, 'id'), req.body as QuizBody)),
);
liveQuizAdminRouter.post('/quizzes/:id/duplicate', async (req, res) =>
  ok(res, await duplicateQuiz(param(req, 'id'), req.user!.id), 201),
);
liveQuizAdminRouter.delete('/quizzes/:id', async (req, res) => {
  const permanent = req.query.permanent === '1' || req.query.permanent === 'true';
  await deleteQuiz(param(req, 'id'), permanent);
  ok(res, { deleted: true });
});

/* Unggah gambar soal/pilihan */
liveQuizAdminRouter.post('/images', liveQuizImageUpload.single('image'), optimizeUploadedImages, (req, res) => {
  if (!req.file) throw new HttpError('File gambar wajib diunggah.', 400);
  ok(res, { url: buildPublicUploadPath(req.file.path) }, 201);
});

/* Bank soal (Tryout / Practice) */
liveQuizAdminRouter.get('/bank/sources', async (req, res) => {
  const type = parseBankType(req.query.type);
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
  ok(res, await listBankSources(type, search || undefined));
});
liveQuizAdminRouter.get('/bank/sources/:type/:sourceId/questions', async (req, res) =>
  ok(res, await loadBankQuestions(parseBankType(req.params.type), param(req, 'sourceId'))),
);

/* Sesi */
liveQuizAdminRouter.post('/sessions', validateResource(createSessionSchema), async (req, res) => {
  const body = req.body as { quizId: string; settings?: Record<string, unknown> };
  const created = await liveEngine.createSession({
    hostId: req.user!.id,
    quizId: body.quizId,
    settingsOverride: sanitizeSettingsInput(body.settings),
  });
  ok(res, { ...created, join: joinInfo(created.pin) }, 201);
});
liveQuizAdminRouter.get('/sessions', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const quizId = typeof req.query.quizId === 'string' ? req.query.quizId : undefined;
  ok(res, await listSessions({ page, pageSize, ...(status ? { status } : {}), ...(quizId ? { quizId } : {}) }));
});
liveQuizAdminRouter.delete('/sessions/:id', async (req, res) => {
  ok(res, await deleteSessionHistory(param(req, 'id')));
});
liveQuizAdminRouter.get('/sessions/:id', async (req, res) => ok(res, await getSessionMeta(param(req, 'id'))));
liveQuizAdminRouter.get('/sessions/:id/report', async (req, res) => ok(res, await buildReport(param(req, 'id'))));
liveQuizAdminRouter.get('/sessions/:id/players/:playerId', async (req, res) =>
  ok(res, await buildPlayerDetail(param(req, 'id'), param(req, 'playerId'))),
);
liveQuizAdminRouter.get('/sessions/:id/export.csv', async (req, res) => {
  const csv = await buildCsv(param(req, 'id'));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="live-quiz-${param(req, 'id')}.csv"`);
  res.send(csv);
});
