import { ExamBlockType } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { HttpError } from '../../middlewares/errorHandler';
import { assertMembershipFeature, consumeTryoutQuota, getActiveMembership } from '../../utils/membership';
import { ensureExamAccess as ensureExamBlockAccess } from './exam-block.service';
import { assertExamAccess } from './exam-control.service';

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

async function ensureTryoutAccess(userId: string, tryout: { isFree: boolean }) {
  const membership = await getActiveMembership(userId);
  if (!membership) {
    if (!tryout.isFree) {
      throw new HttpError('Membership tidak aktif atau belum divalidasi admin.', 403, { code: 'MEMBERSHIP_REQUIRED' });
    }
    return null;
  }
  assertMembershipFeature(membership, 'TRYOUT');
  return membership;
}

export async function startTryout(slug: string, userId: string) {
  const tryout = await prisma.tryout.findUnique({ where: { slug } });
  if (!tryout || !tryout.isPublished) {
    throw new HttpError('Tryout tidak ditemukan', 404);
  }

  await ensureExamBlockAccess(userId, ExamBlockType.TRYOUT, 'STANDARD');
  const membership = await ensureTryoutAccess(userId, tryout);

  const recentWindowMs = 2 * 60 * 1000;
  const recentThreshold = new Date(Date.now() - recentWindowMs);
  const recentActive = await prisma.tryoutResult.findFirst({
    where: {
      userId,
      tryoutId: tryout.id,
      completedAt: null,
      startedAt: { gte: recentThreshold },
    },
    orderBy: { startedAt: 'desc' },
  });

  if (recentActive) {
    return { resultId: recentActive.id, durationMinutes: tryout.durationMinutes };
  }

  const now = new Date();
  if (tryout.openAt && now < tryout.openAt) {
    throw new HttpError('Tryout belum dibuka sesuai jadwal.', 403);
  }
  if (tryout.closeAt && now > tryout.closeAt) {
    throw new HttpError('Tryout telah ditutup.', 403);
  }

  if (membership) {
    await consumeTryoutQuota(userId);
  }

  const result = await prisma.tryoutResult.create({
    data: {
      userId,
      tryoutId: tryout.id,
    },
  });

  return { resultId: result.id, durationMinutes: tryout.durationMinutes };
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
    include: { questions: { include: { options: true } } },
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

  return { resultId: result.id, score, correct, total: tryout.questions.length };
}

export async function getTryoutHistory(userId: string) {
  return prisma.tryoutResult.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      tryout: { select: { name: true, subCategory: { select: { name: true, category: { select: { name: true } } } } } },
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
      totalQuestions: result.tryout.totalQuestions,
      durationMinutes: result.tryout.durationMinutes,
    },
    score: result.score ?? 0,
    completedAt: result.completedAt ?? result.createdAt,
    questions,
  };
}
