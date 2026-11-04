import type { QuestionType, QuestionWeight } from './liveScoring';

/**
 * State machine Live Quiz. TIDAK ADA state pembahasan/explanation.
 * DRAFT hanya ada di enum (sesi baru langsung masuk LOBBY).
 */
export type LivePhase =
  | 'DRAFT'
  | 'LOBBY'
  | 'COUNTDOWN'
  | 'QUESTION_ACTIVE'
  | 'QUESTION_RESULT'
  | 'SCORE_RESULT'
  | 'LEADERBOARD'
  | 'FINISHED'
  | 'CANCELLED';

export const TERMINAL_PHASES: readonly LivePhase[] = ['FINISHED', 'CANCELLED'];

export function isTerminalPhase(phase: LivePhase): boolean {
  return TERMINAL_PHASES.includes(phase);
}

export type SnapshotOption = {
  id: string;
  label: string;
  imageUrl: string | null;
  isCorrect: boolean;
};

export type SnapshotQuestion = {
  id: string;
  index: number;
  type: QuestionType;
  prompt: string;
  imageUrl: string | null;
  timeLimitSec: number;
  weight: QuestionWeight;
  options: SnapshotOption[];
};

/** Disimpan di LiveSession.snapshot saat sesi dibuat; perubahan Bank Soal tidak memengaruhi sesi berjalan. */
export type SessionSnapshot = {
  quizId: string;
  title: string;
  questions: SnapshotQuestion[];
};

/** Opsi untuk klien: tidak pernah memuat isCorrect. label/imageUrl null pada mode proyektor di HP. */
export type PublicOption = {
  id: string;
  label: string | null;
  imageUrl: string | null;
};

export type PublicQuestion = {
  index: number;
  total: number;
  type: QuestionType;
  prompt: string | null;
  imageUrl: string | null;
  options: PublicOption[];
  weight: QuestionWeight;
  timeLimitSec: number;
};

export type LobbyPlayer = {
  id: string;
  name: string;
  connected: boolean;
  joinedAt: number;
};

export type LeaderboardEntry = {
  playerId: string;
  name: string;
  rank: number;
  totalScore: number;
  correctCount: number;
  /** Positif = naik, negatif = turun, 0 = tetap, null = belum ada pembanding. */
  delta: number | null;
};

/** Emitter diabstraksi agar engine bisa dites tanpa Socket.IO dan dipasang oleh gateway. */
export interface LiveEmitter {
  toHost(sessionId: string, event: string, payload: unknown): void;
  toPlayers(sessionId: string, event: string, payload: unknown): void;
  toPlayer(playerId: string, event: string, payload: unknown): void;
  disconnectPlayer(playerId: string, reason: string): void;
}

export const NOOP_EMITTER: LiveEmitter = {
  toHost: () => undefined,
  toPlayers: () => undefined,
  toPlayer: () => undefined,
  disconnectPlayer: () => undefined,
};

export type EngineResult<T = Record<string, never>> =
  | ({ ok: true } & T)
  | { ok: false; code: string; message: string };

/** Event server -> klien (nama sesuai spesifikasi). */
export const LIVE_EVENTS = {
  sessionCreated: 'session_created',
  playerJoined: 'player_joined',
  playerLeft: 'player_left',
  playerReconnected: 'player_reconnected',
  lobbyUpdated: 'lobby_updated',
  gameStarting: 'game_starting',
  gameStarted: 'game_started',
  questionStarted: 'question_started',
  answerSubmitted: 'answer_submitted',
  answerAcknowledged: 'answer_acknowledged',
  questionEnded: 'question_ended',
  questionResult: 'question_result',
  scoreUpdated: 'score_updated',
  leaderboardUpdated: 'leaderboard_updated',
  nextQuestion: 'next_question',
  gameFinished: 'game_finished',
  sessionEnded: 'session_ended',
  sessionStateSync: 'session_state_sync',
  pauseChanged: 'pause_changed',
  kicked: 'kicked',
} as const;
