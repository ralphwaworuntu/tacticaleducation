import { z } from 'zod';

/** Durasi per soal yang diizinkan (detik). Default 30. */
export const ALLOWED_TIME_LIMITS = [5, 10, 20, 30, 60, 90, 120] as const;
export const DEFAULT_TIME_LIMIT_SEC = 30;
export const MAX_OPTIONS = 6;
export const MIN_OPTIONS = 2;

const timeLimitSchema = z
  .number()
  .int()
  .refine((value) => (ALLOWED_TIME_LIMITS as readonly number[]).includes(value), {
    message: `Durasi harus salah satu dari: ${ALLOWED_TIME_LIMITS.join(', ')} detik.`,
  });

/**
 * Pengaturan kuis / sesi. Semua field punya default sehingga payload parsial aman.
 * Tidak ada pengaturan pembahasan karena Live Quiz tidak memiliki tahap explanation.
 */
export const quizSettingsSchema = z.object({
  timeLimitSec: timeLimitSchema.default(DEFAULT_TIME_LIMIT_SEC),
  scoreMode: z.enum(['SPEED', 'ACCURACY']).default('SPEED'),
  shuffleQuestions: z.boolean().default(false),
  shuffleOptions: z.boolean().default(false),
  showCorrectAnswer: z.boolean().default(true),
  showQuestionResult: z.boolean().default(true),
  showLeaderboard: z.boolean().default(true),
  animationsEnabled: z.boolean().default(true),
  soundEnabled: z.boolean().default(true),
  allowLateJoin: z.boolean().default(false),
  lockLobbyOnStart: z.boolean().default(true),
  advanceMode: z.enum(['MANUAL', 'AUTO']).default('MANUAL'),
  showQuestionOnPlayer: z.boolean().default(true),
  projectorMode: z.boolean().default(false),
  autoCloseWhenAllAnswered: z.boolean().default(true),
  countdownSec: z.number().int().min(1).max(10).default(3),
  resultDurationSec: z.number().int().min(1).max(30).default(4),
  scoreDurationSec: z.number().int().min(1).max(30).default(3),
  leaderboardDurationSec: z.number().int().min(1).max(60).default(4),
  leaderboardSize: z.number().int().min(3).max(10).default(5),
  maxPoints: z.number().int().min(100).max(10000).default(1000),
  maxPlayers: z.number().int().min(1).max(500).default(200),
  // Live Quiz 2.0: reaksi emoji & avatar. Dapat diubah host selama sesi (disimpan per sesi).
  reactionsEnabled: z.boolean().default(true),
  reactionsAfterSubmit: z.boolean().default(true),
  reactionsOnProjector: z.boolean().default(true),
  allowAvatarChange: z.boolean().default(true),
});

export type QuizSettings = z.infer<typeof quizSettingsSchema>;

export const DEFAULT_QUIZ_SETTINGS: QuizSettings = quizSettingsSchema.parse({});

/** Gabungkan default + nilai tersimpan + override; nilai tak valid kembali ke default. */
export function resolveQuizSettings(...layers: Array<unknown>): QuizSettings {
  const merged: Record<string, unknown> = {};
  for (const layer of layers) {
    if (layer && typeof layer === 'object' && !Array.isArray(layer)) {
      Object.assign(merged, layer as Record<string, unknown>);
    }
  }
  const parsed = quizSettingsSchema.safeParse(merged);
  if (parsed.success) return parsed.data;

  // Bersihkan field yang gagal validasi lalu coba lagi agar data lama tidak merusak sesi.
  const cleaned = { ...merged };
  for (const issue of parsed.error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string') delete cleaned[key];
  }
  const retry = quizSettingsSchema.safeParse(cleaned);
  return retry.success ? retry.data : DEFAULT_QUIZ_SETTINGS;
}

/** Kunci di SiteSetting untuk default global (halaman Pengaturan Kuis). */
export const LIVE_QUIZ_SETTINGS_KEY = 'live_quiz_default_settings';
