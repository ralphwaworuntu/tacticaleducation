import type { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import type { Namespace, Socket } from 'socket.io';
import { z } from 'zod';
import { env } from '../../config/env';
import { prisma } from '../../config/prisma';
import { liveEngine, type HostAction, type LiveEngine } from './liveEngine';
import { LIVE_EVENTS, type LiveEmitter } from './live.types';

type SocketData =
  | { role: 'host'; sessionId: string; userId: string }
  | { role: 'player'; sessionId: string; playerId: string };

type LiveSocket = Socket;
type Ack = (response: Record<string, unknown>) => void;

const hostRoom = (sessionId: string) => `s:${sessionId}:host`;
const playersRoom = (sessionId: string) => `s:${sessionId}:players`;
const playerRoom = (playerId: string) => `p:${playerId}`;

/* ---------------------------------------------------------------------- */
/* Validasi payload                                                        */
/* ---------------------------------------------------------------------- */

const handshakeSchema = z.discriminatedUnion('role', [
  z.object({ role: z.literal('host'), sessionId: z.string().min(1).max(40), token: z.string().min(10).max(4000) }),
  z.object({ role: z.literal('player'), sessionId: z.string().min(1).max(40), playerToken: z.string().min(10).max(200) }),
]);

const hostActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('start') }),
  z.object({ type: z.literal('next'), version: z.number().int().min(0) }),
  z.object({ type: z.literal('pause') }),
  z.object({ type: z.literal('resume') }),
  z.object({ type: z.literal('lock'), locked: z.boolean() }),
  z.object({ type: z.literal('kick'), playerId: z.string().min(1).max(40) }),
  z.object({
    type: z.literal('set_reactions'),
    enabled: z.boolean().optional(),
    afterSubmit: z.boolean().optional(),
    onProjector: z.boolean().optional(),
  }),
  z.object({ type: z.literal('end') }),
  z.object({ type: z.literal('cancel') }),
]);

const avatarSchema = z.object({ avatarId: z.string().min(1).max(32) });
const reactionSchema = z.object({ emoji: z.string().min(1).max(20) });

const answerSchema = z.object({
  questionIndex: z.number().int().min(0).max(1000),
  optionIds: z.array(z.string().min(1).max(40)).min(1).max(10),
});

/* ---------------------------------------------------------------------- */
/* Rate limit per socket (jendela geser sederhana)                         */
/* ---------------------------------------------------------------------- */

const LIMITS: Record<string, { max: number; windowMs: number }> = {
  submit_answer: { max: 8, windowMs: 5_000 },
  host_action: { max: 30, windowMs: 10_000 },
  request_sync: { max: 6, windowMs: 10_000 },
  time_sync: { max: 20, windowMs: 10_000 },
  set_avatar: { max: 6, windowMs: 10_000 },
  // Lebih longgar dari aturan engine (1/3 dtk) agar penolakan "cooldown" tetap informatif; ini hanya perisai spam.
  player_reaction_sent: { max: 10, windowMs: 10_000 },
};

function createLimiter() {
  const hits = new Map<string, number[]>();
  return (event: string): boolean => {
    const limit = LIMITS[event];
    if (!limit) return true;
    const now = Date.now();
    const recent = (hits.get(event) ?? []).filter((t) => now - t < limit.windowMs);
    if (recent.length >= limit.max) {
      hits.set(event, recent);
      return false;
    }
    recent.push(now);
    hits.set(event, recent);
    return true;
  };
}

/* ---------------------------------------------------------------------- */
/* Autentikasi host                                                        */
/* ---------------------------------------------------------------------- */

async function verifyHostToken(token: string): Promise<string | null> {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as { sub: string; role: string };
    if (payload.role !== 'ADMIN') return null;
    const account = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { isActive: true, role: true },
    });
    if (!account || !account.isActive || account.role !== 'ADMIN') return null;
    return payload.sub;
  } catch {
    return null;
  }
}

/* ---------------------------------------------------------------------- */
/* Gateway                                                                 */
/* ---------------------------------------------------------------------- */

export function attachLiveGateway(httpServer: HttpServer, engine: LiveEngine = liveEngine) {
  const allowedOrigins = env.FRONTEND_URL.split(',').map((origin) => origin.trim());
  const io = new Server(httpServer, {
    path: '/socket.io',
    serveClient: false,
    maxHttpBufferSize: 64 * 1024,
    pingInterval: 10_000,
    pingTimeout: 15_000,
    connectTimeout: 10_000,
    cors: {
      origin: (origin, callback) => {
        if (!origin || env.NODE_ENV !== 'production' || allowedOrigins.includes(origin) || origin === env.APP_URL) {
          callback(null, true);
          return;
        }
        callback(new Error('Origin tidak diizinkan'));
      },
      credentials: true,
    },
  });
  const ns: Namespace = io.of('/live');

  const emitter: LiveEmitter = {
    toHost: (sessionId, event, payload) => {
      ns.to(hostRoom(sessionId)).emit(event, payload);
    },
    toPlayers: (sessionId, event, payload) => {
      ns.to(playersRoom(sessionId)).emit(event, payload);
    },
    toPlayer: (playerId, event, payload) => {
      ns.to(playerRoom(playerId)).emit(event, payload);
    },
    disconnectPlayer: (playerId) => {
      void ns
        .in(playerRoom(playerId))
        .fetchSockets()
        .then((sockets) => sockets.forEach((s) => s.disconnect(true)));
    },
  };
  engine.setEmitter(emitter);

  // Hitung koneksi per pemain agar buka dua tab tidak menandai offline saat satu tab ditutup.
  const playerSocketCount = new Map<string, number>();

  ns.use(async (socket, next) => {
    try {
      const parsed = handshakeSchema.safeParse(socket.handshake.auth);
      if (!parsed.success) return next(new Error('unauthorized'));
      const auth = parsed.data;
      if (auth.role === 'host') {
        const userId = await verifyHostToken(auth.token);
        if (!userId) return next(new Error('unauthorized'));
        const hostId = await engine.getHostId(auth.sessionId);
        if (!hostId) return next(new Error('session_not_found'));
        if (hostId !== userId) return next(new Error('forbidden'));
        socket.data = { role: 'host', sessionId: auth.sessionId, userId } satisfies SocketData;
        return next();
      }
      const player = await engine.authenticatePlayer(auth.sessionId, auth.playerToken);
      if (!player) return next(new Error('unauthorized'));
      socket.data = { role: 'player', sessionId: auth.sessionId, playerId: player.id } satisfies SocketData;
      return next();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[live-quiz] handshake gagal', error);
      return next(new Error('server_error'));
    }
  });

  ns.on('connection', (rawSocket) => {
    const socket = rawSocket as unknown as LiveSocket;
    const data = socket.data as SocketData;
    const allow = createLimiter();
    const respond = (ack: unknown, payload: Record<string, unknown>) => {
      if (typeof ack === 'function') (ack as Ack)(payload);
    };

    const sendSync = async () => {
      const sync =
        data.role === 'host'
          ? await engine.getSync(data.sessionId, { role: 'host' })
          : await engine.getSync(data.sessionId, { role: 'player', playerId: data.playerId });
      if (sync) socket.emit(LIVE_EVENTS.sessionStateSync, sync);
    };

    if (data.role === 'host') {
      void socket.join(hostRoom(data.sessionId));
    } else {
      void socket.join([playersRoom(data.sessionId), playerRoom(data.playerId)]);
      playerSocketCount.set(data.playerId, (playerSocketCount.get(data.playerId) ?? 0) + 1);
      void engine.onPlayerConnected(data.sessionId, data.playerId);
    }
    void sendSync().catch((error) => console.error('[live-quiz] sync gagal', error));

    socket.on('request_sync', (_payload: unknown, ack?: unknown) => {
      if (!allow('request_sync')) return respond(ack, { ok: false, code: 'rate_limited' });
      void sendSync()
        .then(() => respond(ack, { ok: true }))
        .catch(() => respond(ack, { ok: false, code: 'server_error' }));
    });

    socket.on('time_sync', (_payload: unknown, ack?: unknown) => {
      if (!allow('time_sync')) return respond(ack, { ok: false, code: 'rate_limited' });
      respond(ack, { ok: true, serverNow: Date.now() });
    });

    socket.on('host_action', (payload: unknown, ack?: unknown) => {
      if (data.role !== 'host') return respond(ack, { ok: false, code: 'forbidden' });
      if (!allow('host_action')) return respond(ack, { ok: false, code: 'rate_limited' });
      const parsed = hostActionSchema.safeParse(payload);
      if (!parsed.success) return respond(ack, { ok: false, code: 'invalid_payload' });
      void engine
        .hostAction(data.sessionId, data.userId, parsed.data as HostAction)
        .then((result) => respond(ack, { ...result }))
        .catch((error) => {
          console.error('[live-quiz] host_action gagal', error);
          respond(ack, { ok: false, code: 'server_error', message: 'Terjadi kesalahan server.' });
        });
    });

    // Ganti avatar: playerId SELALU dari autentikasi socket; payload klien tidak pernah menentukan siapa pemainnya.
    socket.on('set_avatar', (payload: unknown, ack?: unknown) => {
      if (data.role !== 'player') return respond(ack, { ok: false, code: 'forbidden' });
      if (!allow('set_avatar')) return respond(ack, { ok: false, code: 'rate_limited' });
      const parsed = avatarSchema.safeParse(payload);
      if (!parsed.success) return respond(ack, { ok: false, code: 'invalid_payload' });
      void engine
        .setPlayerAvatar(data.sessionId, data.playerId, parsed.data.avatarId)
        .then((result) => respond(ack, { ...result }))
        .catch((error) => {
          console.error('[live-quiz] set_avatar gagal', error);
          respond(ack, { ok: false, code: 'server_error', message: 'Terjadi kesalahan server.' });
        });
    });

    // Reaksi emoji: efemeral, tidak memengaruhi skor/timer/ranking. Pembatasan laju utama ada di engine.
    socket.on('player_reaction_sent', (payload: unknown, ack?: unknown) => {
      if (data.role !== 'player') return respond(ack, { ok: false, code: 'forbidden' });
      if (!allow('player_reaction_sent')) return respond(ack, { ok: false, code: 'rate_limited' });
      const parsed = reactionSchema.safeParse(payload);
      if (!parsed.success) return respond(ack, { ok: false, code: 'invalid_payload' });
      void engine
        .sendReaction(data.sessionId, data.playerId, parsed.data.emoji)
        .then((result) => respond(ack, { ...result }))
        .catch((error) => {
          console.error('[live-quiz] player_reaction_sent gagal', error);
          respond(ack, { ok: false, code: 'server_error', message: 'Terjadi kesalahan server.' });
        });
    });

    socket.on('submit_answer', (payload: unknown, ack?: unknown) => {
      // Waktu terima dicatat sedini mungkin; timestamp dari klien tidak pernah dipercaya.
      const receivedAt = Date.now();
      if (data.role !== 'player') return respond(ack, { ok: false, code: 'forbidden' });
      if (!allow('submit_answer')) return respond(ack, { ok: false, code: 'rate_limited' });
      const parsed = answerSchema.safeParse(payload);
      if (!parsed.success) return respond(ack, { ok: false, code: 'invalid_payload' });
      void engine
        .submitAnswer(data.sessionId, data.playerId, parsed.data, receivedAt)
        .then((result) => respond(ack, { ...result }))
        .catch((error) => {
          console.error('[live-quiz] submit_answer gagal', error);
          respond(ack, { ok: false, code: 'server_error', message: 'Terjadi kesalahan server.' });
        });
    });

    socket.on('disconnect', () => {
      if (data.role !== 'player') return;
      const remaining = (playerSocketCount.get(data.playerId) ?? 1) - 1;
      if (remaining > 0) {
        playerSocketCount.set(data.playerId, remaining);
        return;
      }
      playerSocketCount.delete(data.playerId);
      void engine.onPlayerDisconnected(data.sessionId, data.playerId);
    });
  });

  return {
    io,
    close: async () => {
      engine.shutdown();
      await io.close();
    },
  };
}
