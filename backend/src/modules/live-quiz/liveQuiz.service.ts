import os from 'os';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { env } from '../../config/env';
import { HttpError } from '../../middlewares/errorHandler';
import {
  DEFAULT_QUIZ_SETTINGS,
  LIVE_QUIZ_SETTINGS_KEY,
  MAX_OPTIONS,
  MIN_OPTIONS,
  quizSettingsSchema,
  resolveQuizSettings,
} from './live.settings';
import { rankPlayers } from './liveRanking';
import { computeAccuracy } from './liveScoring';
import { csvSafeCell } from './liveText';
import type { QuizBody } from './liveQuiz.schemas';
import type { SessionSnapshot } from './live.types';

/* ---------------------------------------------------------------------- */
/* Pengaturan                                                              */
/* ---------------------------------------------------------------------- */

/** Ambil hanya kunci pengaturan yang dikenal dan pastikan nilainya valid; yang tersimpan hanya yang diisi. */
export function sanitizeSettingsInput(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const known = new Set(Object.keys(DEFAULT_QUIZ_SETTINGS));
  const picked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (known.has(key) && value !== undefined && value !== null) picked[key] = value;
  }
  const result = quizSettingsSchema.safeParse({ ...DEFAULT_QUIZ_SETTINGS, ...picked });
  if (!result.success) {
    throw new HttpError('Pengaturan kuis tidak valid.', 422, result.error.flatten());
  }
  return picked;
}

export async function getGlobalSettings() {
  const row = await prisma.siteSetting.findUnique({ where: { key: LIVE_QUIZ_SETTINGS_KEY } });
  let stored: unknown = null;
  if (row?.value) {
    try {
      stored = JSON.parse(row.value);
    } catch {
      stored = null;
    }
  }
  return { settings: resolveQuizSettings(stored), defaults: DEFAULT_QUIZ_SETTINGS };
}

export async function saveGlobalSettings(input: unknown) {
  const picked = sanitizeSettingsInput(input);
  const value = JSON.stringify(picked);
  await prisma.siteSetting.upsert({
    where: { key: LIVE_QUIZ_SETTINGS_KEY },
    create: { key: LIVE_QUIZ_SETTINGS_KEY, value },
    update: { value },
  });
  return getGlobalSettings();
}

/* ---------------------------------------------------------------------- */
/* Kuis                                                                    */
/* ---------------------------------------------------------------------- */

const quizInclude = {
  questions: { orderBy: { order: 'asc' as const }, include: { options: { orderBy: { order: 'asc' as const } } } },
};

function questionCreateData(questions: QuizBody['questions']) {
  return questions.map((question, qIndex) => ({
    order: qIndex,
    type: question.type,
    prompt: question.prompt,
    imageUrl: question.imageUrl || null,
    timeLimitSec: question.timeLimitSec ?? null,
    weight: question.weight,
    sourceType: question.sourceType ?? null,
    sourceId: question.sourceId ?? null,
    options: {
      create: question.options.map((option, oIndex) => ({
        order: oIndex,
        label: option.label,
        imageUrl: option.imageUrl || null,
        isCorrect: option.isCorrect,
      })),
    },
  }));
}

export async function listQuizzes(search?: string) {
  const quizzes = await prisma.quiz.findMany({
    where: search ? { title: { contains: search } } : {},
    orderBy: { updatedAt: 'desc' },
    take: 200,
    include: { _count: { select: { questions: true, sessions: true } } },
  });
  return quizzes.map((quiz) => ({
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    subject: quiz.subject,
    category: quiz.category,
    questionCount: quiz._count.questions,
    sessionCount: quiz._count.sessions,
    createdAt: quiz.createdAt,
    updatedAt: quiz.updatedAt,
  }));
}

export async function getQuiz(id: string) {
  const quiz = await prisma.quiz.findUnique({ where: { id }, include: quizInclude });
  if (!quiz) throw new HttpError('Kuis tidak ditemukan.', 404);
  return quiz;
}

export async function createQuiz(userId: string, body: QuizBody) {
  const created = await prisma.quiz.create({
    data: {
      title: body.title,
      description: body.description ?? null,
      subject: body.subject ?? null,
      category: body.category ?? null,
      settings: sanitizeSettingsInput(body.settings) as Prisma.InputJsonValue,
      createdById: userId,
      questions: { create: questionCreateData(body.questions) },
    },
    select: { id: true },
  });
  return getQuiz(created.id);
}

export async function updateQuiz(id: string, body: QuizBody) {
  const existing = await prisma.quiz.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new HttpError('Kuis tidak ditemukan.', 404);
  const settings = sanitizeSettingsInput(body.settings) as Prisma.InputJsonValue;
  await prisma.$transaction(async (tx) => {
    // Hanya soal milik kuis ini; sesi lama memakai snapshot sehingga riwayat tidak terpengaruh.
    await tx.quizOption.deleteMany({ where: { question: { quizId: id } } });
    await tx.quizQuestion.deleteMany({ where: { quizId: id } });
    await tx.quiz.update({
      where: { id },
      data: {
        title: body.title,
        description: body.description ?? null,
        subject: body.subject ?? null,
        category: body.category ?? null,
        settings,
        questions: { create: questionCreateData(body.questions) },
      },
    });
  });
  return getQuiz(id);
}

export async function duplicateQuiz(id: string, userId: string) {
  const source = await getQuiz(id);
  const created = await prisma.quiz.create({
    data: {
      title: `${source.title} (salinan)`.slice(0, 150),
      description: source.description,
      subject: source.subject,
      category: source.category,
      settings: (source.settings ?? {}) as Prisma.InputJsonValue,
      createdById: userId,
      questions: {
        create: source.questions.map((question, qIndex) => ({
          order: qIndex,
          type: question.type,
          prompt: question.prompt,
          imageUrl: question.imageUrl,
          timeLimitSec: question.timeLimitSec,
          weight: question.weight,
          sourceType: question.sourceType,
          sourceId: question.sourceId,
          options: {
            create: question.options.map((option, oIndex) => ({
              order: oIndex,
              label: option.label,
              imageUrl: option.imageUrl,
              isCorrect: option.isCorrect,
            })),
          },
        })),
      },
    },
    select: { id: true },
  });
  return getQuiz(created.id);
}

export async function deleteQuiz(id: string) {
  const quiz = await prisma.quiz.findUnique({
    where: { id },
    select: { id: true, _count: { select: { sessions: true } } },
  });
  if (!quiz) throw new HttpError('Kuis tidak ditemukan.', 404);
  if (quiz._count.sessions > 0) {
    throw new HttpError(
      'Kuis ini sudah pernah dimainkan sehingga tidak dapat dihapus (riwayat & laporan dipertahankan). Gunakan Duplikat bila ingin versi baru.',
      409,
    );
  }
  await prisma.$transaction([
    prisma.quizOption.deleteMany({ where: { question: { quizId: id } } }),
    prisma.quizQuestion.deleteMany({ where: { quizId: id } }),
    prisma.quiz.delete({ where: { id } }),
  ]);
}

/* ---------------------------------------------------------------------- */
/* Bank soal (impor dari Tryout / Practice) -- tanpa pembahasan             */
/* ---------------------------------------------------------------------- */

export type BankSourceType = 'TRYOUT' | 'PRACTICE';

export async function listBankSources(type: BankSourceType, search?: string) {
  if (type === 'TRYOUT') {
    const rows = await prisma.tryout.findMany({
      where: search ? { name: { contains: search } } : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, name: true, _count: { select: { questions: true } } },
    });
    return rows.map((row) => ({ id: row.id, title: row.name, questionCount: row._count.questions }));
  }
  const rows = await prisma.practiceSet.findMany({
    where: search ? { title: { contains: search } } : {},
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, title: true, _count: { select: { questions: true } } },
  });
  return rows.map((row) => ({ id: row.id, title: row.title, questionCount: row._count.questions }));
}

type RawBankQuestion = {
  id: string;
  prompt: string;
  imageUrl: string | null;
  multipleCorrect: boolean;
  options: Array<{ label: string; imageUrl: string | null; isCorrect: boolean }>;
};

export type BankQuestion = {
  type: 'SINGLE' | 'TRUE_FALSE' | 'MULTIPLE';
  prompt: string;
  imageUrl: string | null;
  timeLimitSec: null;
  weight: 'NORMAL';
  sourceType: BankSourceType;
  sourceId: string;
  options: Array<{ label: string; imageUrl: string | null; isCorrect: boolean }>;
};

const TRUE_FALSE_LABELS = new Set(['benar', 'salah', 'true', 'false']);

function mapBankQuestion(
  type: BankSourceType,
  raw: RawBankQuestion,
): { question: BankQuestion } | { skipped: string } {
  const correct = raw.options.filter((o) => o.isCorrect).length;
  if (raw.options.length < MIN_OPTIONS) return { skipped: 'Pilihan kurang dari 2.' } as const;
  if (raw.options.length > MAX_OPTIONS) return { skipped: `Pilihan lebih dari ${MAX_OPTIONS}.` } as const;
  if (correct < 1) return { skipped: 'Tidak ada kunci jawaban.' } as const;
  const isTrueFalse =
    raw.options.length === 2 && raw.options.every((o) => TRUE_FALSE_LABELS.has(o.label.trim().toLowerCase()));
  const questionType = raw.multipleCorrect || correct > 1 ? 'MULTIPLE' : isTrueFalse ? 'TRUE_FALSE' : 'SINGLE';
  return {
    question: {
      type: questionType,
      prompt: raw.prompt,
      imageUrl: raw.imageUrl,
      timeLimitSec: null,
      weight: 'NORMAL',
      sourceType: type,
      sourceId: raw.id,
      // Sengaja tidak menyertakan explanation / explanationImageUrl.
      options: raw.options.map((o) => ({ label: o.label, imageUrl: o.imageUrl, isCorrect: o.isCorrect })),
    },
  } as const;
}

export async function loadBankQuestions(type: BankSourceType, sourceId: string) {
  let rows: RawBankQuestion[];
  if (type === 'TRYOUT') {
    rows = await prisma.tryoutQuestion.findMany({
      where: { tryoutId: sourceId },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        prompt: true,
        imageUrl: true,
        multipleCorrect: true,
        options: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: { label: true, imageUrl: true, isCorrect: true },
        },
      },
    });
  } else {
    rows = await prisma.practiceQuestion.findMany({
      where: { setId: sourceId },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        prompt: true,
        imageUrl: true,
        multipleCorrect: true,
        options: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: { label: true, imageUrl: true, isCorrect: true },
        },
      },
    });
  }
  const questions: BankQuestion[] = [];
  const skipped: Array<{ number: number; reason: string }> = [];
  rows.forEach((row, index) => {
    const mapped = mapBankQuestion(type, row);
    if ('question' in mapped) questions.push(mapped.question);
    else skipped.push({ number: index + 1, reason: mapped.skipped });
  });
  return { total: rows.length, questions, skipped };
}

/* ---------------------------------------------------------------------- */
/* Sesi & dashboard                                                        */
/* ---------------------------------------------------------------------- */

export function lanHosts(): string[] {
  const hosts: string[] = [];
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) hosts.push(entry.address);
    }
  }
  return hosts;
}

export function joinInfo(pin: string) {
  return {
    pin,
    joinPath: `/live/join?pin=${pin}`,
    // Produksi: isi APP_URL. Dev: klien memakai origin sendiri atau salah satu lanHosts.
    joinBaseUrl: env.APP_URL ? env.APP_URL.replace(/\/+$/, '') : null,
    lanHosts: lanHosts(),
  };
}

export async function getSessionMeta(id: string) {
  const row = await prisma.liveSession.findUnique({
    where: { id },
    include: { _count: { select: { players: true } }, host: { select: { name: true } } },
  });
  if (!row) throw new HttpError('Sesi tidak ditemukan.', 404);
  const snapshot = row.snapshot as unknown as SessionSnapshot;
  return {
    id: row.id,
    quizId: row.quizId,
    title: snapshot.title,
    status: row.status,
    pin: row.activePin ? row.pin : null,
    hostId: row.hostId,
    hostName: row.host.name,
    totalQuestions: snapshot.questions.length,
    playerCount: row._count.players,
    createdAt: row.createdAt,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    join: row.activePin ? joinInfo(row.pin) : null,
  };
}

export async function listSessions(params: { status?: string; page: number; pageSize: number }) {
  const where: Prisma.LiveSessionWhereInput = {};
  if (params.status === 'ACTIVE') where.status = { notIn: ['FINISHED', 'CANCELLED'] };
  else if (params.status === 'FINISHED' || params.status === 'CANCELLED') where.status = params.status;
  const [total, rows] = await prisma.$transaction([
    prisma.liveSession.count({ where }),
    prisma.liveSession.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      include: { _count: { select: { players: true } }, host: { select: { name: true } } },
    }),
  ]);
  return {
    total,
    page: params.page,
    pageSize: params.pageSize,
    items: rows.map((row) => {
      const snapshot = row.snapshot as unknown as SessionSnapshot;
      return {
        id: row.id,
        title: snapshot.title,
        status: row.status,
        pin: row.activePin ? row.pin : null,
        hostName: row.host.name,
        playerCount: row._count.players,
        totalQuestions: snapshot.questions.length,
        createdAt: row.createdAt,
        endedAt: row.endedAt,
      };
    }),
  };
}

export async function dashboardStats() {
  const [quizCount, sessionCount, activeSessions, finishedSessions, playerCount, recent] = await Promise.all([
    prisma.quiz.count(),
    prisma.liveSession.count(),
    prisma.liveSession.findMany({
      where: { status: { notIn: ['FINISHED', 'CANCELLED'] } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { _count: { select: { players: true } } },
    }),
    prisma.liveSession.count({ where: { status: 'FINISHED' } }),
    prisma.livePlayer.count({ where: { kickedAt: null } }),
    prisma.liveSession.findMany({
      where: { status: 'FINISHED' },
      orderBy: { endedAt: 'desc' },
      take: 5,
      include: { _count: { select: { players: true } } },
    }),
  ]);
  const title = (snapshot: unknown) => (snapshot as SessionSnapshot).title;
  return {
    quizCount,
    sessionCount,
    finishedSessions,
    playerCount,
    activeSessions: activeSessions.map((row) => ({
      id: row.id,
      title: title(row.snapshot),
      status: row.status,
      pin: row.activePin ? row.pin : null,
      playerCount: row._count.players,
    })),
    recentSessions: recent.map((row) => ({
      id: row.id,
      title: title(row.snapshot),
      endedAt: row.endedAt,
      playerCount: row._count.players,
    })),
  };
}

/* ---------------------------------------------------------------------- */
/* Laporan                                                                 */
/* ---------------------------------------------------------------------- */

const plainText = (value: string, max = 140) => {
  const text = value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

async function loadReportData(sessionId: string) {
  const session = await prisma.liveSession.findUnique({
    where: { id: sessionId },
    include: { host: { select: { name: true } } },
  });
  if (!session) throw new HttpError('Sesi tidak ditemukan.', 404);
  const [players, answers, states] = await Promise.all([
    prisma.livePlayer.findMany({ where: { sessionId }, orderBy: { joinedAt: 'asc' } }),
    prisma.liveAnswer.findMany({ where: { sessionId } }),
    prisma.liveQuestionState.findMany({ where: { sessionId, closedAt: { not: null } } }),
  ]);
  const snapshot = session.snapshot as unknown as SessionSnapshot;
  const closed = new Set(states.map((s) => s.questionIndex));
  // Jawaban untuk soal yang tidak pernah ditutup (sesi dihentikan) tidak dihitung.
  const validAnswers = answers.filter((a) => closed.has(a.questionIndex));
  return { session, snapshot, players, answers: validAnswers, closedCount: closed.size };
}

export async function buildReport(sessionId: string) {
  const { session, snapshot, players, answers, closedCount } = await loadReportData(sessionId);
  const totalQuestions = session.status === 'FINISHED' || session.status === 'CANCELLED' ? closedCount : snapshot.questions.length;
  const active = players.filter((p) => !p.kickedAt);

  const stats = new Map<string, { answered: number; responseMs: number; correctMs: number }>();
  for (const answer of answers) {
    const entry = stats.get(answer.playerId) ?? { answered: 0, responseMs: 0, correctMs: 0 };
    entry.answered += 1;
    entry.responseMs += answer.responseMs;
    stats.set(answer.playerId, entry);
  }

  const ranked = rankPlayers(
    active.map((p) => ({
      id: p.id,
      totalScore: p.totalScore,
      correctCount: p.correctCount,
      correctTimeMs: p.correctTimeMs,
    })),
  );
  const rankingById = new Map(ranked.map((r) => [r.id, r]));
  const ranking = [...active]
    .map((p) => {
      const stat = stats.get(p.id);
      const answered = stat?.answered ?? 0;
      return {
        rank: rankingById.get(p.id)?.rank ?? 0,
        playerId: p.id,
        name: p.displayName,
        userId: p.userId,
        totalPoints: p.totalScore,
        correctCount: p.correctCount,
        incorrectCount: Math.max(0, answered - p.correctCount),
        unansweredCount: Math.max(0, totalQuestions - answered),
        accuracy: computeAccuracy(p.correctCount, totalQuestions),
        avgResponseMs: answered ? Math.round((stat?.responseMs ?? 0) / answered) : null,
      };
    })
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));

  const questions = snapshot.questions.slice(0, Math.max(totalQuestions, 0)).map((question) => {
    const forQuestion = answers.filter((a) => a.questionIndex === question.index && active.some((p) => p.id === a.playerId));
    const counts = new Map<string, number>(question.options.map((o) => [o.id, 0]));
    let correct = 0;
    let responseSum = 0;
    for (const answer of forQuestion) {
      if (answer.isCorrect) correct += 1;
      responseSum += answer.responseMs;
      for (const id of (answer.selectedOptionIds as unknown as string[]) ?? []) {
        if (counts.has(id)) counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    return {
      index: question.index,
      number: question.index + 1,
      prompt: plainText(question.prompt),
      type: question.type,
      answered: forQuestion.length,
      correct,
      wrong: forQuestion.length - correct,
      unanswered: Math.max(0, active.length - forQuestion.length),
      correctRate: active.length ? Math.round((correct / active.length) * 1000) / 10 : 0,
      avgResponseMs: forQuestion.length ? Math.round(responseSum / forQuestion.length) : null,
      distribution: question.options.map((o) => ({
        optionId: o.id,
        label: plainText(o.label, 80),
        isCorrect: o.isCorrect,
        count: counts.get(o.id) ?? 0,
      })),
    };
  });

  const scores = ranking.map((r) => r.totalPoints);
  return {
    session: {
      id: session.id,
      title: snapshot.title,
      status: session.status,
      hostName: session.host.name,
      createdAt: session.createdAt,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      totalQuestions,
      plannedQuestions: snapshot.questions.length,
      settings: resolveQuizSettings(session.settings),
    },
    summary: {
      players: ranking.length,
      kicked: players.length - active.length,
      averageScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      highestScore: scores.length ? Math.max(...scores) : 0,
      lowestScore: scores.length ? Math.min(...scores) : 0,
      averageAccuracy: ranking.length
        ? Math.round((ranking.reduce((sum, r) => sum + r.accuracy, 0) / ranking.length) * 10) / 10
        : 0,
    },
    ranking,
    questions,
  };
}

export async function buildPlayerDetail(sessionId: string, playerId: string) {
  const { snapshot, players, answers, closedCount } = await loadReportData(sessionId);
  const player = players.find((p) => p.id === playerId);
  if (!player) throw new HttpError('Peserta tidak ditemukan.', 404);
  const mine = new Map(answers.filter((a) => a.playerId === playerId).map((a) => [a.questionIndex, a]));
  const rows = snapshot.questions.slice(0, closedCount).map((question) => {
    const answer = mine.get(question.index);
    const selected = new Set((answer?.selectedOptionIds as unknown as string[]) ?? []);
    return {
      number: question.index + 1,
      prompt: plainText(question.prompt),
      answered: Boolean(answer),
      isCorrect: answer?.isCorrect ?? false,
      scoreEarned: answer?.scoreEarned ?? 0,
      responseMs: answer?.responseMs ?? null,
      selected: question.options.filter((o) => selected.has(o.id)).map((o) => plainText(o.label, 80)),
      correctAnswers: question.options.filter((o) => o.isCorrect).map((o) => plainText(o.label, 80)),
    };
  });
  return {
    player: {
      id: player.id,
      name: player.displayName,
      totalScore: player.totalScore,
      correctCount: player.correctCount,
      rank: player.rank,
      kicked: Boolean(player.kickedAt),
    },
    answers: rows,
  };
}

export async function buildCsv(sessionId: string) {
  const report = await buildReport(sessionId);
  const { answers } = await loadReportData(sessionId);
  const byPlayer = new Map<string, Map<number, boolean>>();
  for (const answer of answers) {
    const map = byPlayer.get(answer.playerId) ?? new Map<number, boolean>();
    map.set(answer.questionIndex, answer.isCorrect);
    byPlayer.set(answer.playerId, map);
  }
  const questionHeaders = report.questions.map((q) => `Soal ${q.number}`);
  const header = [
    'Peringkat',
    'Nama',
    'Skor',
    'Benar',
    'Salah',
    'Tidak Dijawab',
    'Akurasi (%)',
    'Rata-rata Waktu Jawab (detik)',
    ...questionHeaders,
  ];
  const lines = [header.map(csvSafeCell).join(',')];
  for (const row of report.ranking) {
    const per = byPlayer.get(row.playerId);
    const cells = [
      row.rank,
      row.name,
      row.totalPoints,
      row.correctCount,
      row.incorrectCount,
      row.unansweredCount,
      row.accuracy,
      row.avgResponseMs === null ? '' : (row.avgResponseMs / 1000).toFixed(2),
      ...report.questions.map((q) => {
        const value = per?.get(q.index);
        return value === undefined ? '-' : value ? 'Benar' : 'Salah';
      }),
    ];
    lines.push(cells.map((cell) => csvSafeCell(String(cell))).join(','));
  }
  // BOM agar Excel membaca UTF-8 dengan benar.
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
