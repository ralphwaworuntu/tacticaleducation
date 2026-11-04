/**
 * Reaksi emoji langsung (Live Quiz 2.0). Reaksi bersifat efemeral: tidak disimpan ke DB dan TIDAK
 * memengaruhi skor, kecepatan, status jawaban, ranking, ataupun timer.
 *
 * Modul ini murni (tanpa I/O): aturan fase + pembatas laju + penggabung (batcher) agar mudah dites.
 */
import type { LivePhase } from './live.types';

/** Delapan emoji tetap. Server hanya menerima ID ini; tampilan emoji dipetakan di klien. */
export const REACTION_IDS = ['fire', 'heart', 'laugh', 'clap', 'party', 'wow', 'cool', 'rocket'] as const;
export type ReactionId = (typeof REACTION_IDS)[number];

export function isReactionId(value: unknown): value is ReactionId {
  return typeof value === 'string' && (REACTION_IDS as readonly string[]).includes(value);
}

/** Satu pemain: maksimal 1 reaksi per 3 detik. */
export const REACTION_COOLDOWN_MS = 3000;
/** Batas burst per pemain (di atas cooldown): maksimal 6 reaksi dalam 30 detik. */
export const REACTION_BURST_WINDOW_MS = 30_000;
export const REACTION_BURST_MAX = 6;
/** Batas per sesi agar 200 pemain tidak membanjiri host: maksimal 60 reaksi diterima per detik. */
export const REACTION_SESSION_WINDOW_MS = 1000;
export const REACTION_SESSION_MAX = 60;
/** Interval penyiaran gabungan ke klien. */
export const REACTION_BATCH_MS = 400;
/** Maksimal item bernama per batch untuk host (sisanya hanya masuk hitungan). */
export const REACTION_BATCH_MAX_ITEMS = 12;

export type ReactionRejectCode =
  | 'reactions_disabled'
  | 'phase_not_allowed'
  | 'answer_required'
  | 'invalid_emoji'
  | 'cooldown'
  | 'rate_limited';

export type ReactionDecision =
  | { ok: true }
  | { ok: false; code: ReactionRejectCode; message: string; retryAfterMs?: number };

export type ReactionSettings = {
  reactionsEnabled: boolean;
  reactionsAfterSubmit: boolean;
};

/**
 * Aturan fase:
 * - LOBBY, QUESTION_RESULT, SCORE_RESULT, LEADERBOARD, FINISHED: diizinkan.
 * - COUNTDOWN: dilarang.
 * - QUESTION_ACTIVE: hanya setelah pemain mengirim jawaban DAN host mengizinkan (reactionsAfterSubmit).
 * - DRAFT/CANCELLED: dilarang.
 */
export function checkReactionPhase(
  phase: LivePhase,
  settings: ReactionSettings,
  hasAnswered: boolean,
): ReactionDecision {
  if (!settings.reactionsEnabled) {
    return { ok: false, code: 'reactions_disabled', message: 'Reaksi dimatikan oleh tutor.' };
  }
  switch (phase) {
    case 'LOBBY':
    case 'QUESTION_RESULT':
    case 'SCORE_RESULT':
    case 'LEADERBOARD':
    case 'FINISHED':
      return { ok: true };
    case 'QUESTION_ACTIVE':
      if (!settings.reactionsAfterSubmit) {
        return { ok: false, code: 'phase_not_allowed', message: 'Reaksi belum tersedia saat soal berlangsung.' };
      }
      if (!hasAnswered) {
        return { ok: false, code: 'answer_required', message: 'Jawab dulu untuk mengirim reaksi.' };
      }
      return { ok: true };
    default:
      return { ok: false, code: 'phase_not_allowed', message: 'Reaksi tidak tersedia pada tahap ini.' };
  }
}

export type ReactionItem = {
  playerId: string;
  name: string;
  avatarId: string;
  emoji: ReactionId;
  at: number;
};

export type ReactionBatch = {
  /** Item bernama (maks REACTION_BATCH_MAX_ITEMS) untuk layar host. */
  items: ReactionItem[];
  /** Hitungan per emoji untuk SEMUA reaksi di batch (tanpa nama) -- dikirim ke HP pemain. */
  counts: Partial<Record<ReactionId, number>>;
  total: number;
};

/** Status reaksi per sesi: pembatas laju + antrean batch. */
export class ReactionState {
  private readonly lastAt = new Map<string, number>();
  private readonly recent = new Map<string, number[]>();
  private sessionWindowStart = 0;
  private sessionCount = 0;
  private pending: ReactionItem[] = [];
  private pendingCounts: Partial<Record<ReactionId, number>> = {};
  private pendingTotal = 0;
  timer: NodeJS.Timeout | null = null;

  /** Cek laju; bila lolos langsung dicatat (satu langkah sinkron -> tidak ada race antar event). */
  admit(playerId: string, now: number): ReactionDecision {
    const last = this.lastAt.get(playerId);
    if (last !== undefined && now - last < REACTION_COOLDOWN_MS) {
      return {
        ok: false,
        code: 'cooldown',
        message: 'Tunggu sebentar sebelum mengirim reaksi lagi.',
        retryAfterMs: REACTION_COOLDOWN_MS - (now - last),
      };
    }
    const window = (this.recent.get(playerId) ?? []).filter((t) => now - t < REACTION_BURST_WINDOW_MS);
    if (window.length >= REACTION_BURST_MAX) {
      const oldest = window[0] ?? now;
      return {
        ok: false,
        code: 'rate_limited',
        message: 'Terlalu banyak reaksi. Coba lagi sebentar.',
        retryAfterMs: Math.max(0, REACTION_BURST_WINDOW_MS - (now - oldest)),
      };
    }
    if (now - this.sessionWindowStart >= REACTION_SESSION_WINDOW_MS) {
      this.sessionWindowStart = now;
      this.sessionCount = 0;
    }
    if (this.sessionCount >= REACTION_SESSION_MAX) {
      return { ok: false, code: 'rate_limited', message: 'Terlalu banyak reaksi. Coba lagi sebentar.', retryAfterMs: 500 };
    }
    this.sessionCount += 1;
    window.push(now);
    this.recent.set(playerId, window);
    this.lastAt.set(playerId, now);
    return { ok: true };
  }

  enqueue(item: ReactionItem) {
    if (this.pending.length < REACTION_BATCH_MAX_ITEMS) this.pending.push(item);
    this.pendingCounts[item.emoji] = (this.pendingCounts[item.emoji] ?? 0) + 1;
    this.pendingTotal += 1;
  }

  hasPending(): boolean {
    return this.pendingTotal > 0;
  }

  drain(): ReactionBatch | null {
    if (!this.pendingTotal) return null;
    const batch: ReactionBatch = { items: this.pending, counts: this.pendingCounts, total: this.pendingTotal };
    this.pending = [];
    this.pendingCounts = {};
    this.pendingTotal = 0;
    return batch;
  }

  forget(playerId: string) {
    this.lastAt.delete(playerId);
    this.recent.delete(playerId);
  }

  dispose() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pending = [];
    this.pendingCounts = {};
    this.pendingTotal = 0;
  }
}
