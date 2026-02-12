import { ExamBlockType } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { HttpError } from '../../middlewares/errorHandler';

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const examBlockConfigKeys = {
  practice: 'exam_block_practice_enabled',
  tryout: 'exam_block_tryout_enabled',
  exam: 'exam_block_exam_enabled',
} as const;

export type ExamBlockConfig = {
  practiceEnabled: boolean;
  tryoutEnabled: boolean;
  examEnabled: boolean;
};

export type ExamBlockContext = 'STANDARD' | 'UJIAN';

function getBooleanSetting(map: Record<string, string>, key: string, fallback: boolean) {
  if (!(key in map)) return fallback;
  return map[key] === 'true';
}

export async function getExamBlockConfig(): Promise<ExamBlockConfig> {
  const settings = await prisma.siteSetting.findMany({
    where: { key: { in: Object.values(examBlockConfigKeys) } },
  });
  const map = settings.reduce<Record<string, string>>((acc, setting) => {
    acc[setting.key] = setting.value;
    return acc;
  }, {});
  return {
    practiceEnabled: getBooleanSetting(map, examBlockConfigKeys.practice, true),
    tryoutEnabled: getBooleanSetting(map, examBlockConfigKeys.tryout, true),
    examEnabled: getBooleanSetting(map, examBlockConfigKeys.exam, true),
  };
}

export async function updateExamBlockConfig(input: ExamBlockConfig): Promise<ExamBlockConfig> {
  await Promise.all([
    prisma.siteSetting.upsert({
      where: { key: examBlockConfigKeys.practice },
      update: { value: String(input.practiceEnabled) },
      create: { key: examBlockConfigKeys.practice, value: String(input.practiceEnabled) },
    }),
    prisma.siteSetting.upsert({
      where: { key: examBlockConfigKeys.tryout },
      update: { value: String(input.tryoutEnabled) },
      create: { key: examBlockConfigKeys.tryout, value: String(input.tryoutEnabled) },
    }),
    prisma.siteSetting.upsert({
      where: { key: examBlockConfigKeys.exam },
      update: { value: String(input.examEnabled) },
      create: { key: examBlockConfigKeys.exam, value: String(input.examEnabled) },
    }),
  ]);
  return getExamBlockConfig();
}

function isExamBlockEnabled(config: ExamBlockConfig, type: ExamBlockType, context: ExamBlockContext) {
  if (context === 'UJIAN') {
    return config.examEnabled;
  }
  return type === ExamBlockType.PRACTICE ? config.practiceEnabled : config.tryoutEnabled;
}

export async function ensureExamAccess(userId: string, type: ExamBlockType, context: ExamBlockContext = 'STANDARD') {
  const config = await getExamBlockConfig();
  if (!isExamBlockEnabled(config, type, context)) {
    return;
  }
  const activeBlock = await prisma.examBlock.findFirst({ where: { userId, type, resolvedAt: null } });
  if (activeBlock) {
    throw new HttpError('Akses ujian sedang diblokir. Hubungi admin untuk kode buka blokir.', 423);
  }
}

export async function recordExamViolation(
  userId: string,
  type: ExamBlockType,
  reason?: string,
  context: ExamBlockContext = 'STANDARD',
) {
  const config = await getExamBlockConfig();
  if (!isExamBlockEnabled(config, type, context)) {
    return null;
  }
  const existing = await prisma.examBlock.findFirst({ where: { userId, type, resolvedAt: null } });
  const code = generateCode();
  if (existing) {
    return prisma.examBlock.update({
      where: { id: existing.id },
      data: {
        violationCount: { increment: 1 },
        code,
        blockedAt: new Date(),
        reason: reason ?? existing.reason,
      },
    });
  }
  return prisma.examBlock.create({ data: { userId, type, reason: reason ?? null, code } });
}

export async function listUserExamBlocks(userId: string, context: ExamBlockContext = 'STANDARD') {
  const config = await getExamBlockConfig();
  if (context === 'UJIAN' && !config.examEnabled) {
    return [];
  }
  const enabledTypes =
    context === 'UJIAN'
      ? [ExamBlockType.PRACTICE, ExamBlockType.TRYOUT]
      : [
          ...(config.practiceEnabled ? [ExamBlockType.PRACTICE] : []),
          ...(config.tryoutEnabled ? [ExamBlockType.TRYOUT] : []),
        ];
  if (enabledTypes.length === 0) {
    return [];
  }
  return prisma.examBlock.findMany({
    where: { userId, resolvedAt: null, type: { in: enabledTypes } },
    orderBy: { blockedAt: 'desc' },
    select: {
      id: true,
      type: true,
      reason: true,
      blockedAt: true,
      violationCount: true,
    },
  });
}

export async function unlockExamBlock(userId: string, type: ExamBlockType, code: string) {
  const block = await prisma.examBlock.findFirst({ where: { userId, type, resolvedAt: null } });
  if (!block) {
    throw new HttpError('Tidak ada blokir aktif untuk ujian ini.', 404);
  }
  if (block.code !== code) {
    throw new HttpError('Kode buka blokir salah.', 400);
  }
  await prisma.examBlock.update({
    where: { id: block.id },
    data: { resolvedAt: new Date(), code: generateCode() },
  });
}

export async function regenerateExamBlockCode(blockId: string) {
  const block = await prisma.examBlock.findUnique({ where: { id: blockId } });
  if (!block || block.resolvedAt) {
    throw new HttpError('Blokir ujian tidak ditemukan atau sudah selesai.', 404);
  }
  const code = generateCode();
  return prisma.examBlock.update({ where: { id: blockId }, data: { code } });
}
