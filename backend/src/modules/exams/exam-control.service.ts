import { HttpError } from '../../middlewares/errorHandler';
import { prisma } from '../../config/prisma';
import { getActiveMembership, isPremiumUser } from '../../utils/membership';

type ExamControlInput = {
  enabled: boolean;
  targetAll: boolean;
  targetPackageIds: string[];
  tryoutQuota: number;
  examQuota: number;
  startAt?: string | null;
  endAt?: string | null;
};

type ExamSectionStatus = {
  enabled: boolean;
  allowed: boolean;
  targetAll: boolean;
  targetPackageIds: string[];
  tryoutQuota: number;
  examQuota: number;
  tryoutsUsed: number;
  examsUsed: number;
  startAt?: string | null;
  endAt?: string | null;
};

type ExamQuotaType = 'TRYOUT' | 'EXAM';

async function getConfigRecord() {
  const existing = await prisma.examControlConfig.findFirst();
  if (existing) return existing;
  return prisma.examControlConfig.create({
    data: {
      enabled: false,
      targetAll: true,
      targetPackageIds: [],
      tryoutQuota: 0,
      examQuota: 0,
      startAt: null,
      endAt: null,
    },
  });
}

export async function getExamControlConfig() {
  return getConfigRecord();
}

export async function updateExamControlConfig(input: ExamControlInput) {
  const config = await getConfigRecord();
  const startAt = input.startAt ? new Date(input.startAt) : null;
  const endAt = input.endAt ? new Date(input.endAt) : null;
  const next = await prisma.examControlConfig.update({
    where: { id: config.id },
    data: {
      enabled: input.enabled,
      targetAll: input.targetAll,
      targetPackageIds: input.targetPackageIds ?? [],
      tryoutQuota: input.tryoutQuota,
      examQuota: input.examQuota,
      startAt,
      endAt,
    },
  });
  if (config.enabled && !input.enabled) {
    await prisma.examQuotaUsage.updateMany({
      data: { tryoutsUsed: 0, examsUsed: 0 },
    });
  }
  return next;
}

function normalizeTargetPackages(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function memberMatchesPackages(targetPackages: unknown, membershipPackageId?: string | null) {
  const normalized = normalizeTargetPackages(targetPackages);
  if (!normalized.length) return false;
  if (!membershipPackageId) return false;
  return normalized.includes(membershipPackageId);
}

function isWithinSchedule(config: { startAt?: Date | null; endAt?: Date | null }, now = new Date()) {
  if (config.startAt && now < config.startAt) return false;
  if (config.endAt && now > config.endAt) return false;
  return true;
}

function getEffectiveEnabled(config: { enabled: boolean; startAt?: Date | null; endAt?: Date | null }, now = new Date()) {
  const hasSchedule = Boolean(config.startAt || config.endAt);
  if (!hasSchedule) return config.enabled;
  return isWithinSchedule(config, now);
}

export async function getExamSectionStatus(userId: string): Promise<ExamSectionStatus> {
  const config = await getConfigRecord();
  const [membership, premium] = await Promise.all([getActiveMembership(userId), isPremiumUser(userId)]);
  const effectiveEnabled = getEffectiveEnabled(config);
  const allowed =
    effectiveEnabled &&
    (config.targetAll || premium || memberMatchesPackages(config.targetPackageIds, membership?.packageId ?? null));
  const usage = await prisma.examQuotaUsage.findUnique({ where: { userId } });
  return {
    enabled: effectiveEnabled,
    allowed,
    targetAll: config.targetAll,
    targetPackageIds: normalizeTargetPackages(config.targetPackageIds),
    tryoutQuota: config.tryoutQuota,
    examQuota: config.examQuota,
    tryoutsUsed: usage?.tryoutsUsed ?? 0,
    examsUsed: usage?.examsUsed ?? 0,
    startAt: config.startAt ? config.startAt.toISOString() : null,
    endAt: config.endAt ? config.endAt.toISOString() : null,
  };
}

async function ensureUsageRecord(userId: string) {
  const [record] = await Promise.all([
    prisma.examQuotaUsage.upsert({
      where: { userId },
      create: { userId, tryoutsUsed: 0, examsUsed: 0 },
      update: {},
    }),
  ]);
  return record;
}

export async function assertExamAccess(userId: string, type: ExamQuotaType) {
  const config = await getConfigRecord();
  const [membership, premium] = await Promise.all([getActiveMembership(userId), isPremiumUser(userId)]);
  const effectiveEnabled = getEffectiveEnabled(config);
  const allowed =
    effectiveEnabled &&
    (config.targetAll || premium || memberMatchesPackages(config.targetPackageIds, membership?.packageId ?? null));
  if (!allowed) {
    throw new HttpError('Akses ujian tidak diizinkan untuk akun ini.', 403);
  }
  if (type === 'TRYOUT' && config.tryoutQuota > 0) {
    const usage = await ensureUsageRecord(userId);
    if (usage.tryoutsUsed >= config.tryoutQuota) {
      throw new HttpError('Kuota tryout untuk ujian sudah habis.', 403);
    }
    await prisma.examQuotaUsage.update({
      where: { id: usage.id },
      data: { tryoutsUsed: { increment: 1 } },
    });
  }
  if (type === 'EXAM' && config.examQuota > 0) {
    const usage = await ensureUsageRecord(userId);
    if (usage.examsUsed >= config.examQuota) {
      throw new HttpError('Kuota ujian soal sudah habis.', 403);
    }
    await prisma.examQuotaUsage.update({
      where: { id: usage.id },
      data: { examsUsed: { increment: 1 } },
    });
  }
}

export async function ensureExamAccessAllowed(userId: string) {
  const config = await getConfigRecord();
  const [membership, premium] = await Promise.all([getActiveMembership(userId), isPremiumUser(userId)]);
  const effectiveEnabled = getEffectiveEnabled(config);
  const allowed =
    effectiveEnabled &&
    (config.targetAll || premium || memberMatchesPackages(config.targetPackageIds, membership?.packageId ?? null));
  if (!allowed) {
    throw new HttpError('Akses ujian tidak diizinkan untuk akun ini.', 403);
  }
  return config;
}

export { ExamSectionStatus };
