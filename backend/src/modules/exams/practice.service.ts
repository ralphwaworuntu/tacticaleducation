import { ExamBlockType } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { HttpError } from '../../middlewares/errorHandler';
import { ensureExamAccess as ensureExamBlockAccess } from './exam-block.service';
import { assertExamAccess } from './exam-control.service';

export function listPracticeCategories() {
  return prisma.practiceCategory.findMany({
    include: {
      subCategories: {
        orderBy: { createdAt: 'asc' },
        include: {
          subSubs: {
            orderBy: { createdAt: 'asc' },
            include: {
              sets: {
                orderBy: { createdAt: 'asc' },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
}

function ensurePracticeSchedule(set: { openAt: Date | null; closeAt: Date | null }) {
  const now = new Date();
  if (set.openAt && now < set.openAt) {
    throw new HttpError('Latihan soal belum dibuka sesuai jadwal.', 403);
  }
  if (set.closeAt && now > set.closeAt) {
    throw new HttpError('Latihan soal telah ditutup.', 403);
  }
}

export async function getPracticeInfo(slug: string) {
  const set = await prisma.practiceSet.findUnique({
    where: { slug },
    include: {
      subSubCategory: {
        include: { subCategory: { include: { category: true } } },
      },
    },
  });
  if (!set) {
    throw new HttpError('Latihan soal tidak ditemukan', 404);
  }
  return set;
}

export async function getPracticeSet(slug: string, userId: string) {
  const set = await prisma.practiceSet.findUnique({
    where: { slug },
    include: {
      subSubCategory: {
        include: { subCategory: { include: { category: true } } },
      },
      questions: {
        orderBy: { order: 'asc' },
        include: {
          options: {
            select: { id: true, label: true, imageUrl: true },
          },
        },
      },
    },
  });
  if (!set) {
    throw new HttpError('Latihan soal tidak ditemukan', 404);
  }

  await ensureExamBlockAccess(userId, ExamBlockType.PRACTICE);
  ensurePracticeSchedule(set);
  const shuffle = <T,>(arr: T[]) => {
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = arr[i]!;
      arr[i] = arr[j]!;
      arr[j] = temp;
    }
    return arr;
  };

  const randomizedQuestions = shuffle([...set.questions]).map((question) => ({
    ...question,
    options: shuffle([...question.options]),
  }));

  return {
    ...set,
    questions: randomizedQuestions,
  };
}

export async function getExamPracticeSet(slug: string, userId: string) {
  const set = await prisma.practiceSet.findUnique({
    where: { slug },
    include: {
      subSubCategory: {
        include: { subCategory: { include: { category: true } } },
      },
      questions: {
        orderBy: { order: 'asc' },
        include: {
          options: {
            select: { id: true, label: true, imageUrl: true },
          },
        },
      },
    },
  });
  if (!set) {
    throw new HttpError('Latihan soal tidak ditemukan', 404);
  }

  await ensureExamBlockAccess(userId, ExamBlockType.PRACTICE);
  await assertExamAccess(userId, 'EXAM');
  ensurePracticeSchedule(set);
  const shuffle = <T,>(arr: T[]) => {
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = arr[i]!;
      arr[i] = arr[j]!;
      arr[j] = temp;
    }
    return arr;
  };

  const randomizedQuestions = shuffle([...set.questions]).map((question) => ({
    ...question,
    options: shuffle([...question.options]),
  }));

  return {
    ...set,
    questions: randomizedQuestions,
  };
}

export async function submitPractice(
  slug: string,
  userId: string,
  input: { answers: Array<{ questionId: string; optionId?: string }> },
) {
  const set = await prisma.practiceSet.findUnique({
    where: { slug },
    include: { questions: { include: { options: true } } },
  });
  if (!set) {
    throw new HttpError('Latihan soal tidak ditemukan', 404);
  }

  const result = await prisma.practiceResult.create({ data: { userId, setId: set.id } });

  const correctnessMap = new Map(
    set.questions.map((question) => [
      question.id,
      question.options.find((option) => option.isCorrect)?.id,
    ]),
  );

  let correct = 0;
  const data = input.answers.map((answer) => {
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

  const score = (correct / set.questions.length) * 100;

  await prisma.$transaction([
    prisma.practiceAnswer.createMany({ data }),
    prisma.practiceResult.update({
      where: { id: result.id },
      data: { score, completedAt: new Date() },
    }),
  ]);

  return { resultId: result.id, score, correct, total: set.questions.length };
}

export function getPracticeHistory(userId: string) {
  return prisma.practiceResult.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      set: { select: { title: true, subSubCategory: { select: { name: true, subCategory: { select: { name: true, category: { select: { name: true } } } } } } } },
    },
  });
}

export async function getPracticeReview(resultId: string, userId: string) {
  const result = await prisma.practiceResult.findFirst({
    where: { id: resultId, userId },
    include: {
      set: {
        select: {
          id: true,
          title: true,
          slug: true,
          level: true,
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
    throw new HttpError('Hasil latihan tidak ditemukan.', 404);
  }

  const answerMap = new Map<string, { optionId: string | null; isCorrect: boolean }>();
  result.answers.forEach((answer) => {
    answerMap.set(answer.questionId, { optionId: answer.optionId ?? null, isCorrect: answer.isCorrect });
  });

  const questions = result.set.questions.map((question, index) => {
    const answer = answerMap.get(question.id);
    return {
      id: question.id,
      order: question.order ?? index + 1,
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
    set: {
      id: result.set.id,
      title: result.set.title,
      slug: result.set.slug,
      level: result.set.level,
    },
    score: result.score ?? 0,
    completedAt: result.completedAt ?? result.createdAt,
    questions,
  };
}
