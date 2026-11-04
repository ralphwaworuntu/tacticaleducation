import { Router } from 'express';
import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../../config/env';
import { prisma } from '../../config/prisma';
import { HttpError } from '../../middlewares/errorHandler';
import { validateResource } from '../../middlewares/validateResource';
import { liveEngine } from './liveEngine';

export const liveQuizPublicRouter = Router();

// Satu kelas biasanya berbagi satu IP (NAT), jadi batas dibuat longgar untuk keseluruhan,
// dan ketat hanya untuk percobaan GAGAL (mencegah tebak PIN 6 digit).
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Terlalu banyak permintaan. Coba lagi sebentar.' },
});
const failedAttemptLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 80,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Terlalu banyak percobaan gagal. Coba lagi beberapa menit lagi.' },
});

liveQuizPublicRouter.use(generalLimiter);

/** Login bersifat opsional: token tidak valid diperlakukan sebagai tamu. */
async function optionalUser(req: Request): Promise<{ id: string; name: string } | null> {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.split(' ')[1] : undefined;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as { sub: string };
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, isActive: true },
    });
    return user && user.isActive ? { id: user.id, name: user.name } : null;
  } catch {
    return null;
  }
}

const pinSchema = z.string().regex(/^\d{6}$/, 'PIN harus 6 digit angka.');

liveQuizPublicRouter.get('/pin/:pin', failedAttemptLimiter, async (req, res) => {
  const parsed = pinSchema.safeParse(req.params.pin);
  if (!parsed.success) throw new HttpError('PIN harus 6 digit angka.', 422);
  const info = await liveEngine.getPinInfo(parsed.data);
  if (!info) throw new HttpError('PIN tidak ditemukan atau sesi sudah berakhir.', 404);
  res.json({
    status: 'success',
    data: { title: info.title, joinable: info.joinable, reason: info.reason, status: info.status },
  });
});

const joinSchema = z.object({
  body: z.object({
    pin: pinSchema,
    name: z.string().trim().max(60).default(''),
    rejoinToken: z.string().min(10).max(200).nullable().optional(),
    // Opsional (klien lama tanpa avatar tetap berfungsi). ID tidak dikenal -> avatar default.
    avatarId: z.string().max(32).nullable().optional(),
  }),
});

liveQuizPublicRouter.post('/join', failedAttemptLimiter, validateResource(joinSchema), async (req, res) => {
  const body = req.body as { pin: string; name: string; rejoinToken?: string | null; avatarId?: string | null };
  const user = await optionalUser(req);
  const result = await liveEngine.joinPlayer({
    pin: body.pin,
    name: body.name || user?.name || '',
    userId: user?.id ?? null,
    rejoinToken: body.rejoinToken ?? null,
    avatarId: body.avatarId ?? null,
  });
  res.json({ status: 'success', data: result });
});

/** Pemulihan state pemain (mis. setelah sesi berakhir) memakai token pemain, tanpa login. */
liveQuizPublicRouter.get('/sessions/:sessionId/me', async (req, res) => {
  const token = String(req.headers['x-player-token'] ?? '');
  const sessionId = String(req.params.sessionId ?? '');
  const player = token ? await liveEngine.authenticatePlayer(sessionId, token) : null;
  if (!player) throw new HttpError('Token pemain tidak valid.', 401);
  const sync = await liveEngine.getSync(sessionId, { role: 'player', playerId: player.id });
  res.json({ status: 'success', data: sync });
});
