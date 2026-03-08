import { ExamBlockType } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { HttpError } from '../../middlewares/errorHandler';
import { assertMembershipFeature, consumeTryoutQuota, getActiveMembership } from '../../utils/membership';
import { ensureExamAccess as ensureExamBlockAccess } from './exam-block.service';
import { assertExamAccess } from './exam-control.service';

const DEFAULT_PSIKO_BREAK_SECONDS = 5;
const PSIKO_BREAK_SETTING_KEY = 'psiko_tryout_break_seconds';
const DEFAULT_PSIKO_CERMAT_MODE = 'NUMBER' as const;
const PSIKO_CERMAT_MODE_SETTING_KEY = 'psiko_tryout_cermat_mode';

function normalizeWord(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

function matchesKeyword(name: string | null | undefined, slug: string | null | undefined, keyword: string) {
  const key = normalizeWord(keyword);
  return normalizeWord(name) === key || normalizeWord(slug) === key;
}

function isPolriPsikoTryout(tryout: {
  sessionOrder: number | null;
  subCategory: { name: string; slug: string; category: { name: string; slug: string } };
}) {
  return (
    tryout.sessionOrder !== null &&
    matchesKeyword(tryout.subCategory.category.name, tryout.subCategory.category.slug, 'polri') &&
    matchesKeyword(tryout.subCategory.name, tryout.subCategory.slug, 'psiko')
  );
}

async function getPsikoBreakSeconds() {
  const setting = await prisma.siteSetting.findUnique({ where: { key: PSIKO_BREAK_SETTING_KEY } });
  const parsed = Number(setting?.value ?? DEFAULT_PSIKO_BREAK_SECONDS);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_PSIKO_BREAK_SECONDS;
  }
  return Math.floor(parsed);
}

async function getPsikoCermatMode() {
  const setting = await prisma.siteSetting.findUnique({ where: { key: PSIKO_CERMAT_MODE_SETTING_KEY } });
  return setting?.value === 'LETTER' ? 'LETTER' : DEFAULT_PSIKO_CERMAT_MODE;
}

async function getPsikoSequenceTryouts(subCategoryId: string) {
  return prisma.tryout.findMany({
    where: {
      subCategoryId,
      isPublished: true,
      sessionOrder: { not: null },
    },
    orderBy: [{ sessionOrder: 'asc' }, { createdAt: 'asc' }],
  });
}

async function resolveTryoutStartTarget(
  userId: string,
  tryout: {
    id: string;
    name: string;
    slug: string;
    isFree: boolean;
    freeForNewMembers: boolean;
    freePackageIds: unknown;
    durationMinutes: number;
    openAt: Date | null;
    closeAt: Date | null;
    sessionOrder: number | null;
    subCategoryId: string;
    subCategory: { name: string; slug: string; category: { name: string; slug: string } };
  },
) {
  if (!isPolriPsikoTryout(tryout)) {
    return tryout;
  }

  const sequence = await getPsikoSequenceTryouts(tryout.subCategoryId);
  if (!sequence.length) {
    return tryout;
  }

  const latestCompleted = await prisma.tryoutResult.findFirst({
    where: {
      userId,
      completedAt: { not: null },
      tryout: {
        subCategoryId: tryout.subCategoryId,
        isPublished: true,
        sessionOrder: { not: null },
      },
    },
    orderBy: { completedAt: 'desc' },
    include: {
      tryout: {
        select: {
          id: true,
        },
      },
    },
  });

  const firstTryout = sequence[0];
  if (!firstTryout) {
    return tryout;
  }

  if (!latestCompleted) {
    if (firstTryout.id === tryout.id) {
      return tryout;
    }
    const target = await prisma.tryout.findUnique({ where: { id: firstTryout.id } });
    return target ?? tryout;
  }

  const latestIndex = sequence.findIndex((item) => item.id === latestCompleted.tryout.id);
  if (latestIndex === -1) {
    if (firstTryout.id === tryout.id) {
      return tryout;
    }
    const target = await prisma.tryout.findUnique({ where: { id: firstTryout.id } });
    return target ?? tryout;
  }

  const targetSequence = sequence[latestIndex + 1] ?? firstTryout;
  if (targetSequence.id === tryout.id) {
    return tryout;
  }
  const target = await prisma.tryout.findUnique({ where: { id: targetSequence.id } });
  return target ?? tryout;
}

export async function listTryouts() {
  return prisma.tryout.findMany({
    where: { isPublished: true },
    orderBy: { createdAt: 'desc' },
    include: {
      subCategory: { include: { category: true } },
    },
  });
}

export async function getTryoutInfo(slug: string) {
  const tryout = await prisma.tryout.findUnique({
    where: { slug },
    include: {
      subCategory: { include: { category: true } },
    },
  });

  if (!tryout || !tryout.isPublished) {
    throw new HttpError('Tryout tidak ditemukan', 404);
  }

  return tryout;
}

export async function getTryoutDetail(slug: string, userId: string) {
  const tryout = await prisma.tryout.findUnique({
    where: { slug },
    include: {
      subCategory: { include: { category: true } },
      questions: {
        orderBy: { order: 'asc' },
        include: {
          options: {
            select: {
              id: true,
              label: true,
              imageUrl: true,
            },
          },
        },
      },
    },
  });

  if (!tryout || !tryout.isPublished) {
    throw new HttpError('Tryout tidak ditemukan', 404);
  }

  await ensureTryoutAccess(userId, tryout);

  const shuffle = <T,>(arr: T[]) => {
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = arr[i]!;
      arr[i] = arr[j]!;
      arr[j] = temp;
    }
    return arr;
  };

  const randomizedQuestions = shuffle([...tryout.questions]).map((question) => ({
    ...question,
    options: shuffle([...question.options]),
  }));

  return {
    ...tryout,
    questions: randomizedQuestions,
  };
}

async function ensureTryoutAccess(userId: string, tryout: { isFree: boolean; freeForNewMembers?: boolean; freePackageIds?: unknown }) {
  const membership = await getActiveMembership(userId);
  const freePackages: string[] =
    Array.isArray(tryout.freePackageIds) || typeof tryout.freePackageIds === 'object'
      ? (tryout.freePackageIds as string[])
      : [];

  if (!membership) {
    if (!tryout.isFree || tryout.freeForNewMembers === false) {
      throw new HttpError('Membership tidak aktif atau belum divalidasi admin.', 403, { code: 'MEMBERSHIP_REQUIRED' });
    }
    return null;
  }

  if (tryout.isFree && (tryout.freeForNewMembers || freePackages.includes(membership.packageId))) {
    return membership;
  }

  assertMembershipFeature(membership, 'TRYOUT');
  return membership;
}

export async function startTryout(slug: string, userId: string) {
  const tryout = await prisma.tryout.findUnique({
    where: { slug },
    include: { subCategory: { include: { category: true } } },
  });
  if (!tryout || !tryout.isPublished) {
    throw new HttpError('Tryout tidak ditemukan', 404);
  }

  const targetTryout = await resolveTryoutStartTarget(userId, tryout);

  await ensureExamBlockAccess(userId, ExamBlockType.TRYOUT, 'STANDARD');
  const membership = await ensureTryoutAccess(userId, targetTryout);

  const recentWindowMs = 2 * 60 * 1000;
  const recentThreshold = new Date(Date.now() - recentWindowMs);
  const recentActive = await prisma.tryoutResult.findFirst({
    where: {
      userId,
      tryoutId: targetTryout.id,
      completedAt: null,
      startedAt: { gte: recentThreshold },
    },
    orderBy: { startedAt: 'desc' },
  });

  if (recentActive) {
    return {
      resultId: recentActive.id,
      durationMinutes: targetTryout.durationMinutes,
      startedSlug: targetTryout.slug,
      sessionOrder: targetTryout.sessionOrder ?? null,
    };
  }

  const now = new Date();
  if (targetTryout.openAt && now < targetTryout.openAt) {
    throw new HttpError('Tryout belum dibuka sesuai jadwal.', 403);
  }
  if (targetTryout.closeAt && now > targetTryout.closeAt) {
    throw new HttpError('Tryout telah ditutup.', 403);
  }

  if (membership) {
    await consumeTryoutQuota(userId);
  }

  const result = await prisma.tryoutResult.create({
    data: {
      userId,
      tryoutId: targetTryout.id,
    },
  });

  return {
    resultId: result.id,
    durationMinutes: targetTryout.durationMinutes,
    startedSlug: targetTryout.slug,
    sessionOrder: targetTryout.sessionOrder ?? null,
  };
}

export async function startExamTryout(slug: string, userId: string) {
  const tryout = await prisma.tryout.findUnique({ where: { slug } });
  if (!tryout || !tryout.isPublished) {
    throw new HttpError('Tryout tidak ditemukan', 404);
  }

  await ensureExamBlockAccess(userId, ExamBlockType.TRYOUT, 'UJIAN');
  await assertExamAccess(userId, 'TRYOUT');

  const now = new Date();
  if (tryout.openAt && now < tryout.openAt) {
    throw new HttpError('Tryout belum dibuka sesuai jadwal.', 403);
  }
  if (tryout.closeAt && now > tryout.closeAt) {
    throw new HttpError('Tryout telah ditutup.', 403);
  }

  const result = await prisma.tryoutResult.create({
    data: {
      userId,
      tryoutId: tryout.id,
    },
  });

  return { resultId: result.id, durationMinutes: tryout.durationMinutes };
}

export async function submitTryout(
  slug: string,
  userId: string,
  input: { resultId: string; answers: Array<{ questionId: string; optionId?: string }> },
) {
  const tryout = await prisma.tryout.findUnique({
    where: { slug },
    include: {
      subCategory: { include: { category: true } },
      questions: { include: { options: true } },
    },
  });
  if (!tryout || !tryout.isPublished) {
    throw new HttpError('Tryout tidak ditemukan', 404);
  }

  await ensureTryoutAccess(userId, tryout);

  const result = await prisma.tryoutResult.findUnique({ where: { id: input.resultId } });
  if (!result || result.userId !== userId) {
    throw new HttpError('Result not found', 404);
  }

  const correctnessMap = new Map(
    tryout.questions.map((question) => [
      question.id,
      question.options.find((option) => option.isCorrect)?.id,
    ]),
  );

  let correct = 0;
  const answerRecords = input.answers.map((answer) => {
    const correctOptionId = correctnessMap.get(answer.questionId);
    const isCorrect = Boolean(correctOptionId && correctOptionId === answer.optionId);
    if (isCorrect) correct += 1;
    return {
      resultId: result.id,
      questionId: answer.questionId,
      optionId: answer.optionId ?? null,
      userId,
      isCorrect,
    };
  });

  const score = (correct / tryout.questions.length) * 100;

  await prisma.$transaction([
    prisma.tryoutAnswer.deleteMany({ where: { resultId: result.id } }),
    prisma.tryoutAnswer.createMany({ data: answerRecords }),
    prisma.tryoutResult.update({
      where: { id: result.id },
      data: {
        completedAt: new Date(),
        score,
        durationSeconds: tryout.durationMinutes * 60,
      },
    }),
  ]);

  if (!isPolriPsikoTryout(tryout)) {
    return { resultId: result.id, score, correct, total: tryout.questions.length };
  }

  const sequence = await getPsikoSequenceTryouts(tryout.subCategoryId);
  const currentIndex = sequence.findIndex((item) => item.id === tryout.id);
  const nextTryout = currentIndex >= 0 ? sequence[currentIndex + 1] : null;
  if (!nextTryout) {
    const nextCermatMode = await getPsikoCermatMode();
    return {
      resultId: result.id,
      score,
      correct,
      total: tryout.questions.length,
      nextCermatMode,
    };
  }

  const breakSeconds = await getPsikoBreakSeconds();
  return {
    resultId: result.id,
    score,
    correct,
    total: tryout.questions.length,
    nextSession: {
      slug: nextTryout.slug,
      name: nextTryout.name,
      sessionOrder: nextTryout.sessionOrder,
      breakSeconds,
    },
  };
}

export async function getTryoutHistory(userId: string) {
  return prisma.tryoutResult.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      tryout: {
        select: {
          name: true,
          sessionOrder: true,
          subCategory: { select: { name: true, category: { select: { name: true } } } },
        },
      },
    },
  });
}

export async function getTryoutReview(resultId: string, userId: string) {
  const result = await prisma.tryoutResult.findFirst({
    where: { id: resultId, userId },
    include: {
      tryout: {
        select: {
          id: true,
          name: true,
          slug: true,
          isFree: true,
          sessionOrder: true,
          subCategory: {
            select: {
              name: true,
              slug: true,
              category: { select: { name: true, slug: true } },
            },
          },
          totalQuestions: true,
          durationMinutes: true,
          questions: {
            orderBy: { order: 'asc' },
            include: { options: { select: { id: true, label: true, imageUrl: true, isCorrect: true } } },
          },
        },
      },
      answers: {
        select: { questionId: true, optionId: true, isCorrect: true },
      },
    },
  });

  if (!result) {
    throw new HttpError('Hasil tryout tidak ditemukan.', 404);
  }

  await ensureTryoutAccess(userId, { isFree: result.tryout.isFree });

  const answerMap = new Map<string, { optionId: string | null; isCorrect: boolean }>();
  result.answers.forEach((answer) => {
    answerMap.set(answer.questionId, { optionId: answer.optionId ?? null, isCorrect: answer.isCorrect });
  });

  const questions = result.tryout.questions.map((question) => {
    const answer = answerMap.get(question.id);
    return {
      id: question.id,
      order: question.order,
        prompt: question.prompt,
        imageUrl: question.imageUrl,
        explanation: question.explanation,
        explanationImageUrl: question.explanationImageUrl ?? null,
        options: question.options,
        userOptionId: answer?.optionId ?? null,
        isCorrect: answer?.isCorrect ?? false,
      };
  });

  return {
    tryout: {
      id: result.tryout.id,
      name: result.tryout.name,
      slug: result.tryout.slug,
      isFree: result.tryout.isFree,
      sessionOrder: result.tryout.sessionOrder,
      isPsikoSession: isPolriPsikoTryout({
        sessionOrder: result.tryout.sessionOrder,
        subCategory: {
          name: result.tryout.subCategory.name,
          slug: result.tryout.subCategory.slug,
          category: {
            name: result.tryout.subCategory.category.name,
            slug: result.tryout.subCategory.category.slug,
          },
        },
      }),
      totalQuestions: result.tryout.totalQuestions,
      durationMinutes: result.tryout.durationMinutes,
    },
    score: result.score ?? 0,
    completedAt: result.completedAt ?? result.createdAt,
    questions,
  };
}

export async function getTryoutPackageReview(resultId: string, userId: string) {
  const anchorResult = await prisma.tryoutResult.findFirst({
    where: { id: resultId, userId },
    include: {
      tryout: {
        select: {
          id: true,
          isFree: true,
          freeForNewMembers: true,
          freePackageIds: true,
          sessionOrder: true,
          subCategory: {
            select: {
              id: true,
              name: true,
              slug: true,
              category: { select: { name: true, slug: true } },
            },
          },
        },
      },
    },
  });

  if (!anchorResult) {
    throw new HttpError('Hasil tryout tidak ditemukan.', 404);
  }

  await ensureTryoutAccess(userId, {
    isFree: anchorResult.tryout.isFree,
    freeForNewMembers: anchorResult.tryout.freeForNewMembers,
    freePackageIds: anchorResult.tryout.freePackageIds,
  });

  const isPsiko = isPolriPsikoTryout({
    sessionOrder: anchorResult.tryout.sessionOrder,
    subCategory: {
      name: anchorResult.tryout.subCategory.name,
      slug: anchorResult.tryout.subCategory.slug,
      category: {
        name: anchorResult.tryout.subCategory.category.name,
        slug: anchorResult.tryout.subCategory.category.slug,
      },
    },
  });

  if (!isPsiko) {
    throw new HttpError('Tryout ini bukan paket POLRI / PSIKO.', 400);
  }

  const sequence = await prisma.tryout.findMany({
    where: {
      subCategoryId: anchorResult.tryout.subCategory.id,
      isPublished: true,
      sessionOrder: { not: null },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      sessionOrder: true,
      totalQuestions: true,
      durationMinutes: true,
    },
    orderBy: [{ sessionOrder: 'asc' }, { createdAt: 'asc' }],
  });

  if (!sequence.length) {
    throw new HttpError('Data paket PSIKO tidak ditemukan.', 404);
  }

  const recentCompleted = await prisma.tryoutResult.findMany({
    where: {
      userId,
      completedAt: { not: null },
      tryoutId: { in: sequence.map((item) => item.id) },
    },
    include: {
      tryout: {
        select: { sessionOrder: true },
      },
    },
    orderBy: { completedAt: 'desc' },
    take: Math.max(sequence.length * 5, 20),
  });

  const resultIdBySessionOrder = new Map<number, string>();
  recentCompleted.forEach((item) => {
    const order = item.tryout.sessionOrder;
    if (!order) return;
    if (!resultIdBySessionOrder.has(order)) {
      resultIdBySessionOrder.set(order, item.id);
    }
  });

  const selectedResultIds = Array.from(resultIdBySessionOrder.values());
  if (!selectedResultIds.length) {
    throw new HttpError('Belum ada data pembahasan paket PSIKO.', 404);
  }

  const packageResults = await prisma.tryoutResult.findMany({
    where: { id: { in: selectedResultIds }, userId },
    include: {
      tryout: {
        select: {
          id: true,
          name: true,
          slug: true,
          sessionOrder: true,
          totalQuestions: true,
          durationMinutes: true,
          questions: {
            orderBy: { order: 'asc' },
            include: { options: { select: { id: true, label: true, imageUrl: true, isCorrect: true } } },
          },
        },
      },
      answers: {
        select: { questionId: true, optionId: true, isCorrect: true },
      },
    },
  });

  const resultMap = new Map(packageResults.map((item) => [item.id, item]));

  const sections = sequence
    .map((item) => {
      const order = item.sessionOrder;
      if (!order) return null;
      const selectedResultId = resultIdBySessionOrder.get(order);
      if (!selectedResultId) return null;
      const result = resultMap.get(selectedResultId);
      if (!result) return null;

      const answerMap = new Map<string, { optionId: string | null; isCorrect: boolean }>();
      result.answers.forEach((answer) => {
        answerMap.set(answer.questionId, { optionId: answer.optionId ?? null, isCorrect: answer.isCorrect });
      });

      const questions = result.tryout.questions.map((question) => {
        const answer = answerMap.get(question.id);
        return {
          id: question.id,
          order: question.order,
          prompt: question.prompt,
          imageUrl: question.imageUrl,
          explanation: question.explanation,
          explanationImageUrl: question.explanationImageUrl ?? null,
          options: question.options,
          userOptionId: answer?.optionId ?? null,
          isCorrect: answer?.isCorrect ?? false,
        };
      });

      return {
        sessionOrder: order,
        resultId: result.id,
        score: result.score ?? 0,
        completedAt: result.completedAt ?? result.createdAt,
        tryout: {
          id: result.tryout.id,
          name: result.tryout.name,
          slug: result.tryout.slug,
          totalQuestions: result.tryout.totalQuestions,
          durationMinutes: result.tryout.durationMinutes,
        },
        questions,
      };
    })
    .filter((item) => Boolean(item));

  const validSections = sections as Array<{
    sessionOrder: number;
    resultId: string;
    score: number;
    completedAt: Date;
    tryout: { id: string; name: string; slug: string; totalQuestions: number; durationMinutes: number };
    questions: Array<{
      id: string;
      order: number;
      prompt: string;
      imageUrl: string | null;
      explanation: string | null;
      explanationImageUrl: string | null;
      options: Array<{ id: string; label: string; imageUrl: string | null; isCorrect: boolean }>;
      userOptionId: string | null;
      isCorrect: boolean;
    }>;
  }>;

  const totalScore = validSections.reduce((acc, item) => acc + item.score, 0);
  const totalCorrect = validSections.reduce(
    (acc, item) => acc + item.questions.filter((question) => question.isCorrect).length,
    0,
  );
  const totalQuestions = validSections.reduce((acc, item) => acc + item.questions.length, 0);

  return {
    package: {
      categoryName: anchorResult.tryout.subCategory.category.name,
      subCategoryName: anchorResult.tryout.subCategory.name,
      totalSessions: sequence.length,
      cermatMode: await getPsikoCermatMode(),
    },
    overall: {
      averageScore: validSections.length ? totalScore / validSections.length : 0,
      totalCorrect,
      totalQuestions,
    },
    sections: validSections,
  };
}
