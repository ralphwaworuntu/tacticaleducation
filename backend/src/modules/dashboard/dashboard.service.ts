import { prisma } from '../../config/prisma';
import { getActiveMembership, isPremiumUser } from '../../utils/membership';
import type { CalculatorSubmissionInput } from './dashboard.schemas';

async function ensureCalculatorTemplate(slug: string) {
  const existing = await prisma.psychCalculatorTemplate.findUnique({ where: { slug } });
  if (existing) return existing;

  return prisma.psychCalculatorTemplate.create({
    data: {
      title: 'Kalkulator Psikologi Dasar',
      slug,
      description: 'Hitung skor kesiapan psikotes berbasis self-assessment singkat.',
      config: {
        maxScorePerItem: 5,
        minScorePerItem: 1,
        interpretation: [
          { min: 0, max: 20, label: 'Perlu Latihan', color: 'red' },
          { min: 21, max: 35, label: 'Cukup', color: 'yellow' },
          { min: 36, max: 50, label: 'Baik', color: 'green' },
        ],
      },
    },
  });
}

export async function getDashboardOverview(userId: string) {
  const [membership, premium] = await Promise.all([getActiveMembership(userId), isPremiumUser(userId)]);
  const activePackageId = membership?.packageId ?? null;
  const [transactions, rawAnnouncements, tryoutResults, overviewSlides] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        code: true,
        amount: true,
        status: true,
        method: true,
        createdAt: true,
        type: true,
        package: { select: { name: true } },
        addon: { select: { name: true } },
      },
    }),
    prisma.announcement.findMany({ orderBy: { publishedAt: 'desc' }, take: 50 }),
    prisma.tryoutResult.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        score: true,
        startedAt: true,
        tryout: { select: { name: true, subCategory: { select: { name: true, category: { select: { name: true } } } } } },
      },
    }),
    prisma.memberOverviewSlide.findMany({ orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] }),
  ]);

  const counters = await prisma.tryoutResult.groupBy({
    by: ['userId'],
    _count: { _all: true },
    where: { userId },
  });

  const announcements = rawAnnouncements
    .filter((item) => {
      if (item.targetAll || premium) return true;
      if (!activePackageId) return false;
      const targets = Array.isArray(item.targetPackageIds) ? item.targetPackageIds : [];
      return targets.includes(activePackageId);
    })
    .slice(0, 5);

  return {
    transactions,
    announcements,
    tryoutResults,
    slides: overviewSlides,
    summary: {
      tryouts: counters[0]?._count._all ?? 0,
      materials: await prisma.material.count(),
      pendingPayments: await prisma.transaction.count({ where: { userId, status: 'PENDING' } }),
    },
  };
}

export async function getAnnouncements(userId: string) {
  const [membership, premium] = await Promise.all([getActiveMembership(userId), isPremiumUser(userId)]);
  const activePackageId = membership?.packageId ?? null;
  const items = await prisma.announcement.findMany({ orderBy: { publishedAt: 'desc' }, take: 200 });
  return items.filter((item) => {
    if (item.targetAll || premium) return true;
    if (!activePackageId) return false;
    const targets = Array.isArray(item.targetPackageIds) ? item.targetPackageIds : [];
    return targets.includes(activePackageId);
  });
}

export function getFaqs() {
  return prisma.faq.findMany({ orderBy: { order: 'asc' } });
}

export function getNews() {
  return prisma.newsArticle.findMany({ orderBy: { published: 'desc' } });
}

export async function getMemberBackgroundConfig() {
  const settings = await prisma.siteSetting.findMany({
    where: { key: { in: ['member_area_background_enabled', 'member_area_background_image'] } },
  });
  const map = settings.reduce<Record<string, string>>((acc, setting) => {
    acc[setting.key] = setting.value;
    return acc;
  }, {});
  return {
    enabled: map.member_area_background_enabled === 'true',
    imageUrl: map.member_area_background_image || null,
  };
}

function parseWelcomeModalItems(settings: Array<{ key: string; value: string }>) {
  const itemsSetting = settings.find((s) => s.key === 'welcome_modal_items');
  if (!itemsSetting?.value) return [];
  try {
    const parsed = JSON.parse(itemsSetting.value);
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => item?.id && item?.imageUrl);
    }
    return [];
  } catch {
    return [];
  }
}

export async function getWelcomeModalConfig() {
  const settings = await prisma.siteSetting.findMany({
    where: { key: { in: ['welcome_modal_items', 'welcome_modal_enabled', 'welcome_modal_image', 'welcome_modal_link'] } },
  });
  const items = parseWelcomeModalItems(settings).filter((item) => item.enabled !== false);
  const active = items[0];

  // Legacy fallback
  if (!active) {
    const map = settings.reduce<Record<string, string>>((acc, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {});
    if (map.welcome_modal_image) {
      return {
        enabled: map.welcome_modal_enabled === 'true',
        imageUrl: map.welcome_modal_image || null,
        linkUrl: map.welcome_modal_link || null,
      };
    }
  }

  return {
    enabled: Boolean(active),
    imageUrl: active?.imageUrl || null,
    linkUrl: active?.linkUrl || null,
    id: active?.id,
  };
}

export async function submitCalculator(userId: string, input: CalculatorSubmissionInput) {
  const calculator = await ensureCalculatorTemplate(input.slug);
  const rawScore = input.answers.reduce((acc, curr) => acc + curr, 0);
  const interpretationConfig = Array.isArray((calculator.config as any)?.interpretation)
    ? ((calculator.config as any).interpretation as Array<{ min: number; max: number; label: string }>)
    : [];
  const interpretation =
    interpretationConfig.find((item) => rawScore >= item.min && rawScore <= item.max)?.label || 'Cukup';

  const submission = await prisma.psychCalculatorSubmission.create({
    data: {
      calculatorId: calculator.id,
      userId,
      score: rawScore,
      interpretation,
      payload: { answers: input.answers },
    },
  });

  return submission;
}
