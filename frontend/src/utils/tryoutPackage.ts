import type { Tryout } from '@/types/exam';

type TryoutLike = Pick<Tryout, 'sessionOrder' | 'subCategory'>;

function normalizeWord(value?: string | null) {
  return (value ?? '').trim().toLowerCase();
}

function matchesKeyword(name?: string | null, slug?: string | null, keyword?: string) {
  const key = normalizeWord(keyword);
  return normalizeWord(name) === key || normalizeWord(slug) === key;
}

export function isPolriPsikoTryout(tryout: TryoutLike) {
  return (
    tryout.sessionOrder !== null &&
    tryout.sessionOrder !== undefined &&
    matchesKeyword(tryout.subCategory.category.name, tryout.subCategory.category.slug, 'polri') &&
    matchesKeyword(tryout.subCategory.name, tryout.subCategory.slug, 'psiko')
  );
}

export type TryoutDisplayItem = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  coverImageUrl?: string | null;
  durationMinutes: number;
  totalQuestions: number;
  isFree?: boolean;
  openAt?: string | null;
  closeAt?: string | null;
  subCategory: Tryout['subCategory'];
  isPackage: boolean;
  packageLabel?: string;
  sessionCount: number;
  sessions: Tryout[];
};

export function buildTryoutDisplayItems(items: Tryout[]) {
  const regularItems: TryoutDisplayItem[] = [];
  const packageMap = new Map<string, Tryout[]>();

  items.forEach((item) => {
    if (!isPolriPsikoTryout(item)) {
      regularItems.push({
        id: item.id,
        slug: item.slug,
        name: item.name,
        summary: item.summary,
        coverImageUrl: item.coverImageUrl,
        durationMinutes: item.durationMinutes,
        totalQuestions: item.totalQuestions,
        isFree: item.isFree,
        openAt: item.openAt,
        closeAt: item.closeAt,
        subCategory: item.subCategory,
        isPackage: false,
        sessionCount: 1,
        sessions: [item],
      });
      return;
    }

    const key = item.subCategory.id;
    const list = packageMap.get(key) ?? [];
    list.push(item);
    packageMap.set(key, list);
  });

  const packageItems: TryoutDisplayItem[] = Array.from(packageMap.values())
    .map((sessions) => sessions.sort((a, b) => (a.sessionOrder ?? 0) - (b.sessionOrder ?? 0)))
    .map((sessions) => {
      const firstSession = sessions[0]!;
      const totalQuestions = sessions.reduce((acc, item) => acc + item.totalQuestions, 0);
      const totalMinutes = sessions.reduce((acc, item) => acc + item.durationMinutes, 0);
      const packageIsFree = sessions.every((item) => Boolean(item.isFree));
      return {
        id: `package-${firstSession.subCategory.id}`,
        slug: firstSession.slug,
        name: firstSession.subCategory.name,
        summary: `Paket soal berisi ${sessions.length} sesi berurutan (1 sampai ${sessions.length}).`,
        coverImageUrl: firstSession.coverImageUrl,
        durationMinutes: totalMinutes,
        totalQuestions,
        isFree: packageIsFree,
        openAt: firstSession.openAt,
        closeAt: firstSession.closeAt,
        subCategory: firstSession.subCategory,
        isPackage: true,
        packageLabel: 'PAKET SOAL',
        sessionCount: sessions.length,
        sessions,
      };
    });

  return [...packageItems, ...regularItems];
}

export function getPsikoSequenceBySubCategory(tryouts: Tryout[], subCategoryId: string) {
  return tryouts
    .filter((item) => item.subCategory.id === subCategoryId && isPolriPsikoTryout(item))
    .sort((a, b) => (a.sessionOrder ?? 0) - (b.sessionOrder ?? 0));
}
