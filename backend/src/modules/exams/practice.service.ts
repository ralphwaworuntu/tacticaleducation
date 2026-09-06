import { ExamBlockType } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { HttpError } from '../../middlewares/errorHandler';
import { ensureExamAccess as ensureExamBlockAccess } from './exam-block.service';
import { assertExamAccess } from './exam-control.service';
import { assertMembershipFeature, assertActiveMembership, getActiveMembership, isPremiumUser } from '../../utils/membership';
import {
  getCorrectOptionIds,
  gradeAnswerDetailed,
  normalizeSelectedOptionIds,
  parseStoredAnswerIds,
  questionHasMultipleCorrect,
} from '../../utils/examGrading';

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
        select: {
          id: true,
          prompt: true,
          imageUrl: true,
          order: true,
          multipleCorrect: true,
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

  await ensurePracticeAccess(userId, set);
  await ensureExamBlockAccess(userId, ExamBlockType.PRACTICE, 'STANDARD');
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
        select: {
          id: true,
          prompt: true,
          imageUrl: true,
          order: true,
          multipleCorrect: true,
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

  await ensurePracticeAccess(userId, set);
  await ensureExamBlockAccess(userId, ExamBlockType.PRACTICE, 'UJIAN');
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
  input: { answers: Array<{ questionId: string; optionId?: string; optionIds?: string[] }> },
) {
  const set = await prisma.practiceSet.findUnique({
    where: { slug },
    include: { questions: { include: { options: true } } },
  });
  if (!set) {
    throw new HttpError('Latihan soal tidak ditemukan', 404);
  }

  await ensurePracticeAccess(userId, set);

  const result = await prisma.practiceResult.create({ data: { userId, setId: set.id } });

  const questionMap = new Map(set.questions.map((question) => [question.id, question]));

  let earnedCredit = 0;
  let correct = 0;
  const data = input.answers.map((answer) => {
    const question = questionMap.get(answer.questionId);
    const correctIds = getCorrectOptionIds(question?.options ?? []);
    const selectedIds = normalizeSelectedOptionIds(answer);
    const graded = gradeAnswerDetailed(selectedIds, correctIds);
    earnedCredit += graded.credit;
    if (graded.isCorrect) correct += 1;
    return {
      resultId: result.id,
      questionId: answer.questionId,
      optionId: selectedIds[0] ?? null,
      ...(selectedIds.length ? { selectedOptionIds: selectedIds } : {}),
      userId,
      isCorrect: graded.isCorrect,
    };
  });

  const total = set.questions.length || 1;
  const score = (earnedCredit / total) * 100;

  await prisma.$transaction([
    prisma.practiceAnswer.createMany({ data }),
    prisma.practiceResult.update({
      where: { id: result.id },
      data: { score, completedAt: new Date() },
    }),
  ]);

  return { resultId: result.id, score, correct, earnedCredit, total };
}

async function ensurePracticeAccess(userId: string, set: { isFree: boolean; freeForNewMembers?: boolean; freePackageIds?: unknown }) {
  if (await isPremiumUser(userId)) {
    return assertActiveMembership(userId);
  }

  const membership = await getActiveMembership(userId);
  const freePackages: string[] =
    Array.isArray(set.freePackageIds) || typeof set.freePackageIds === 'object'
      ? (set.freePackageIds as string[])
      : [];

  if (!membership) {
    if (!set.isFree || set.freeForNewMembers === false) {
      throw new HttpError('Membership tidak aktif atau belum divalidasi admin.', 403, { code: 'MEMBERSHIP_REQUIRED' });
    }
    return null;
  }

  if (set.isFree && (set.freeForNewMembers || freePackages.includes(membership.packageId))) {
    return membership;
  }

  assertMembershipFeature(membership, 'PRACTICE');
  return membership;
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
          isFree: true,
          subSubCategory: {
            select: {
              id: true,
              name: true,
              subCategory: {
                select: {
                  id: true,
                  name: true,
                  category: { select: { id: true, name: true, slug: true } },
                },
              },
            },
          },
          questions: {
            orderBy: { order: 'asc' },
            include: { options: { select: { id: true, label: true, imageUrl: true, isCorrect: true } } },
          },
        },
      },
      answers: {
        select: { questionId: true, optionId: true, selectedOptionIds: true, isCorrect: true },
      },
    },
  });

  if (!result) {
    throw new HttpError('Hasil latihan tidak ditemukan.', 404);
  }

  await ensurePracticeAccess(userId, { isFree: result.set.isFree });

  const answerMap = new Map<
    string,
    { optionId: string | null; selectedOptionIds: string[]; isCorrect: boolean }
  >();
  result.answers.forEach((answer) => {
    const selectedOptionIds = parseStoredAnswerIds(answer);
    answerMap.set(answer.questionId, {
      optionId: answer.optionId ?? null,
      selectedOptionIds,
      isCorrect: answer.isCorrect,
    });
  });

  const questions = result.set.questions.map((question, index) => {
    const answer = answerMap.get(question.id);
    const selectedOptionIds = answer?.selectedOptionIds ?? [];
    const graded = gradeAnswerDetailed(selectedOptionIds, getCorrectOptionIds(question.options));
    return {
      id: question.id,
      order: question.order ?? index + 1,
      prompt: question.prompt,
      imageUrl: question.imageUrl,
      explanation: question.explanation,
      explanationImageUrl: question.explanationImageUrl ?? null,
      multipleCorrect: question.multipleCorrect ?? questionHasMultipleCorrect(question.options),
      options: question.options,
      userOptionId: selectedOptionIds[0] ?? answer?.optionId ?? null,
      userOptionIds: selectedOptionIds,
      isCorrect: graded.isCorrect,
      credit: graded.credit,
      gradeStatus: graded.status,
    };
  });

  return {
    set: {
      id: result.set.id,
      title: result.set.title,
      slug: result.set.slug,
      level: result.set.level,
      isFree: result.set.isFree,
      subSubCategory: {
        id: result.set.subSubCategory.id,
        name: result.set.subSubCategory.name,
        subCategory: {
          id: result.set.subSubCategory.subCategory.id,
          name: result.set.subSubCategory.subCategory.name,
          category: {
            id: result.set.subSubCategory.subCategory.category.id,
            name: result.set.subSubCategory.subCategory.category.name,
            slug: result.set.subSubCategory.subCategory.category.slug,
          },
        },
      },
    },
    score: result.score ?? 0,
    completedAt: result.completedAt ?? result.createdAt,
    questions,
  };
}
