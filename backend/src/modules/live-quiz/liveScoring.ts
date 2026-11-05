export type ScoreMode = 'SPEED' | 'ACCURACY';
export type QuestionWeight = 'NORMAL' | 'DOUBLE' | 'NONE';
export type QuestionType = 'SINGLE' | 'TRUE_FALSE' | 'MULTIPLE';

/** Jawaban lebih cepat dari ini mendapat poin penuh (detik). */
export const FULL_POINTS_WINDOW_SEC = 0.5;

/** Poin maksimum satu soal berdasarkan bobot. NORMAL = base, DOUBLE = 2x, NONE = 0. */
export function maxPointsForWeight(weight: QuestionWeight, base = 1000): number {
  if (weight === 'NONE') return 0;
  if (weight === 'DOUBLE') return base * 2;
  return base;
}

/**
 * Apakah jawaban benar? Single/True-False: tepat satu pilihan dan itu benar.
 * Multiple select: himpunan pilihan harus SAMA PERSIS dengan himpunan kunci
 * (ada pilihan salah atau pilihan benar terlewat => salah).
 */
export function isAnswerCorrect(
  type: QuestionType,
  selectedOptionIds: readonly string[],
  correctOptionIds: readonly string[],
): boolean {
  const selected = new Set(selectedOptionIds);
  const correct = new Set(correctOptionIds);
  if (selected.size === 0 || correct.size === 0) return false;
  if (type !== 'MULTIPLE' && selected.size !== 1) return false;
  if (selected.size !== correct.size) return false;
  for (const id of selected) {
    if (!correct.has(id)) return false;
  }
  return true;
}

export type ScoreInput = {
  mode: ScoreMode;
  isCorrect: boolean;
  /** Durasi respons dalam milidetik, diukur SERVER (receivedAt - questionStartedAt). */
  responseMs: number;
  /** Batas waktu soal dalam detik (T). */
  timeLimitSec: number;
  /** Poin maksimum soal (sudah memperhitungkan bobot). */
  maxPoints: number;
};

/**
 * Poin satu jawaban. Seluruh keputusan skor dihitung server; client tidak pernah
 * mengirim nilai poin.
 *
 * SPEED   : t < 0.5s => maxPoints; selain itu round(maxPoints * (1 - t / (2T))), clamp [0, maxPoints].
 * ACCURACY: benar => maxPoints.
 * Salah, tidak menjawab, atau melewati batas waktu => 0.
 */
export function computeScore(input: ScoreInput): number {
  const { mode, isCorrect, responseMs, timeLimitSec, maxPoints } = input;
  if (!isCorrect || maxPoints <= 0) return 0;
  if (!Number.isFinite(responseMs) || responseMs < 0) return 0;

  const t = responseMs / 1000;
  const T = timeLimitSec;
  if (T <= 0 || t > T) return 0;

  if (mode === 'ACCURACY') return maxPoints;
  if (t < FULL_POINTS_WINDOW_SEC) return maxPoints;

  const raw = Math.round(maxPoints * (1 - t / (2 * T)));
  return Math.min(maxPoints, Math.max(0, raw));
}

/** Persentase akurasi akademik = benar / total soal * 100 (dibulatkan 1 desimal). */
export function computeAccuracy(correctCount: number, totalQuestions: number): number {
  if (totalQuestions <= 0) return 0;
  return Math.round((correctCount / totalQuestions) * 1000) / 10;
}
