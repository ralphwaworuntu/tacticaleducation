import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { getAssetUrl } from '@/lib/media';
import type { Tryout } from '@/types/exam';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useExamControlStatus } from '@/hooks/useExamControl';
import { PageHeader } from '@/components/common/PageHeader';

export function ExamTryoutSubCategoriesPage() {
  const navigate = useNavigate();
  const { categoryId } = useParams<{ categoryId: string }>();
  const examStatus = useExamControlStatus();
  const examEnabled = Boolean(examStatus.data?.enabled && examStatus.data?.allowed);
  const { data: tryouts, isLoading } = useQuery({
    queryKey: ['exam-tryouts'],
    queryFn: () => apiGet<Tryout[]>('/ujian/tryouts'),
    enabled: examEnabled,
  });

  const categoryGroup = useMemo(() => {
    if (!tryouts || !categoryId) return null;
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        thumbnail?: string | null;
        subCategories: Array<{ id: string; name: string; imageUrl?: string | null; tryouts: Tryout[] }>;
      }
    >();
    tryouts.forEach((item) => {
      const category = item.subCategory.category;
      if (!map.has(category.id)) {
        map.set(category.id, { id: category.id, name: category.name, thumbnail: category.thumbnail ?? null, subCategories: [] });
      }
      const group = map.get(category.id)!;
      let subGroup = group.subCategories.find((sub) => sub.id === item.subCategory.id);
      if (!subGroup) {
        subGroup = { id: item.subCategory.id, name: item.subCategory.name, imageUrl: item.subCategory.imageUrl ?? null, tryouts: [] };
        group.subCategories.push(subGroup);
      }
      subGroup.tryouts.push(item);
    });
    return map.get(categoryId) ?? null;
  }, [categoryId, tryouts]);

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

  if (isLoading || !tryouts) {
    return <Skeleton className="h-72" />;
  }

  if (!categoryGroup) {
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
        title={categoryGroup.name}
        description="Pilih sub kategori untuk melihat daftar tryout."
        action={
          <Button variant="outline" onClick={() => navigate('/app/ujian/tryout')}>
            Kembali
          </Button>
        }
      />
      {categoryGroup.subCategories.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
          Sub kategori belum tersedia.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {categoryGroup.subCategories.map((subCategory) => {
            const cover = getAssetUrl(subCategory.imageUrl) || getAssetUrl(categoryGroup.thumbnail) || '/Alumni.png';
            return (
              <Card key={subCategory.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <img src={cover} alt={subCategory.name} className="h-36 w-full object-cover" loading="lazy" />
                  <div className="space-y-2 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-lg font-semibold text-slate-900">{subCategory.name}</h3>
                      <span className="rounded-2xl bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        {subCategory.tryouts.length} paket
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">Tryout ujian untuk sub kategori {subCategory.name}.</p>
                    <Button
                      className="w-full"
                      onClick={() =>
                        navigate(`/app/ujian/tryout/kategori/${categoryGroup.id}/sub/${subCategory.id}`)
                      }
                    >
                      Lihat Daftar Soal
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
