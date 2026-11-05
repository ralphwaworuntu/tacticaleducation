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

export type QuestionType = 'SINGLE' | 'TRUE_FALSE' | 'MULTIPLE';
export type QuestionWeight = 'NORMAL' | 'DOUBLE' | 'NONE';

export type PublicOption = { id: string; label: string | null; imageUrl: string | null };

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

export type ClientSettings = {
  animationsEnabled: boolean;
  soundEnabled: boolean;
  showCorrectAnswer: boolean;
  showLeaderboard: boolean;
  advanceMode: 'MANUAL' | 'AUTO';
  leaderboardSize: number;
  projectorMode: boolean;
  showQuestionOnPlayer: boolean;
  countdownSec: number;
  scoreMode: 'SPEED' | 'ACCURACY';
  lockLobbyOnStart: boolean;
  allowLateJoin: boolean;
  reactionsEnabled: boolean;
  reactionsAfterSubmit: boolean;
  reactionsOnProjector: boolean;
  allowAvatarChange: boolean;
};

export type LobbyPlayer = { id: string; name: string; avatarId: string; connected: boolean; joinedAt: number };
export type LobbyPayload = {
  version: number;
  players: LobbyPlayer[];
  count: number;
  connectedCount: number;
  locked: boolean;
};

export type QuestionPayload = {
  version: number;
  questionIndex: number;
  startedAt: number;
  deadlineAt: number;
  durationMs: number;
  question: PublicQuestion;
  totalPlayers?: number;
  answeredCount?: number;
};

export type ResultPayload = {
  version: number;
  questionIndex: number;
  // host
  question?: PublicQuestion;
  distribution?: Record<string, number>;
  counts?: { answered: number; correct: number; wrong: number; unanswered: number; totalPlayers: number };
  // player
  answered?: boolean;
  correct?: boolean;
  selectedOptionIds?: string[];
  correctOptionIds: string[] | null;
};

export type ScorePayload = {
  version: number;
  questionIndex: number;
  // host
  topGains?: Array<{ name: string; avatarId?: string; earned: number }>;
  answeredCount?: number;
  /** Detail Jawaban Siswa: semua peserta aktif, sudah diurutkan server berdasarkan poin soal ini. */
  answers?: RevealRow[];
  // player
  correct?: boolean;
  answered?: boolean;
  earned?: number;
  totalScore?: number;
  previousScore?: number;
};

export type RevealStatus = 'CORRECT' | 'WRONG' | 'NONE';

export type RevealRow = {
  playerId: string;
  name: string;
  avatarId: string;
  status: RevealStatus;
  selectedOptionIds: string[];
  selectedLetters: string[];
  earned: number;
  responseMs: number | null;
};

export type LeaderboardEntry = {
  playerId: string;
  name: string;
  avatarId?: string;
  rank: number;
  totalScore: number;
  correctCount: number;
  delta: number | null;
};

export type LeaderboardPayload = {
  version: number;
  questionIndex: number;
  isLast: boolean;
  visible: boolean;
  totalPlayers: number;
  advanceMode: 'MANUAL' | 'AUTO';
  autoAdvanceAt: number | null;
  // host
  entries?: LeaderboardEntry[];
  /** Seluruh ranking (hanya tutor). Mode utama tetap Top N di `entries`. */
  standings?: LeaderboardEntry[];
  // player
  rank?: number;
  totalScore?: number;
  delta?: number | null;
  inTop?: boolean;
  top?: LeaderboardEntry[];
};

export type PodiumRow = {
  playerId: string;
  name: string;
  avatarId?: string;
  rank: number;
  totalScore: number;
  correctCount: number;
  accuracy: number;
};

export type FinalPayload = {
  version: number;
  totalPlayers: number;
  totalQuestions: number;
  early: boolean;
  podium: PodiumRow[];
  // host
  standings?: PodiumRow[];
  // player
  rank?: number;
  totalScore?: number;
  correctCount?: number;
  incorrectCount?: number;
  unansweredCount?: number;
  accuracy?: number;
  medal?: 'GOLD' | 'SILVER' | 'BRONZE' | null;
};

export type SyncPayload = {
  version: number;
  serverNow: number;
  status: LivePhase;
  paused: boolean;
  lobbyLocked: boolean;
  session: { id: string; pin: string | null; title: string; totalQuestions: number };
  settings: ClientSettings;
  playerCount: number;
  lobby?: LobbyPayload;
  me?: { id: string; name: string; avatarId?: string; totalScore: number; correctCount: number; rank: number | null };
  countdown?: { startedAt: number; deadlineAt: number; countdownMs: number; version: number } | null;
  question?: QuestionPayload | PublicQuestion | null;
  myAnswer?: { optionIds: string[] } | null;
  result?: ResultPayload | null;
  score?: ScorePayload | null;
  leaderboard?: LeaderboardPayload | null;
  final?: FinalPayload | null;
};

export type JoinInfo = {
  pin: string;
  joinPath: string;
  joinBaseUrl: string | null;
  lanHosts: string[];
};

/* ---- Admin ---- */

export type QuizSettings = {
  timeLimitSec: number;
  scoreMode: 'SPEED' | 'ACCURACY';
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showCorrectAnswer: boolean;
  showQuestionResult: boolean;
  showLeaderboard: boolean;
  animationsEnabled: boolean;
  soundEnabled: boolean;
  allowLateJoin: boolean;
  lockLobbyOnStart: boolean;
  advanceMode: 'MANUAL' | 'AUTO';
  showQuestionOnPlayer: boolean;
  projectorMode: boolean;
  autoCloseWhenAllAnswered: boolean;
  countdownSec: number;
  resultDurationSec: number;
  scoreDurationSec: number;
  leaderboardDurationSec: number;
  leaderboardSize: number;
  maxPoints: number;
  maxPlayers: number;
  reactionsEnabled: boolean;
  reactionsAfterSubmit: boolean;
  reactionsOnProjector: boolean;
  allowAvatarChange: boolean;
};

export const TIME_LIMIT_OPTIONS = [5, 10, 20, 30, 60, 90, 120] as const;

export type EditorOption = { label: string; imageUrl: string | null; isCorrect: boolean };
export type EditorQuestion = {
  key: string;
  type: QuestionType;
  prompt: string;
  imageUrl: string | null;
  timeLimitSec: number | null;
  weight: QuestionWeight;
  sourceType?: string | null;
  sourceId?: string | null;
  options: EditorOption[];
};

export type QuizListItem = {
  id: string;
  title: string;
  description: string | null;
  subject: string | null;
  category: string | null;
  questionCount: number;
  sessionCount: number;
  createdAt: string;
  updatedAt: string;
};

export type QuizDetail = {
  id: string;
  title: string;
  description: string | null;
  subject: string | null;
  category: string | null;
  settings: Partial<QuizSettings> | null;
  questions: Array<{
    id: string;
    type: QuestionType;
    prompt: string;
    imageUrl: string | null;
    timeLimitSec: number | null;
    weight: QuestionWeight;
    sourceType: string | null;
    sourceId: string | null;
    options: Array<{ id: string; label: string; imageUrl: string | null; isCorrect: boolean }>;
  }>;
};

export type SessionListItem = {
  id: string;
  title: string;
  status: LivePhase;
  pin: string | null;
  hostName: string;
  playerCount: number;
  totalQuestions: number;
  createdAt: string;
  endedAt: string | null;
};

export type SessionMeta = SessionListItem & {
  quizId: string;
  hostId: string;
  startedAt: string | null;
  join: JoinInfo | null;
};

export type DashboardStats = {
  quizCount: number;
  sessionCount: number;
  finishedSessions: number;
  playerCount: number;
  activeSessions: Array<{ id: string; title: string; status: LivePhase; pin: string | null; playerCount: number }>;
  recentSessions: Array<{ id: string; title: string; endedAt: string | null; playerCount: number }>;
};

export type ReportData = {
  session: {
    id: string;
    title: string;
    status: LivePhase;
    hostName: string;
    createdAt: string;
    startedAt: string | null;
    endedAt: string | null;
    totalQuestions: number;
    plannedQuestions: number;
  };
  summary: {
    players: number;
    kicked: number;
    averageScore: number;
    highestScore: number;
    lowestScore: number;
    averageAccuracy: number;
  };
  ranking: Array<{
    rank: number;
    playerId: string;
    name: string;
    avatarId?: string;
    userId: string | null;
    totalPoints: number;
    correctCount: number;
    incorrectCount: number;
    unansweredCount: number;
    accuracy: number;
    avgResponseMs: number | null;
  }>;
  questions: Array<{
    index: number;
    number: number;
    prompt: string;
    type: QuestionType;
    answered: number;
    correct: number;
    wrong: number;
    unanswered: number;
    correctRate: number;
    avgResponseMs: number | null;
    distribution: Array<{ optionId: string; label: string; isCorrect: boolean; count: number }>;
  }>;
};

export type PlayerDetail = {
  player: { id: string; name: string; avatarId?: string; totalScore: number; correctCount: number; rank: number | null; kicked: boolean };
  answers: Array<{
    number: number;
    prompt: string;
    answered: boolean;
    isCorrect: boolean;
    scoreEarned: number;
    responseMs: number | null;
    selected: string[];
    correctAnswers: string[];
  }>;
};

export type BankSource = { id: string; title: string; questionCount: number };
export type BankQuestionsResult = {
  total: number;
  questions: Array<Omit<EditorQuestion, 'key'>>;
  skipped: Array<{ number: number; reason: string }>;
};

/* ---- Live Quiz 2.0: reaksi emoji ---- */

export const REACTION_IDS = ['fire', 'heart', 'laugh', 'clap', 'party', 'wow', 'cool', 'rocket'] as const;
export type ReactionId = (typeof REACTION_IDS)[number];

/** Pemetaan ID -> emoji (urutan sama dengan spesifikasi: 🔥 ❤️ 😂 👏 🎉 😮 😎 🚀). */
export const REACTION_EMOJI: Record<ReactionId, string> = {
  fire: '🔥',
  heart: '❤️',
  laugh: '😂',
  clap: '👏',
  party: '🎉',
  wow: '😮',
  cool: '😎',
  rocket: '🚀',
};

/** Nama aksesibel (pembaca layar) untuk tiap reaksi. */
export const REACTION_LABEL: Record<ReactionId, string> = {
  fire: 'Api',
  heart: 'Hati',
  laugh: 'Tertawa',
  clap: 'Tepuk tangan',
  party: 'Perayaan',
  wow: 'Kaget',
  cool: 'Keren',
  rocket: 'Roket',
};

export type ReactionItem = { playerId: string; name: string; avatarId: string; emoji: ReactionId; at: number };
export type ReactionBatchHost = { items: ReactionItem[]; counts: Partial<Record<ReactionId, number>>; total: number; serverNow: number };
export type ReactionBatchPlayer = { counts: Partial<Record<ReactionId, number>>; total: number; serverNow: number };
export type ReactionSettingsPayload = { reactionsEnabled: boolean; reactionsAfterSubmit: boolean; reactionsOnProjector: boolean };
