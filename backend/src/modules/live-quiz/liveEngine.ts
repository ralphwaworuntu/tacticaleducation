import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '../../config/prisma';
import { HttpError } from '../../middlewares/errorHandler';
import {
  ALLOWED_TIME_LIMITS,
  LIVE_QUIZ_SETTINGS_KEY,
  MAX_OPTIONS,
  MIN_OPTIONS,
  resolveQuizSettings,
  type QuizSettings,
} from './live.settings';
import { isAvatarId, normalizeAvatarId, type AvatarId } from './liveAvatars';
import { rankPlayers } from './liveRanking';
import {
  REACTION_BATCH_MS,
  ReactionState,
  checkReactionPhase,
  isReactionId,
  type ReactionBatch,
  type ReactionRejectCode,
} from './liveReactions';
import {
  computeAccuracy,
  computeScore,
  isAnswerCorrect,
  maxPointsForWeight,
  type QuestionType,
  type QuestionWeight,
} from './liveScoring';
import {
  generatePin,
  generatePlayerToken,
  hashPlayerToken,
  playerNameKey,
  sanitizePlayerName,
  shuffled,
} from './liveText';
import {
  LIVE_EVENTS,
  NOOP_EMITTER,
  isTerminalPhase,
  type EngineResult,
  type LeaderboardEntry,
  type LiveEmitter,
  type LivePhase,
  type LobbyPlayer,
  type PublicQuestion,
  type SessionSnapshot,
  type SnapshotQuestion,
} from './live.types';

type RtPlayer = {
  id: string;
  userId: string | null;
  name: string;
  /** Selalu ID avatar valid (default deterministik bila pemain tidak memilih). */
  avatarId: AvatarId;
  tokenHash: string;
  connected: boolean;
  kicked: boolean;
  joinedAt: number;
  totalScore: number;
  correctCount: number;
  correctTimeMs: number;
  /** Jumlah soal yang sudah ditutup dan dijawab pemain ini. */
  answeredCount: number;
  rank: number | null;
};

type RtAnswer = {
  optionIds: string[];
  isCorrect: boolean;
  score: number;
  responseMs: number;
  receivedAt: number;
};

type PhaseEntry = { host: Record<string, unknown>; byPlayer: Map<string, Record<string, unknown>> };

type PhaseCache = {
  countdown?: Record<string, unknown>;
  question?: { host: Record<string, unknown>; player: Record<string, unknown> };
  result?: PhaseEntry;
  score?: PhaseEntry;
  leaderboard?: PhaseEntry;
  final?: PhaseEntry;
};

type Runtime = {
  id: string;
  hostId: string;
  pin: string;
  title: string;
  snapshot: SessionSnapshot;
  settings: QuizSettings;
  status: LivePhase;
  currentIndex: number;
  version: number;
  phaseStartedAt: number | null;
  phaseDeadlineAt: number | null;
  paused: boolean;
  lobbyLocked: boolean;
  players: Map<string, RtPlayer>;
  tokenIndex: Map<string, string>;
  /** Jawaban untuk soal aktif/terakhir (key = playerId). */
  answers: Map<string, RtAnswer>;
  prevRanks: Map<string, number>;
  timer: NodeJS.Timeout | null;
  queue: Promise<void>;
  cache: PhaseCache;
  evictTimer: NodeJS.Timeout | null;
  /** Reaksi emoji: efemeral, hanya di memori. */
  reactions: ReactionState;
};

export type CreateSessionInput = {
  hostId: string;
  quizId: string;
  settingsOverride?: unknown;
};

export type CreateSessionResult = {
  id: string;
  pin: string;
  status: LivePhase;
  title: string;
  totalQuestions: number;
  settings: QuizSettings;
};

export type JoinInput = {
  pin: string;
  name: string;
  userId?: string | null;
  rejoinToken?: string | null;
  /** Opsional; ID tidak dikenal diganti avatar default. Diabaikan saat rejoin (avatar lama dipertahankan). */
  avatarId?: string | null;
};

export type JoinResult = {
  sessionId: string;
  playerId: string;
  playerToken: string;
  displayName: string;
  avatarId: AvatarId;
  status: LivePhase;
  rejoined: boolean;
};

export type HostAction =
  | { type: 'start' }
  | { type: 'next'; version: number }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'lock'; locked: boolean }
  | { type: 'kick'; playerId: string }
  | { type: 'set_reactions'; enabled?: boolean; afterSubmit?: boolean; onProjector?: boolean }
  | { type: 'end' }
  | { type: 'cancel' };

export type ReactionResult =
  | { ok: true }
  | { ok: false; code: ReactionRejectCode | (string & {}); message: string; retryAfterMs?: number };

export type AnswerInput = { questionIndex: number; optionIds: string[] };
export type AnswerAck = {
  questionIndex: number;
  duplicate: boolean;
  version: number;
  receivedAt: number;
};

const STALE_SESSION_MS = 12 * 60 * 60 * 1000;
const RUNTIME_EVICT_MS = 30 * 60 * 1000;
const MAX_PIN_ATTEMPTS = 25;

function fail(code: string, message: string): { ok: false; code: string; message: string } {
  return { ok: false, code, message };
}

function isUniqueViolation(error: unknown, field?: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
  if (!field) return true;
  return JSON.stringify(error.meta?.target ?? '').includes(field);
}

export class LiveEngine {
  private emitter: LiveEmitter = NOOP_EMITTER;
  private readonly runtimes = new Map<string, Runtime>();
  private readonly loading = new Map<string, Promise<Runtime | null>>();

  constructor(
    private readonly db: PrismaClient = defaultPrisma,
    private readonly now: () => number = () => Date.now(),
  ) {}

  setEmitter(emitter: LiveEmitter) {
    this.emitter = emitter;
  }

  /* ------------------------------------------------------------------ */
  /* Sesi: pembuatan, PIN, join                                          */
  /* ------------------------------------------------------------------ */

  async createSession(input: CreateSessionInput): Promise<CreateSessionResult> {
    const quiz = await this.db.quiz.findUnique({
      where: { id: input.quizId },
      include: {
        questions: { orderBy: { order: 'asc' }, include: { options: { orderBy: { order: 'asc' } } } },
      },
    });
    if (!quiz) throw new HttpError('Kuis tidak ditemukan.', 404);
    if (!quiz.questions.length) throw new HttpError('Kuis belum memiliki soal.', 422);

    const globalRow = await this.db.siteSetting.findUnique({ where: { key: LIVE_QUIZ_SETTINGS_KEY } });
    let globalSettings: unknown = null;
    if (globalRow?.value) {
      try {
        globalSettings = JSON.parse(globalRow.value);
      } catch {
        globalSettings = null;
      }
    }
    const settings = resolveQuizSettings(globalSettings, quiz.settings, input.settingsOverride);

    const problems: string[] = [];
    quiz.questions.forEach((question, index) => {
      const label = `Soal ${index + 1}`;
      const optionCount = question.options.length;
      const correctCount = question.options.filter((o) => o.isCorrect).length;
      if (!question.prompt.trim() && !question.imageUrl) problems.push(`${label}: teks soal kosong.`);
      if (optionCount < MIN_OPTIONS || optionCount > MAX_OPTIONS) {
        problems.push(`${label}: jumlah pilihan harus ${MIN_OPTIONS}-${MAX_OPTIONS}.`);
      }
      if (question.type === 'TRUE_FALSE' && optionCount !== 2) problems.push(`${label}: Benar/Salah harus 2 pilihan.`);
      if (question.type !== 'MULTIPLE' && correctCount !== 1) problems.push(`${label}: harus tepat satu jawaban benar.`);
      if (question.type === 'MULTIPLE' && correctCount < 1) problems.push(`${label}: minimal satu jawaban benar.`);
      if (question.options.some((o) => !o.label.trim() && !o.imageUrl)) problems.push(`${label}: ada pilihan kosong.`);
    });
    if (problems.length) throw new HttpError('Kuis belum valid untuk dimainkan.', 422, { problems });

    const ordered = settings.shuffleQuestions ? shuffled(quiz.questions) : quiz.questions;
    const snapshot: SessionSnapshot = {
      quizId: quiz.id,
      title: quiz.title,
      questions: ordered.map((question, index) => {
        const options = settings.shuffleOptions && question.type !== 'TRUE_FALSE' ? shuffled(question.options) : question.options;
        const limit = question.timeLimitSec ?? settings.timeLimitSec;
        return {
          id: question.id,
          index,
          type: question.type as QuestionType,
          prompt: question.prompt,
          imageUrl: question.imageUrl,
          timeLimitSec: (ALLOWED_TIME_LIMITS as readonly number[]).includes(limit) ? limit : settings.timeLimitSec,
          weight: question.weight as QuestionWeight,
          options: options.map((option) => ({
            id: option.id,
            label: option.label,
            imageUrl: option.imageUrl,
            isCorrect: option.isCorrect,
          })),
        };
      }),
    };

    // PIN unik di antara sesi aktif dijaga constraint UNIQUE pada activePin.
    for (let attempt = 0; attempt < MAX_PIN_ATTEMPTS; attempt += 1) {
      const pin = generatePin();
      try {
        const created = await this.db.liveSession.create({
          data: {
            quizId: quiz.id,
            hostId: input.hostId,
            pin,
            activePin: pin,
            status: 'LOBBY',
            settings: settings as unknown as Prisma.InputJsonValue,
            snapshot: snapshot as unknown as Prisma.InputJsonValue,
          },
        });
        await this.getRuntime(created.id);
        return {
          id: created.id,
          pin,
          status: 'LOBBY',
          title: quiz.title,
          totalQuestions: snapshot.questions.length,
          settings,
        };
      } catch (error) {
        if (isUniqueViolation(error, 'activePin')) continue;
        throw error;
      }
    }
    throw new HttpError('Gagal membuat PIN unik. Coba lagi.', 503);
  }

  async getPinInfo(pin: string) {
    if (!/^\d{6}$/.test(pin)) return null;
    const row = await this.db.liveSession.findUnique({
      where: { activePin: pin },
      select: { id: true, status: true, lobbyLocked: true, settings: true, snapshot: true },
    });
    if (!row) return null;
    const settings = resolveQuizSettings(row.settings);
    const status = row.status as LivePhase;
    const joinable = !row.lobbyLocked && (status === 'LOBBY' || settings.allowLateJoin);
    const snapshot = row.snapshot as unknown as SessionSnapshot;
    return {
      sessionId: row.id,
      title: snapshot.title,
      status,
      joinable,
      reason: joinable ? null : row.lobbyLocked ? 'Lobby terkunci oleh tutor.' : 'Permainan sudah dimulai.',
    };
  }

  async joinPlayer(input: JoinInput): Promise<JoinResult> {
    const info = await this.db.liveSession.findUnique({
      where: { activePin: input.pin },
      select: { id: true },
    });
    if (!info) throw new HttpError('PIN tidak ditemukan atau sesi sudah berakhir.', 404);
    const rt = await this.getRuntime(info.id);
    if (!rt || isTerminalPhase(rt.status)) throw new HttpError('Sesi sudah berakhir.', 410);

    // 1) Reconnect memakai token yang masih valid.
    if (input.rejoinToken) {
      const existingId = rt.tokenIndex.get(hashPlayerToken(input.rejoinToken));
      const existing = existingId ? rt.players.get(existingId) : undefined;
      if (existing) {
        if (existing.kicked) throw new HttpError('Anda dikeluarkan dari sesi ini oleh tutor.', 403);
        return {
          sessionId: rt.id,
          playerId: existing.id,
          playerToken: input.rejoinToken,
          displayName: existing.name,
          avatarId: existing.avatarId,
          status: rt.status,
          rejoined: true,
        };
      }
    }

    // 2) Akun login: identitas tetap berdasarkan userId (token dirotasi).
    if (input.userId) {
      const existing = [...rt.players.values()].find((p) => p.userId === input.userId);
      if (existing) {
        if (existing.kicked) throw new HttpError('Anda dikeluarkan dari sesi ini oleh tutor.', 403);
        const token = generatePlayerToken();
        await this.rotateToken(rt, existing, token);
        return {
          sessionId: rt.id,
          playerId: existing.id,
          playerToken: token,
          displayName: existing.name,
          avatarId: existing.avatarId,
          status: rt.status,
          rejoined: true,
        };
      }
    }

    // 3) Pemain baru.
    const name = sanitizePlayerName(input.name);
    if (!name) throw new HttpError('Nama wajib diisi.', 422);
    if (rt.lobbyLocked) throw new HttpError('Lobby terkunci oleh tutor.', 403);
    if (rt.status !== 'LOBBY' && !rt.settings.allowLateJoin) {
      throw new HttpError('Permainan sudah dimulai.', 403);
    }
    const activeCount = [...rt.players.values()].filter((p) => !p.kicked).length;
    if (activeCount >= rt.settings.maxPlayers) throw new HttpError('Sesi sudah penuh.', 403);

    const token = generatePlayerToken();
    const tokenHash = hashPlayerToken(token);
    let created;
    try {
      created = await this.db.livePlayer.create({
        data: {
          sessionId: rt.id,
          userId: input.userId ?? null,
          displayName: name,
          avatarId: isAvatarId(input.avatarId) ? input.avatarId : null,
          nameKey: playerNameKey(name),
          tokenHash,
          isConnected: false,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error, 'nameKey')) {
        throw new HttpError('Nama sudah dipakai di sesi ini. Gunakan nama lain.', 409);
      }
      if (isUniqueViolation(error, 'userId')) {
        throw new HttpError('Akun ini sudah bergabung di sesi ini.', 409);
      }
      throw error;
    }

    const player: RtPlayer = {
      id: created.id,
      userId: created.userId,
      name: created.displayName,
      avatarId: normalizeAvatarId(created.avatarId, created.id),
      tokenHash,
      connected: false,
      kicked: false,
      joinedAt: created.joinedAt.getTime(),
      totalScore: 0,
      correctCount: 0,
      correctTimeMs: 0,
      answeredCount: 0,
      rank: null,
    };
    rt.players.set(player.id, player);
    rt.tokenIndex.set(tokenHash, player.id);

    this.emitter.toHost(rt.id, LIVE_EVENTS.playerJoined, {
      player: this.toLobbyPlayer(player),
      count: this.activePlayers(rt).length,
      version: rt.version,
    });
    this.emitLobby(rt);

    return {
      sessionId: rt.id,
      playerId: player.id,
      playerToken: token,
      displayName: player.name,
      avatarId: player.avatarId,
      status: rt.status,
      rejoined: false,
    };
  }

  private async rotateToken(rt: Runtime, player: RtPlayer, token: string) {
    const tokenHash = hashPlayerToken(token);
    await this.db.livePlayer.update({ where: { id: player.id }, data: { tokenHash } });
    rt.tokenIndex.delete(player.tokenHash);
    player.tokenHash = tokenHash;
    rt.tokenIndex.set(tokenHash, player.id);
  }

  /* ------------------------------------------------------------------ */
  /* Autentikasi & koneksi socket                                        */
  /* ------------------------------------------------------------------ */

  async getHostId(sessionId: string): Promise<string | null> {
    const rt = await this.getRuntime(sessionId);
    return rt?.hostId ?? null;
  }

  async authenticatePlayer(sessionId: string, token: string): Promise<{ id: string; name: string } | null> {
    const rt = await this.getRuntime(sessionId);
    if (!rt) return null;
    const playerId = rt.tokenIndex.get(hashPlayerToken(token));
    const player = playerId ? rt.players.get(playerId) : undefined;
    if (!player || player.kicked) return null;
    return { id: player.id, name: player.name };
  }

  async onPlayerConnected(sessionId: string, playerId: string) {
    const rt = await this.getRuntime(sessionId);
    const player = rt?.players.get(playerId);
    if (!rt || !player || player.kicked) return;
    const wasConnected = player.connected;
    player.connected = true;
    await this.db.livePlayer
      .update({ where: { id: playerId }, data: { isConnected: true, lastSeenAt: new Date(this.now()) } })
      .catch(() => undefined);
    if (!wasConnected) {
      this.emitter.toHost(rt.id, LIVE_EVENTS.playerReconnected, {
        player: this.toLobbyPlayer(player),
        version: rt.version,
      });
      this.emitLobby(rt);
    }
  }

  async onPlayerDisconnected(sessionId: string, playerId: string) {
    const rt = await this.getRuntime(sessionId);
    const player = rt?.players.get(playerId);
    if (!rt || !player) return;
    player.connected = false;
    await this.db.livePlayer
      .update({ where: { id: playerId }, data: { isConnected: false, lastSeenAt: new Date(this.now()) } })
      .catch(() => undefined);
    // Data pemain dan skor TIDAK dihapus saat koneksi putus.
    this.emitter.toHost(rt.id, LIVE_EVENTS.playerLeft, {
      playerId,
      reason: 'disconnected',
      count: this.activePlayers(rt).length,
      version: rt.version,
    });
    this.emitLobby(rt);
    if (rt.status === 'QUESTION_ACTIVE') {
      await this.exclusive(rt, async () => {
        if (rt.status === 'QUESTION_ACTIVE' && this.shouldAutoClose(rt)) {
          await this.closeQuestionLocked(rt, rt.currentIndex);
        }
      }).catch((error) => this.logError('auto-close setelah disconnect', error));
    }
  }

  /* ------------------------------------------------------------------ */
  /* Aksi host                                                           */
  /* ------------------------------------------------------------------ */

  async hostAction(sessionId: string, hostId: string, action: HostAction): Promise<EngineResult<{ ignored?: boolean }>> {
    const rt = await this.getRuntime(sessionId);
    if (!rt) return fail('not_found', 'Sesi tidak ditemukan.');
    if (rt.hostId !== hostId) return fail('forbidden', 'Anda bukan host sesi ini.');
    return this.exclusive(rt, () => this.hostActionLocked(rt, action));
  }

  private async hostActionLocked(rt: Runtime, action: HostAction): Promise<EngineResult<{ ignored?: boolean }>> {
    if (isTerminalPhase(rt.status) && action.type !== 'lock') {
      return fail('session_closed', 'Sesi sudah berakhir.');
    }

    switch (action.type) {
      case 'start': {
        if (rt.status !== 'LOBBY') return { ok: true, ignored: true };
        if (this.activePlayers(rt).length < 1) return fail('no_players', 'Belum ada peserta yang bergabung.');
        if (rt.settings.lockLobbyOnStart) rt.lobbyLocked = true;
        const startsAt = this.now() + rt.settings.countdownSec * 1000;
        await this.setPhase(rt, 'COUNTDOWN', {
          index: -1,
          startedAt: this.now(),
          deadlineAt: startsAt,
          extra: { lobbyLocked: rt.lobbyLocked, startedAt: new Date(this.now()) },
        });
        rt.cache = {
          countdown: {
            version: rt.version,
            countdownMs: rt.settings.countdownSec * 1000,
            startedAt: rt.phaseStartedAt,
            deadlineAt: rt.phaseDeadlineAt,
          },
        };
        this.emitter.toHost(rt.id, LIVE_EVENTS.gameStarting, { ...rt.cache.countdown, serverNow: this.now() });
        this.emitter.toPlayers(rt.id, LIVE_EVENTS.gameStarting, { ...rt.cache.countdown, serverNow: this.now() });
        this.schedule(rt, startsAt, 'countdown', () => this.openQuestionLocked(rt, 0));
        return { ok: true };
      }

      case 'next': {
        if (action.version !== rt.version) return { ok: true, ignored: true };
        switch (rt.status) {
          case 'QUESTION_ACTIVE':
            await this.closeQuestionLocked(rt, rt.currentIndex);
            return { ok: true };
          case 'QUESTION_RESULT':
            await this.enterScoreResultLocked(rt);
            return { ok: true };
          case 'SCORE_RESULT':
            await this.enterLeaderboardLocked(rt);
            return { ok: true };
          case 'LEADERBOARD':
            await this.advanceLocked(rt);
            return { ok: true };
          default:
            return fail('invalid_state', 'Aksi tidak tersedia pada tahap ini.');
        }
      }

      case 'pause': {
        if (!['QUESTION_RESULT', 'SCORE_RESULT', 'LEADERBOARD'].includes(rt.status)) {
          return fail('invalid_state', 'Jeda hanya tersedia di antara soal.');
        }
        if (rt.paused) return { ok: true, ignored: true };
        rt.paused = true;
        this.clearTimer(rt);
        await this.db.liveSession.update({ where: { id: rt.id }, data: { paused: true } });
        this.emitPause(rt);
        return { ok: true };
      }

      case 'resume': {
        if (!rt.paused) return { ok: true, ignored: true };
        rt.paused = false;
        await this.db.liveSession.update({ where: { id: rt.id }, data: { paused: false } });
        this.scheduleDisplayTransition(rt);
        this.emitPause(rt);
        return { ok: true };
      }

      case 'lock': {
        rt.lobbyLocked = action.locked;
        await this.db.liveSession.update({ where: { id: rt.id }, data: { lobbyLocked: action.locked } });
        this.emitLobby(rt);
        return { ok: true };
      }

      case 'set_reactions': {
        // Pengaturan reaksi per sesi. Tidak menyentuh skor/timer/ranking.
        const next = {
          reactionsEnabled: action.enabled ?? rt.settings.reactionsEnabled,
          reactionsAfterSubmit: action.afterSubmit ?? rt.settings.reactionsAfterSubmit,
          reactionsOnProjector: action.onProjector ?? rt.settings.reactionsOnProjector,
        };
        const changed = (Object.keys(next) as Array<keyof typeof next>).some((k) => next[k] !== rt.settings[k]);
        if (!changed) return { ok: true, ignored: true };
        rt.settings = { ...rt.settings, ...next };
        await this.db.liveSession.update({
          where: { id: rt.id },
          data: { settings: rt.settings as unknown as Prisma.InputJsonValue },
        });
        const payload = {
          reactionsEnabled: rt.settings.reactionsEnabled,
          reactionsAfterSubmit: rt.settings.reactionsAfterSubmit,
          reactionsOnProjector: rt.settings.reactionsOnProjector,
          serverNow: this.now(),
        };
        this.emitter.toHost(rt.id, LIVE_EVENTS.reactionsEnabledChanged, payload);
        this.emitter.toPlayers(rt.id, LIVE_EVENTS.reactionsEnabledChanged, payload);
        return { ok: true };
      }

      case 'kick': {
        const player = rt.players.get(action.playerId);
        if (!player) return fail('not_found', 'Peserta tidak ditemukan.');
        if (player.kicked) return { ok: true, ignored: true };
        player.kicked = true;
        player.connected = false;
        await this.db.livePlayer.update({
          where: { id: player.id },
          data: { kickedAt: new Date(this.now()), isConnected: false },
        });
        this.emitter.toPlayer(player.id, LIVE_EVENTS.kicked, { reason: 'Anda dikeluarkan oleh tutor.' });
        this.emitter.disconnectPlayer(player.id, 'kicked');
        this.emitter.toHost(rt.id, LIVE_EVENTS.playerLeft, {
          playerId: player.id,
          reason: 'kicked',
          count: this.activePlayers(rt).length,
          version: rt.version,
        });
        this.emitLobby(rt);
        if (rt.status === 'QUESTION_ACTIVE' && this.shouldAutoClose(rt)) {
          await this.closeQuestionLocked(rt, rt.currentIndex);
        }
        return { ok: true };
      }

      case 'end': {
        if (rt.status === 'LOBBY') {
          await this.cancelLocked(rt);
          return { ok: true };
        }
        await this.finishLocked(rt, true);
        return { ok: true };
      }

      case 'cancel': {
        await this.cancelLocked(rt);
        return { ok: true };
      }

      default:
        return fail('unknown_action', 'Aksi tidak dikenal.');
    }
  }

  /* ------------------------------------------------------------------ */
  /* Avatar & reaksi (Live Quiz 2.0)                                      */
  /* ------------------------------------------------------------------ */

  /**
   * Ganti avatar milik pemain itu sendiri (playerId berasal dari autentikasi socket, bukan dari klien).
   * Hanya di LOBBY dan bila host mengizinkan.
   */
  async setPlayerAvatar(
    sessionId: string,
    playerId: string,
    avatarId: unknown,
  ): Promise<EngineResult<{ avatarId: AvatarId }>> {
    const rt = await this.getRuntime(sessionId);
    if (!rt) return fail('not_found', 'Sesi tidak ditemukan.');
    if (!isAvatarId(avatarId)) return fail('invalid_avatar', 'Karakter tidak dikenal.');
    return this.exclusive(rt, async () => {
      const player = rt.players.get(playerId);
      if (!player || player.kicked) return fail('not_found', 'Pemain tidak ditemukan.');
      if (rt.status !== 'LOBBY') return fail('phase_not_allowed', 'Karakter hanya bisa diganti di lobby.');
      if (!rt.settings.allowAvatarChange) return fail('avatar_locked', 'Tutor tidak mengizinkan ganti karakter.');
      if (player.avatarId === avatarId) return { ok: true, avatarId };
      await this.db.livePlayer.update({ where: { id: player.id }, data: { avatarId } });
      player.avatarId = avatarId;
      this.emitter.toHost(rt.id, LIVE_EVENTS.playerAvatarUpdated, {
        player: this.toLobbyPlayer(player),
        version: rt.version,
      });
      this.emitter.toPlayer(player.id, LIVE_EVENTS.playerAvatarUpdated, { avatarId });
      this.emitLobby(rt);
      return { ok: true, avatarId };
    });
  }

  /**
   * Terima reaksi emoji dari pemain. SENGAJA tidak memakai antrean serial sesi (tidak ada I/O DB dan tidak
   * menyentuh state skor), sehingga burst reaksi tidak menunda transisi fase atau pengiriman jawaban.
   * Seluruh pengecekan + pencatatan laju berjalan sinkron setelah runtime tersedia.
   */
  async sendReaction(
    sessionId: string,
    playerId: string,
    emoji: unknown,
  ): Promise<ReactionResult> {
    const rt = this.runtimes.get(sessionId) ?? (await this.getRuntime(sessionId));
    if (!rt) return fail('not_found', 'Sesi tidak ditemukan.');
    const player = rt.players.get(playerId);
    if (!player || player.kicked) return fail('not_found', 'Pemain tidak ditemukan.');
    if (!isReactionId(emoji)) {
      return { ok: false, code: 'invalid_emoji', message: 'Emoji tidak dikenal.' };
    }
    const phase = checkReactionPhase(rt.status, rt.settings, rt.answers.has(player.id));
    if (!phase.ok) return phase;
    const admitted = rt.reactions.admit(player.id, this.now());
    if (!admitted.ok) return admitted;

    rt.reactions.enqueue({
      playerId: player.id,
      name: player.name,
      avatarId: player.avatarId,
      emoji,
      at: this.now(),
    });
    if (!rt.reactions.timer) {
      rt.reactions.timer = setTimeout(() => this.flushReactions(rt), REACTION_BATCH_MS);
      rt.reactions.timer.unref?.();
    }
    return { ok: true };
  }

  private flushReactions(rt: Runtime) {
    rt.reactions.timer = null;
    const batch: ReactionBatch | null = rt.reactions.drain();
    if (!batch) return;
    const serverNow = this.now();
    // Host: item bernama + avatar (kecuali host menyembunyikan reaksi dari proyektor).
    if (rt.settings.reactionsOnProjector && rt.settings.reactionsEnabled) {
      this.emitter.toHost(rt.id, LIVE_EVENTS.liveReactionBroadcast, {
        items: batch.items,
        counts: batch.counts,
        total: batch.total,
        serverNow,
      });
    }
    // Pemain: hanya hitungan agregat, tanpa nama.
    if (rt.settings.reactionsEnabled) {
      this.emitter.toPlayers(rt.id, LIVE_EVENTS.liveReactionBroadcast, {
        counts: batch.counts,
        total: batch.total,
        serverNow,
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Jawaban siswa                                                       */
  /* ------------------------------------------------------------------ */

  /**
   * @param receivedAtMs waktu server saat event diterima (diambil SEBELUM antrean) --
   *   dipakai untuk validasi deadline dan durasi respons. Timestamp klien tidak dipakai.
   */
  async submitAnswer(
    sessionId: string,
    playerId: string,
    input: AnswerInput,
    receivedAtMs: number,
  ): Promise<EngineResult<{ ack: AnswerAck }>> {
    const rt = await this.getRuntime(sessionId);
    if (!rt) return fail('not_found', 'Sesi tidak ditemukan.');
    return this.exclusive(rt, () => this.submitAnswerLocked(rt, playerId, input, receivedAtMs));
  }

  private async submitAnswerLocked(
    rt: Runtime,
    playerId: string,
    input: AnswerInput,
    receivedAtMs: number,
  ): Promise<EngineResult<{ ack: AnswerAck }>> {
    const player = rt.players.get(playerId);
    if (!player || player.kicked) return fail('forbidden', 'Anda tidak terdaftar di sesi ini.');

    if (rt.status !== 'QUESTION_ACTIVE' || input.questionIndex !== rt.currentIndex) {
      return fail('question_closed', 'Soal sudah ditutup.');
    }

    // Retry aman: jawaban final yang sudah tersimpan dikembalikan sebagai duplikat (tanpa skor ganda).
    const existing = rt.answers.get(playerId);
    if (existing) {
      return {
        ok: true,
        ack: { questionIndex: rt.currentIndex, duplicate: true, version: rt.version, receivedAt: existing.receivedAt },
      };
    }

    if (rt.phaseStartedAt === null || rt.phaseDeadlineAt === null) return fail('question_closed', 'Soal sudah ditutup.');
    if (receivedAtMs > rt.phaseDeadlineAt) return fail('late', 'Waktu habis.');

    const question = rt.snapshot.questions[rt.currentIndex];
    if (!question) return fail('question_closed', 'Soal tidak tersedia.');

    const optionIds = [...new Set(input.optionIds)];
    const validIds = new Set(question.options.map((o) => o.id));
    if (!optionIds.length || optionIds.some((id) => !validIds.has(id))) {
      return fail('invalid_answer', 'Pilihan jawaban tidak valid.');
    }
    if (question.type !== 'MULTIPLE' && optionIds.length !== 1) {
      return fail('invalid_answer', 'Pilih tepat satu jawaban.');
    }

    const correctIds = question.options.filter((o) => o.isCorrect).map((o) => o.id);
    const isCorrect = isAnswerCorrect(question.type, optionIds, correctIds);
    const responseMs = Math.max(0, receivedAtMs - rt.phaseStartedAt);
    const score = computeScore({
      mode: rt.settings.scoreMode,
      isCorrect,
      responseMs,
      timeLimitSec: question.timeLimitSec,
      maxPoints: maxPointsForWeight(question.weight, rt.settings.maxPoints),
    });

    try {
      await this.db.liveAnswer.create({
        data: {
          sessionId: rt.id,
          playerId,
          questionIndex: rt.currentIndex,
          selectedOptionIds: optionIds as unknown as Prisma.InputJsonValue,
          isCorrect,
          responseMs,
          scoreEarned: score,
          receivedAt: new Date(receivedAtMs),
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return {
          ok: true,
          ack: { questionIndex: rt.currentIndex, duplicate: true, version: rt.version, receivedAt: receivedAtMs },
        };
      }
      throw error;
    }

    rt.answers.set(playerId, { optionIds, isCorrect, score, responseMs, receivedAt: receivedAtMs });

    const ack: AnswerAck = {
      questionIndex: rt.currentIndex,
      duplicate: false,
      version: rt.version,
      receivedAt: receivedAtMs,
    };
    // Ack TIDAK memuat benar/salah maupun poin: itu baru diumumkan setelah soal ditutup.
    this.emitter.toPlayer(playerId, LIVE_EVENTS.answerAcknowledged, ack);
    this.emitter.toHost(rt.id, LIVE_EVENTS.answerSubmitted, {
      questionIndex: rt.currentIndex,
      answeredCount: this.answeredActiveCount(rt),
      totalPlayers: this.activePlayers(rt).length,
      version: rt.version,
    });

    if (this.shouldAutoClose(rt)) {
      await this.closeQuestionLocked(rt, rt.currentIndex);
    }
    return { ok: true, ack };
  }

  /* ------------------------------------------------------------------ */
  /* Transisi fase                                                       */
  /* ------------------------------------------------------------------ */

  private async openQuestionLocked(rt: Runtime, index: number) {
    const question = rt.snapshot.questions[index];
    if (!question) {
      await this.finishLocked(rt, false);
      return;
    }
    const startedAt = this.now();
    const deadlineAt = startedAt + question.timeLimitSec * 1000;
    rt.answers = new Map();
    rt.cache = {};

    await this.setPhase(rt, 'QUESTION_ACTIVE', {
      index,
      startedAt,
      deadlineAt,
      extra: {},
      ops: [
        this.db.liveQuestionState.upsert({
          where: { sessionId_questionIndex: { sessionId: rt.id, questionIndex: index } },
          create: {
            sessionId: rt.id,
            questionIndex: index,
            openedAt: new Date(startedAt),
            deadlineAt: new Date(deadlineAt),
          },
          update: { openedAt: new Date(startedAt), deadlineAt: new Date(deadlineAt), closedAt: null },
        }),
      ],
    });

    rt.cache.question = this.buildQuestionPayloads(rt, question);
    const common = { questionIndex: index, version: rt.version, total: rt.snapshot.questions.length };
    this.emitter.toHost(rt.id, LIVE_EVENTS.nextQuestion, common);
    this.emitter.toPlayers(rt.id, LIVE_EVENTS.nextQuestion, common);
    if (index === 0) {
      this.emitter.toHost(rt.id, LIVE_EVENTS.gameStarted, { ...common, serverNow: this.now() });
      this.emitter.toPlayers(rt.id, LIVE_EVENTS.gameStarted, { ...common, serverNow: this.now() });
    }
    this.emitter.toHost(rt.id, LIVE_EVENTS.questionStarted, { ...rt.cache.question.host, serverNow: this.now() });
    this.emitter.toPlayers(rt.id, LIVE_EVENTS.questionStarted, { ...rt.cache.question.player, serverNow: this.now() });

    this.schedule(rt, deadlineAt, 'close-question', () => this.closeQuestionLocked(rt, index));
  }

  private async closeQuestionLocked(rt: Runtime, index: number) {
    if (rt.status !== 'QUESTION_ACTIVE' || rt.currentIndex !== index) return;
    this.clearTimer(rt);

    const ops: Prisma.PrismaPromise<unknown>[] = [];
    const applied: Array<{ player: RtPlayer; answer: RtAnswer }> = [];
    for (const [playerId, answer] of rt.answers) {
      const player = rt.players.get(playerId);
      if (!player || player.kicked) continue;
      applied.push({ player, answer });
      ops.push(
        this.db.livePlayer.update({
          where: { id: playerId },
          data: {
            totalScore: { increment: answer.score },
            correctCount: { increment: answer.isCorrect ? 1 : 0 },
            correctTimeMs: { increment: answer.isCorrect ? answer.responseMs : 0 },
          },
        }),
      );
    }
    ops.push(
      this.db.liveQuestionState.update({
        where: { sessionId_questionIndex: { sessionId: rt.id, questionIndex: index } },
        data: {
          closedAt: new Date(this.now()),
          answeredCount: applied.length,
          optionCounts: this.roundStats(rt, index).distribution as unknown as Prisma.InputJsonValue,
        },
      }),
    );

    const next: LivePhase = rt.settings.showQuestionResult ? 'QUESTION_RESULT' : 'SCORE_RESULT';
    await this.setPhase(rt, next, { index, startedAt: this.now(), deadlineAt: null, extra: {}, ops });

    // Terapkan ke memori hanya setelah transaksi DB berhasil.
    for (const { player, answer } of applied) {
      player.totalScore += answer.score;
      player.answeredCount += 1;
      if (answer.isCorrect) {
        player.correctCount += 1;
        player.correctTimeMs += answer.responseMs;
      }
    }

    this.emitter.toHost(rt.id, LIVE_EVENTS.questionEnded, { questionIndex: index, version: rt.version });
    this.emitter.toPlayers(rt.id, LIVE_EVENTS.questionEnded, { questionIndex: index, version: rt.version });

    if (next === 'QUESTION_RESULT') {
      rt.cache.result = this.buildResultEntry(rt, index);
      this.broadcastEntry(rt, LIVE_EVENTS.questionResult, rt.cache.result);
      this.scheduleDisplayTransition(rt);
    } else {
      this.buildAndBroadcastScore(rt, index);
      this.scheduleDisplayTransition(rt);
    }
  }

  private async enterScoreResultLocked(rt: Runtime) {
    this.clearTimer(rt);
    const index = rt.currentIndex;
    await this.setPhase(rt, 'SCORE_RESULT', { index, startedAt: this.now(), deadlineAt: null, extra: {} });
    this.buildAndBroadcastScore(rt, index);
    this.scheduleDisplayTransition(rt);
  }

  private buildAndBroadcastScore(rt: Runtime, index: number) {
    rt.cache.score = this.buildScoreEntry(rt, index);
    this.broadcastEntry(rt, LIVE_EVENTS.scoreUpdated, rt.cache.score);
  }

  private async enterLeaderboardLocked(rt: Runtime) {
    this.clearTimer(rt);
    const index = rt.currentIndex;
    const ranked = rankPlayers(this.activePlayers(rt));
    const ops = ranked.map((entry) =>
      this.db.livePlayer.update({ where: { id: entry.id }, data: { rank: entry.rank } }),
    );
    await this.setPhase(rt, 'LEADERBOARD', { index, startedAt: this.now(), deadlineAt: null, extra: {}, ops });
    rt.cache.leaderboard = this.buildLeaderboardEntry(rt, index, true);
    this.broadcastEntry(rt, LIVE_EVENTS.leaderboardUpdated, rt.cache.leaderboard);
    this.scheduleDisplayTransition(rt);
  }

  private async advanceLocked(rt: Runtime) {
    const nextIndex = rt.currentIndex + 1;
    if (nextIndex < rt.snapshot.questions.length) {
      await this.openQuestionLocked(rt, nextIndex);
    } else {
      await this.finishLocked(rt, false);
    }
  }

  /** Penjadwalan otomatis antar tahap tampilan. Leaderboard -> soal berikut hanya jika mode AUTO. */
  private scheduleDisplayTransition(rt: Runtime) {
    this.clearTimer(rt);
    if (rt.paused) return;
    const s = rt.settings;
    switch (rt.status) {
      case 'QUESTION_RESULT':
        this.schedule(rt, this.now() + s.resultDurationSec * 1000, 'result', () => this.enterScoreResultLocked(rt));
        break;
      case 'SCORE_RESULT':
        this.schedule(rt, this.now() + s.scoreDurationSec * 1000, 'score', () => this.enterLeaderboardLocked(rt));
        break;
      case 'LEADERBOARD':
        if (s.advanceMode === 'AUTO') {
          this.schedule(rt, this.now() + s.leaderboardDurationSec * 1000, 'leaderboard', () => this.advanceLocked(rt));
        }
        break;
      default:
        break;
    }
  }

  private async finishLocked(rt: Runtime, early: boolean) {
    if (isTerminalPhase(rt.status)) return;
    this.clearTimer(rt);

    const closedCount = await this.db.liveQuestionState.count({
      where: { sessionId: rt.id, closedAt: { not: null } },
    });
    const totalQuestions = early ? closedCount : rt.snapshot.questions.length;
    const ranked = rankPlayers(this.activePlayers(rt));
    const finishedAt = new Date(this.now());

    const results = ranked.map((entry) => {
      const incorrect = Math.max(0, entry.answeredCount - entry.correctCount);
      return {
        playerId: entry.id,
        finalRank: entry.rank,
        totalPoints: entry.totalScore,
        correctCount: entry.correctCount,
        incorrectCount: incorrect,
        unansweredCount: Math.max(0, totalQuestions - entry.answeredCount),
        totalQuestions,
        accuracy: computeAccuracy(entry.correctCount, totalQuestions),
      };
    });

    const ops: Prisma.PrismaPromise<unknown>[] = [];
    for (const result of results) {
      ops.push(
        this.db.liveResult.upsert({
          where: { playerId: result.playerId },
          create: { sessionId: rt.id, ...result, finishedAt },
          update: { ...result, finishedAt },
        }),
        this.db.livePlayer.update({ where: { id: result.playerId }, data: { rank: result.finalRank } }),
      );
    }

    await this.setPhase(rt, 'FINISHED', {
      index: rt.currentIndex,
      startedAt: this.now(),
      deadlineAt: null,
      extra: { endedAt: finishedAt, activePin: null },
      ops,
    });
    rt.paused = false;

    const finalEntry = this.buildFinalEntry(rt, results, early);
    rt.cache = { final: finalEntry };
    this.broadcastEntry(rt, LIVE_EVENTS.gameFinished, finalEntry);
    const ended = { status: 'FINISHED', version: rt.version };
    this.emitter.toHost(rt.id, LIVE_EVENTS.sessionEnded, ended);
    this.emitter.toPlayers(rt.id, LIVE_EVENTS.sessionEnded, ended);
    this.scheduleEviction(rt);
  }

  private async cancelLocked(rt: Runtime) {
    if (isTerminalPhase(rt.status)) return;
    this.clearTimer(rt);
    await this.setPhase(rt, 'CANCELLED', {
      index: rt.currentIndex,
      startedAt: this.now(),
      deadlineAt: null,
      extra: { endedAt: new Date(this.now()), activePin: null },
    });
    const ended = { status: 'CANCELLED', version: rt.version };
    this.emitter.toHost(rt.id, LIVE_EVENTS.sessionEnded, ended);
    this.emitter.toPlayers(rt.id, LIVE_EVENTS.sessionEnded, ended);
    this.scheduleEviction(rt);
  }

  /* ------------------------------------------------------------------ */
  /* Sinkronisasi state (reconnect / refresh)                            */
  /* ------------------------------------------------------------------ */

  async getSync(sessionId: string, who: { role: 'host' } | { role: 'player'; playerId: string }) {
    const rt = await this.getRuntime(sessionId);
    if (!rt) return null;
    const isHost = who.role === 'host';
    const player = who.role === 'player' ? rt.players.get(who.playerId) : undefined;

    const sync: Record<string, unknown> = {
      version: rt.version,
      serverNow: this.now(),
      status: rt.status,
      paused: rt.paused,
      lobbyLocked: rt.lobbyLocked,
      session: {
        id: rt.id,
        pin: isTerminalPhase(rt.status) ? null : rt.pin,
        title: rt.title,
        totalQuestions: rt.snapshot.questions.length,
      },
      settings: this.clientSettings(rt.settings),
      playerCount: this.activePlayers(rt).length,
    };
    if (isHost) sync.lobby = this.lobbyPayload(rt);
    if (player) {
      const rank = this.rankOf(rt, player.id);
      sync.me = {
        id: player.id,
        name: player.name,
        avatarId: player.avatarId,
        totalScore: player.totalScore,
        correctCount: player.correctCount,
        rank,
      };
    }

    const pick = (entry: PhaseEntry | undefined) =>
      entry ? (isHost ? entry.host : player ? entry.byPlayer.get(player.id) ?? null : null) : null;

    switch (rt.status) {
      case 'COUNTDOWN':
        sync.countdown = rt.cache.countdown ?? null;
        break;
      case 'QUESTION_ACTIVE': {
        const q = rt.cache.question;
        if (q) {
          const payload = isHost ? { ...q.host, answeredCount: this.answeredActiveCount(rt) } : q.player;
          sync.question = payload;
          if (player) {
            const mine = rt.answers.get(player.id);
            sync.myAnswer = mine ? { optionIds: mine.optionIds } : null;
          }
        }
        break;
      }
      case 'QUESTION_RESULT':
        sync.result = pick(rt.cache.result);
        sync.question = this.questionForReplay(rt, isHost);
        break;
      case 'SCORE_RESULT':
        sync.score = pick(rt.cache.score);
        sync.result = pick(rt.cache.result);
        sync.question = this.questionForReplay(rt, isHost);
        break;
      case 'LEADERBOARD':
        sync.leaderboard = pick(rt.cache.leaderboard);
        break;
      case 'FINISHED':
        sync.final = pick(rt.cache.final);
        break;
      default:
        break;
    }
    return sync;
  }

  /* ------------------------------------------------------------------ */
  /* Pembangun payload                                                   */
  /* ------------------------------------------------------------------ */

  private publicQuestion(rt: Runtime, question: SnapshotQuestion, forPlayer: boolean): PublicQuestion {
    const hide = forPlayer && (rt.settings.projectorMode || !rt.settings.showQuestionOnPlayer);
    return {
      index: question.index,
      total: rt.snapshot.questions.length,
      type: question.type,
      prompt: hide ? null : question.prompt,
      imageUrl: hide ? null : question.imageUrl,
      options: question.options.map((o) => ({
        id: o.id,
        label: hide ? null : o.label,
        imageUrl: hide ? null : o.imageUrl,
      })),
      weight: question.weight,
      timeLimitSec: question.timeLimitSec,
    };
  }

  private buildQuestionPayloads(rt: Runtime, question: SnapshotQuestion) {
    const base = {
      version: rt.version,
      questionIndex: question.index,
      startedAt: rt.phaseStartedAt,
      deadlineAt: rt.phaseDeadlineAt,
      durationMs: question.timeLimitSec * 1000,
    };
    return {
      host: {
        ...base,
        question: this.publicQuestion(rt, question, false),
        totalPlayers: this.activePlayers(rt).length,
        answeredCount: 0,
      },
      player: { ...base, question: this.publicQuestion(rt, question, true) },
    };
  }

  private questionForReplay(rt: Runtime, isHost: boolean) {
    const question = rt.snapshot.questions[rt.currentIndex];
    return question ? this.publicQuestion(rt, question, !isHost) : null;
  }

  private roundStats(rt: Runtime, index: number) {
    const question = rt.snapshot.questions[index];
    const distribution: Record<string, number> = {};
    question?.options.forEach((o) => {
      distribution[o.id] = 0;
    });
    let answered = 0;
    let correct = 0;
    for (const [playerId, answer] of rt.answers) {
      const player = rt.players.get(playerId);
      if (!player || player.kicked) continue;
      answered += 1;
      if (answer.isCorrect) correct += 1;
      for (const id of answer.optionIds) {
        if (id in distribution) distribution[id] = (distribution[id] ?? 0) + 1;
      }
    }
    const totalPlayers = this.activePlayers(rt).length;
    return {
      distribution,
      answered,
      correct,
      wrong: answered - correct,
      unanswered: Math.max(0, totalPlayers - answered),
      totalPlayers,
    };
  }

  private buildResultEntry(rt: Runtime, index: number): PhaseEntry {
    const question = rt.snapshot.questions[index]!;
    const stats = this.roundStats(rt, index);
    const correctOptionIds = question.options.filter((o) => o.isCorrect).map((o) => o.id);
    const show = rt.settings.showCorrectAnswer;
    const host = {
      version: rt.version,
      questionIndex: index,
      question: this.publicQuestion(rt, question, false),
      correctOptionIds: show ? correctOptionIds : null,
      distribution: stats.distribution,
      counts: {
        answered: stats.answered,
        correct: stats.correct,
        wrong: stats.wrong,
        unanswered: stats.unanswered,
        totalPlayers: stats.totalPlayers,
      },
    };
    const byPlayer = new Map<string, Record<string, unknown>>();
    for (const player of this.activePlayers(rt)) {
      const answer = rt.answers.get(player.id);
      byPlayer.set(player.id, {
        version: rt.version,
        questionIndex: index,
        answered: Boolean(answer),
        correct: answer?.isCorrect ?? false,
        selectedOptionIds: answer?.optionIds ?? [],
        correctOptionIds: show ? correctOptionIds : null,
      });
    }
    return { host, byPlayer };
  }

  private buildScoreEntry(rt: Runtime, index: number): PhaseEntry {
    const gains = [...rt.answers.entries()]
      .map(([playerId, answer]) => ({ player: rt.players.get(playerId), answer }))
      .filter((item) => item.player && !item.player.kicked && item.answer.score > 0)
      .sort((a, b) => b.answer.score - a.answer.score || a.answer.responseMs - b.answer.responseMs)
      .slice(0, 5)
      .map((item) => ({ name: item.player!.name, avatarId: item.player!.avatarId, earned: item.answer.score }));

    const host = { version: rt.version, questionIndex: index, topGains: gains, answeredCount: rt.answers.size };
    const byPlayer = new Map<string, Record<string, unknown>>();
    for (const player of this.activePlayers(rt)) {
      const answer = rt.answers.get(player.id);
      byPlayer.set(player.id, {
        version: rt.version,
        questionIndex: index,
        correct: answer?.isCorrect ?? false,
        answered: Boolean(answer),
        earned: answer?.score ?? 0,
        // Total sudah diperbarui saat soal ditutup.
        totalScore: player.totalScore,
        previousScore: player.totalScore - (answer?.score ?? 0),
      });
    }
    return { host, byPlayer };
  }

  private buildLeaderboardEntry(rt: Runtime, index: number, updatePrev: boolean): PhaseEntry {
    const ranked = rankPlayers(this.activePlayers(rt));
    const size = rt.settings.leaderboardSize;
    const toEntry = (p: (typeof ranked)[number]): LeaderboardEntry => {
      const prev = rt.prevRanks.get(p.id);
      return {
        playerId: p.id,
        name: p.name,
        avatarId: p.avatarId,
        rank: p.rank,
        totalScore: p.totalScore,
        correctCount: p.correctCount,
        delta: prev === undefined ? null : prev - p.rank,
      };
    };
    const entries = ranked.map(toEntry);
    const top = entries.slice(0, size);
    const isLast = index >= rt.snapshot.questions.length - 1;
    const shared = {
      version: rt.version,
      questionIndex: index,
      isLast,
      visible: rt.settings.showLeaderboard,
      totalPlayers: ranked.length,
      advanceMode: rt.settings.advanceMode,
      autoAdvanceAt:
        rt.settings.advanceMode === 'AUTO' && !rt.paused
          ? this.now() + rt.settings.leaderboardDurationSec * 1000
          : null,
    };
    const host = { ...shared, entries: top };
    const byPlayer = new Map<string, Record<string, unknown>>();
    for (const entry of entries) {
      byPlayer.set(entry.playerId, {
        ...shared,
        rank: entry.rank,
        totalScore: entry.totalScore,
        delta: entry.delta,
        inTop: entry.rank <= size,
        top: rt.settings.showLeaderboard ? top : [],
      });
    }
    ranked.forEach((p) => {
      const player = rt.players.get(p.id);
      if (player) player.rank = p.rank;
    });
    if (updatePrev) {
      rt.prevRanks = new Map(ranked.map((p) => [p.id, p.rank]));
    }
    return { host, byPlayer };
  }

  private buildFinalEntry(
    rt: Runtime,
    results: Array<{
      playerId: string;
      finalRank: number;
      totalPoints: number;
      correctCount: number;
      incorrectCount: number;
      unansweredCount: number;
      totalQuestions: number;
      accuracy: number;
    }>,
    early: boolean,
  ): PhaseEntry {
    const nameOf = (id: string) => rt.players.get(id)?.name ?? '-';
    const sorted = [...results].sort((a, b) => a.finalRank - b.finalRank);
    const toRow = (r: (typeof results)[number]) => ({
      playerId: r.playerId,
      name: nameOf(r.playerId),
      avatarId: rt.players.get(r.playerId)?.avatarId ?? normalizeAvatarId(null, r.playerId),
      rank: r.finalRank,
      totalScore: r.totalPoints,
      correctCount: r.correctCount,
      accuracy: r.accuracy,
    });
    const totalQuestions = sorted[0]?.totalQuestions ?? rt.snapshot.questions.length;
    // Podium: tampilkan hanya jumlah pemenang yang tersedia (1-3 pemain).
    const podium = sorted.filter((r) => r.finalRank <= 3).slice(0, 3).map(toRow);
    const shared = {
      version: rt.version,
      totalPlayers: sorted.length,
      totalQuestions,
      early,
      podium,
    };
    const host = { ...shared, standings: sorted.slice(0, 10).map(toRow) };
    const byPlayer = new Map<string, Record<string, unknown>>();
    for (const r of sorted) {
      byPlayer.set(r.playerId, {
        ...shared,
        rank: r.finalRank,
        totalScore: r.totalPoints,
        correctCount: r.correctCount,
        incorrectCount: r.incorrectCount,
        unansweredCount: r.unansweredCount,
        accuracy: r.accuracy,
        medal: r.finalRank === 1 ? 'GOLD' : r.finalRank === 2 ? 'SILVER' : r.finalRank === 3 ? 'BRONZE' : null,
      });
    }
    return { host, byPlayer };
  }

  private broadcastEntry(rt: Runtime, event: string, entry: PhaseEntry) {
    this.emitter.toHost(rt.id, event, { ...entry.host, serverNow: this.now() });
    for (const [playerId, payload] of entry.byPlayer) {
      this.emitter.toPlayer(playerId, event, { ...payload, serverNow: this.now() });
    }
  }

  private clientSettings(s: QuizSettings) {
    return {
      animationsEnabled: s.animationsEnabled,
      soundEnabled: s.soundEnabled,
      showCorrectAnswer: s.showCorrectAnswer,
      showLeaderboard: s.showLeaderboard,
      advanceMode: s.advanceMode,
      leaderboardSize: s.leaderboardSize,
      projectorMode: s.projectorMode,
      showQuestionOnPlayer: s.showQuestionOnPlayer,
      countdownSec: s.countdownSec,
      scoreMode: s.scoreMode,
      lockLobbyOnStart: s.lockLobbyOnStart,
      allowLateJoin: s.allowLateJoin,
      reactionsEnabled: s.reactionsEnabled,
      reactionsAfterSubmit: s.reactionsAfterSubmit,
      reactionsOnProjector: s.reactionsOnProjector,
      allowAvatarChange: s.allowAvatarChange,
    };
  }

  /* ------------------------------------------------------------------ */
  /* Lobby                                                               */
  /* ------------------------------------------------------------------ */

  private toLobbyPlayer(player: RtPlayer): LobbyPlayer {
    return {
      id: player.id,
      name: player.name,
      avatarId: player.avatarId,
      connected: player.connected,
      joinedAt: player.joinedAt,
    };
  }

  private lobbyPayload(rt: Runtime) {
    const players = this.activePlayers(rt)
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((p) => this.toLobbyPlayer(p));
    return {
      version: rt.version,
      players,
      count: players.length,
      connectedCount: players.filter((p) => p.connected).length,
      locked: rt.lobbyLocked,
    };
  }

  private emitLobby(rt: Runtime) {
    const payload = this.lobbyPayload(rt);
    this.emitter.toHost(rt.id, LIVE_EVENTS.lobbyUpdated, payload);
    this.emitter.toPlayers(rt.id, LIVE_EVENTS.lobbyUpdated, {
      version: payload.version,
      count: payload.count,
      locked: payload.locked,
    });
  }

  private emitPause(rt: Runtime) {
    const payload = { paused: rt.paused, version: rt.version };
    this.emitter.toHost(rt.id, LIVE_EVENTS.pauseChanged, payload);
    this.emitter.toPlayers(rt.id, LIVE_EVENTS.pauseChanged, payload);
  }

  /* ------------------------------------------------------------------ */
  /* Util runtime                                                        */
  /* ------------------------------------------------------------------ */

  private activePlayers(rt: Runtime): RtPlayer[] {
    return [...rt.players.values()].filter((p) => !p.kicked);
  }

  private answeredActiveCount(rt: Runtime): number {
    let count = 0;
    for (const playerId of rt.answers.keys()) {
      const player = rt.players.get(playerId);
      if (player && !player.kicked) count += 1;
    }
    return count;
  }

  private rankOf(rt: Runtime, playerId: string): number | null {
    if (rt.status === 'LOBBY' || rt.status === 'COUNTDOWN') return null;
    const ranked = rankPlayers(this.activePlayers(rt));
    return ranked.find((p) => p.id === playerId)?.rank ?? null;
  }

  /** Tutup lebih cepat bila semua peserta terhubung (yang berhak menjawab) sudah menjawab. */
  private shouldAutoClose(rt: Runtime): boolean {
    if (!rt.settings.autoCloseWhenAllAnswered) return false;
    const eligible = this.activePlayers(rt).filter((p) => p.connected);
    if (!eligible.length) return false;
    return eligible.every((p) => rt.answers.has(p.id));
  }

  private exclusive<T>(rt: Runtime, fn: () => Promise<T>): Promise<T> {
    const run = rt.queue.then(fn, fn);
    rt.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private clearTimer(rt: Runtime) {
    if (rt.timer) {
      clearTimeout(rt.timer);
      rt.timer = null;
    }
  }

  private schedule(rt: Runtime, atMs: number, label: string, fn: () => Promise<void>) {
    this.clearTimer(rt);
    const version = rt.version;
    const delay = Math.max(0, atMs - this.now());
    rt.timer = setTimeout(() => {
      rt.timer = null;
      this.exclusive(rt, async () => {
        // Jika sudah ada transisi lain sejak dijadwalkan, abaikan (idempotent).
        if (rt.version !== version) return;
        await fn();
      }).catch((error) => this.logError(`timer ${label}`, error));
    }, delay);
  }

  private scheduleEviction(rt: Runtime) {
    if (rt.evictTimer) clearTimeout(rt.evictTimer);
    rt.evictTimer = setTimeout(() => {
      rt.reactions.dispose();
      this.runtimes.delete(rt.id);
    }, RUNTIME_EVICT_MS);
    rt.evictTimer.unref?.();
  }

  private logError(label: string, error: unknown) {
    // eslint-disable-next-line no-console
    console.error(`[live-quiz] ${label} gagal:`, error);
  }

  /** Tulis perubahan fase ke DB (satu transaksi bersama operasi tambahan) lalu cerminkan ke memori. */
  private async setPhase(
    rt: Runtime,
    status: LivePhase,
    opts: {
      index: number;
      startedAt: number | null;
      deadlineAt: number | null;
      extra: {
        lobbyLocked?: boolean;
        startedAt?: Date;
        endedAt?: Date;
        activePin?: null;
      };
      ops?: Prisma.PrismaPromise<unknown>[];
    },
  ) {
    const data: Prisma.LiveSessionUpdateInput = {
      status,
      currentIndex: opts.index,
      phaseStartedAt: opts.startedAt === null ? null : new Date(opts.startedAt),
      phaseDeadlineAt: opts.deadlineAt === null ? null : new Date(opts.deadlineAt),
      stateVersion: { increment: 1 },
    };
    if (opts.extra.lobbyLocked !== undefined) data.lobbyLocked = opts.extra.lobbyLocked;
    if (opts.extra.startedAt) data.startedAt = opts.extra.startedAt;
    if (opts.extra.endedAt) data.endedAt = opts.extra.endedAt;
    if (opts.extra.activePin === null) data.activePin = null;
    if (status === 'FINISHED' || status === 'CANCELLED') data.paused = false;

    const sessionUpdate = this.db.liveSession.update({
      where: { id: rt.id },
      data,
      select: { stateVersion: true },
    });
    const results = await this.db.$transaction([...(opts.ops ?? []), sessionUpdate]);
    const row = results[results.length - 1] as { stateVersion: number };

    rt.status = status;
    rt.currentIndex = opts.index;
    rt.version = row.stateVersion;
    rt.phaseStartedAt = opts.startedAt;
    rt.phaseDeadlineAt = opts.deadlineAt;
  }

  /* ------------------------------------------------------------------ */
  /* Load / recovery                                                     */
  /* ------------------------------------------------------------------ */

  async getRuntime(sessionId: string): Promise<Runtime | null> {
    const cached = this.runtimes.get(sessionId);
    if (cached) return cached;
    const pending = this.loading.get(sessionId);
    if (pending) return pending;
    const promise = this.loadRuntime(sessionId).finally(() => this.loading.delete(sessionId));
    this.loading.set(sessionId, promise);
    return promise;
  }

  private async loadRuntime(sessionId: string): Promise<Runtime | null> {
    const row = await this.db.liveSession.findUnique({
      where: { id: sessionId },
      include: { players: { orderBy: { joinedAt: 'asc' } } },
    });
    if (!row) return null;

    const snapshot = row.snapshot as unknown as SessionSnapshot;
    const rt: Runtime = {
      id: row.id,
      hostId: row.hostId,
      pin: row.pin,
      title: snapshot.title,
      snapshot,
      settings: resolveQuizSettings(row.settings),
      status: row.status as LivePhase,
      currentIndex: row.currentIndex,
      version: row.stateVersion,
      phaseStartedAt: row.phaseStartedAt ? row.phaseStartedAt.getTime() : null,
      phaseDeadlineAt: row.phaseDeadlineAt ? row.phaseDeadlineAt.getTime() : null,
      paused: row.paused,
      lobbyLocked: row.lobbyLocked,
      players: new Map(),
      tokenIndex: new Map(),
      answers: new Map(),
      prevRanks: new Map(),
      timer: null,
      queue: Promise.resolve(),
      cache: {},
      evictTimer: null,
      reactions: new ReactionState(),
    };

    for (const p of row.players) {
      rt.players.set(p.id, {
        id: p.id,
        userId: p.userId,
        name: p.displayName,
        avatarId: normalizeAvatarId(p.avatarId, p.id),
        tokenHash: p.tokenHash,
        connected: false,
        kicked: Boolean(p.kickedAt),
        joinedAt: p.joinedAt.getTime(),
        totalScore: p.totalScore,
        correctCount: p.correctCount,
        correctTimeMs: p.correctTimeMs,
        answeredCount: 0,
        rank: p.rank,
      });
      rt.tokenIndex.set(p.tokenHash, p.id);
    }

    const closed = await this.db.liveQuestionState.findMany({
      where: { sessionId, closedAt: { not: null } },
      select: { questionIndex: true },
    });
    if (closed.length) {
      const grouped = await this.db.liveAnswer.groupBy({
        by: ['playerId'],
        where: { sessionId, questionIndex: { in: closed.map((c) => c.questionIndex) } },
        _count: { _all: true },
      });
      for (const g of grouped) {
        const player = rt.players.get(g.playerId);
        if (player) player.answeredCount = g._count._all;
      }
    }

    if (rt.currentIndex >= 0 && ['QUESTION_ACTIVE', 'QUESTION_RESULT', 'SCORE_RESULT', 'LEADERBOARD'].includes(rt.status)) {
      const answers = await this.db.liveAnswer.findMany({
        where: { sessionId, questionIndex: rt.currentIndex },
      });
      for (const a of answers) {
        rt.answers.set(a.playerId, {
          optionIds: (a.selectedOptionIds as unknown as string[]) ?? [],
          isCorrect: a.isCorrect,
          score: a.scoreEarned,
          responseMs: a.responseMs,
          receivedAt: a.receivedAt.getTime(),
        });
      }
    }

    // Hindari race: pemanggil paralel mendapat instance yang sama.
    const existing = this.runtimes.get(sessionId);
    if (existing) return existing;
    this.runtimes.set(sessionId, rt);
    await this.rebuildCaches(rt);
    if (isTerminalPhase(rt.status)) this.scheduleEviction(rt);
    return rt;
  }

  private async rebuildCaches(rt: Runtime) {
    const index = rt.currentIndex;
    const question = rt.snapshot.questions[index];
    switch (rt.status) {
      case 'COUNTDOWN':
        rt.cache.countdown = {
          version: rt.version,
          countdownMs: rt.settings.countdownSec * 1000,
          startedAt: rt.phaseStartedAt,
          deadlineAt: rt.phaseDeadlineAt,
        };
        break;
      case 'QUESTION_ACTIVE':
        if (question) rt.cache.question = this.buildQuestionPayloads(rt, question);
        break;
      case 'QUESTION_RESULT':
        rt.cache.result = this.buildResultEntry(rt, index);
        break;
      case 'SCORE_RESULT':
        rt.cache.result = this.buildResultEntry(rt, index);
        rt.cache.score = this.buildScoreEntry(rt, index);
        break;
      case 'LEADERBOARD':
        rt.cache.leaderboard = this.buildLeaderboardEntry(rt, index, false);
        break;
      case 'FINISHED': {
        const rows = await this.db.liveResult.findMany({ where: { sessionId: rt.id } });
        const results = rows.map((r) => ({
          playerId: r.playerId,
          finalRank: r.finalRank,
          totalPoints: r.totalPoints,
          correctCount: r.correctCount,
          incorrectCount: r.incorrectCount,
          unansweredCount: r.unansweredCount,
          totalQuestions: r.totalQuestions,
          accuracy: r.accuracy,
        }));
        const total = rt.snapshot.questions.length;
        rt.cache.final = this.buildFinalEntry(rt, results, (results[0]?.totalQuestions ?? total) < total);
        break;
      }
      default:
        break;
    }
  }

  /** Jadwalkan ulang timer setelah restart server berdasarkan deadline yang tersimpan di DB. */
  private resumeTimers(rt: Runtime) {
    switch (rt.status) {
      case 'COUNTDOWN':
        if (rt.phaseDeadlineAt !== null) {
          this.schedule(rt, rt.phaseDeadlineAt, 'countdown', () => this.openQuestionLocked(rt, 0));
        }
        break;
      case 'QUESTION_ACTIVE':
        if (rt.phaseDeadlineAt !== null) {
          const index = rt.currentIndex;
          this.schedule(rt, rt.phaseDeadlineAt, 'close-question', () => this.closeQuestionLocked(rt, index));
        }
        break;
      case 'QUESTION_RESULT':
      case 'SCORE_RESULT':
      case 'LEADERBOARD':
        this.scheduleDisplayTransition(rt);
        break;
      default:
        break;
    }
  }

  /** Dipanggil saat boot: pulihkan sesi aktif, tandai semua pemain offline, dan batalkan sesi basi. */
  async recover() {
    await this.expireStaleSessions();
    const active = await this.db.liveSession.findMany({
      where: { status: { notIn: ['FINISHED', 'CANCELLED'] } },
      select: { id: true },
    });
    if (!active.length) return 0;
    await this.db.livePlayer.updateMany({
      where: { sessionId: { in: active.map((s) => s.id) }, isConnected: true },
      data: { isConnected: false },
    });
    for (const { id } of active) {
      const rt = await this.getRuntime(id);
      if (rt && !isTerminalPhase(rt.status)) this.resumeTimers(rt);
    }
    return active.length;
  }

  async expireStaleSessions(maxAgeMs = STALE_SESSION_MS) {
    const cutoff = new Date(this.now() - maxAgeMs);
    const stale = await this.db.liveSession.findMany({
      where: { status: { notIn: ['FINISHED', 'CANCELLED'] }, createdAt: { lt: cutoff } },
      select: { id: true },
    });
    for (const { id } of stale) {
      const rt = this.runtimes.get(id);
      if (rt) {
        await this.exclusive(rt, () => this.cancelLocked(rt)).catch((error) => this.logError('expire', error));
      } else {
        await this.db.liveSession.update({
          where: { id },
          data: { status: 'CANCELLED', activePin: null, endedAt: new Date(this.now()) },
        });
      }
    }
    return stale.length;
  }

  /** Hentikan semua timer (untuk shutdown/test). */
  shutdown() {
    for (const rt of this.runtimes.values()) {
      this.clearTimer(rt);
      rt.reactions.dispose();
      if (rt.evictTimer) clearTimeout(rt.evictTimer);
    }
    this.runtimes.clear();
  }
}

export const liveEngine = new LiveEngine();
