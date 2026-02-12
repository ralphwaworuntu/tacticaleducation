import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { getAssetUrl } from '@/lib/media';
import type { PracticeCategory } from '@/types/exam';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMembershipStatus } from '@/hooks/useMembershipStatus';

export function PracticeSubCategoriesPage() {
  const navigate = useNavigate();
  const { categorySlug } = useParams<{ categorySlug: string }>();
  const membership = useMembershipStatus();
  const hasActiveMembership = Boolean(membership.data?.isActive);
  const { data: categories, isLoading } = useQuery({
    queryKey: ['practice-categories'],
    queryFn: () => apiGet<PracticeCategory[]>('/exams/practice/categories'),
  });

  const selectedCategory = useMemo(
    () => categories?.find((category) => category.slug === categorySlug) ?? null,
    [categories, categorySlug],
  );

  if (membership.isLoading) {
    return <Skeleton className="h-72" />;
  }

  if (hasActiveMembership && membership.data?.allowPractice === false) {
    return (
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        Paket membership kamu tidak mencakup akses latihan soal. Hubungi admin untuk upgrade paket.
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
    <section className="space-y-6">
      {!hasActiveMembership && (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Kamu belum memiliki paket aktif. Kamu tetap bisa melihat sub kategori latihan, tetapi hanya latihan gratis yang bisa dikerjakan.
        </section>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Sub Kategori Latihan</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">{selectedCategory.name}</h1>
          <p className="mt-2 text-sm text-slate-600">Pilih sub kategori untuk melihat sub sub kategori.</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/app/latihan-soal')}>
          Kembali
        </Button>
      </div>
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
                      onClick={() => navigate(`/app/latihan-soal/kategori/${selectedCategory.slug}/sub/${subCategory.id}`)}
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
