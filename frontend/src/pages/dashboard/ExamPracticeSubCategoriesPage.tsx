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
import { PageHeader } from '@/components/common/PageHeader';

export function ExamPracticeSubCategoriesPage() {
  const navigate = useNavigate();
  const { categorySlug } = useParams<{ categorySlug: string }>();
  const examStatus = useExamControlStatus();
  const examEnabled = Boolean(examStatus.data?.enabled && examStatus.data?.allowed);
  const { data: categories, isLoading } = useQuery({
    queryKey: ['exam-practice-categories'],
    queryFn: () => apiGet<PracticeCategory[]>('/ujian/practice/categories'),
    enabled: examEnabled,
  });

  const selectedCategory = useMemo(
    () => categories?.find((category) => category.slug === categorySlug) ?? null,
    [categories, categorySlug],
  );

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

  if (!selectedCategory) {
    return (
      <section className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
        Kategori tidak ditemukan.
      </section>
    );
  }

  return (
    <section className="page-shell">
      <PageHeader
        eyebrow="Sub Kategori Ujian"
        title={selectedCategory.name}
        description="Pilih sub kategori untuk melihat sub sub kategori."
        action={
          <Button variant="outline" onClick={() => navigate('/app/ujian/soal')}>
            Kembali
          </Button>
        }
      />
      {selectedCategory.subCategories.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
          Sub kategori belum tersedia.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {selectedCategory.subCategories.map((subCategory) => {
            const cover = getAssetUrl(subCategory.imageUrl) || getAssetUrl(selectedCategory.imageUrl) || '/Alumni.png';
            return (
              <Card key={subCategory.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <img src={cover} alt={subCategory.name} className="h-36 w-full object-cover" loading="lazy" />
                  <div className="space-y-2 p-4">
                    <h3 className="text-lg font-semibold text-slate-900">{subCategory.name}</h3>
                    <p className="text-sm text-slate-600">{subCategory.subSubs.length} sub sub kategori.</p>
                    <Button
                      className="w-full"
                      onClick={() => navigate(`/app/ujian/soal/kategori/${selectedCategory.slug}/sub/${subCategory.id}`)}
                    >
                      Lihat Sub Sub Kategori
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
