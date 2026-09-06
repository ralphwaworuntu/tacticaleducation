import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { getAssetUrl } from '@/lib/media';
import type { PracticeCategory } from '@/types/exam';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useExamControlStatus } from '@/hooks/useExamControl';
import { useMembershipStatus } from '@/hooks/useMembershipStatus';
import { PageHeader } from '@/components/common/PageHeader';

export function ExamPracticeSetsPage() {
  const navigate = useNavigate();
  const { categorySlug, subCategoryId, subSubId } = useParams<{
    categorySlug: string;
    subCategoryId: string;
    subSubId: string;
  }>();
  const examStatus = useExamControlStatus();
  const examEnabled = Boolean(examStatus.data?.enabled && examStatus.data?.allowed);
  const membership = useMembershipStatus();
  const hasActiveMembership = Boolean(membership.data?.isActive);
  const { data: categories, isLoading } = useQuery({
    queryKey: ['exam-practice-categories'],
    queryFn: () => apiGet<PracticeCategory[]>('/ujian/practice/categories'),
    enabled: examEnabled,
  });

  const selection = useMemo(() => {
    const category = categories?.find((item) => item.slug === categorySlug) ?? null;
    const subCategory = category?.subCategories.find((sub) => sub.id === subCategoryId) ?? null;
    const subSub = subCategory?.subSubs.find((item) => item.id === subSubId) ?? null;
    return { category, subCategory, subSub };
  }, [categories, categorySlug, subCategoryId, subSubId]);

  if (examStatus.isLoading) {
    return <Skeleton className="h-72" />;
  }

  if (!examEnabled) {
    return (
      <section className="rounded-3xl border border-brand-200 bg-brand-50 p-6 text-sm text-brand-800">
        Akses ujian belum diaktifkan oleh admin atau tidak tersedia untuk akunmu.
      </section>
    );
  }

  if (isLoading || !categories) {
    return <Skeleton className="h-72" />;
  }

  if (!selection.category || !selection.subCategory || !selection.subSub) {
    return (
      <section className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
        Paket soal tidak ditemukan.
      </section>
    );
  }

  const { category, subCategory, subSub } = selection;
  const sets = subSub.sets;

  return (
    <section className="page-shell">
      <PageHeader
        eyebrow="Paket Ujian Soal"
        title={subSub.name}
        description={`${subCategory.name} - ${category.name}`}
        action={
          <Button
            variant="outline"
            onClick={() => navigate(`/app/ujian/soal/kategori/${category.slug}/sub/${subCategory.id}`)}
          >
            Kembali
          </Button>
        }
      />
      {sets.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
          Belum ada paket soal di sub sub kategori ini.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sets.map((set) => {
            const cover = getAssetUrl(set.coverImageUrl) || getAssetUrl(subSub.imageUrl) || '/Alumni.png';
            return (
              <Card key={set.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <img src={cover} alt={set.title} className="h-40 w-full object-cover" loading="lazy" />
                  <div className="space-y-2 p-4">
                    <h3 className="text-lg font-semibold text-slate-900">{set.title}</h3>
                    <p className="text-sm text-slate-600">{set.description}</p>
                    <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {set.isFree && <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">Gratis</span>}
                      {!hasActiveMembership && !set.isFree && (
                        <span className="rounded-full bg-brand-100 px-2 py-1 text-brand-700">Butuh Paket</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                      <span>{set.totalQuestions} soal</span>
                      <span>-</span>
                      <span>{set.durationMinutes} menit</span>
                    </div>
                    <Button className="w-full" onClick={() => navigate(`/app/ujian/soal/detail/${set.slug}`)}>
                      Lihat Detail
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
