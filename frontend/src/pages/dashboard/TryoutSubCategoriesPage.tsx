import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { getAssetUrl } from '@/lib/media';
import type { Tryout } from '@/types/exam';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMembershipStatus } from '@/hooks/useMembershipStatus';

export function TryoutSubCategoriesPage() {
  const navigate = useNavigate();
  const { categoryId } = useParams<{ categoryId: string }>();
  const membership = useMembershipStatus();
  const hasActiveMembership = Boolean(membership.data?.isActive);
  const { data: tryouts, isLoading } = useQuery({
    queryKey: ['tryouts'],
    queryFn: () => apiGet<Tryout[]>('/exams/tryouts'),
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

  if (membership.isLoading) {
    return <Skeleton className="h-72" />;
  }

  if (hasActiveMembership && membership.data?.allowTryout === false) {
    return (
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        Paket membership kamu tidak mencakup akses latihan tryout. Hubungi admin untuk upgrade paket.
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
    <section className="space-y-6">
      {!hasActiveMembership && (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Kamu belum memiliki paket aktif. Kamu tetap bisa melihat daftar tryout, tetapi hanya tryout gratis yang bisa dikerjakan.
        </section>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Sub Kategori Tryout</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">{categoryGroup.name}</h1>
          <p className="mt-2 text-sm text-slate-600">Pilih sub kategori untuk melihat daftar tryout.</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/app/latihan/tryout')}>
          Kembali
        </Button>
      </div>
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
                    <p className="text-sm text-slate-600">Tryout untuk sub kategori {subCategory.name}.</p>
                    <Button
                      className="w-full"
                      onClick={() =>
                        navigate(`/app/latihan/tryout/kategori/${categoryGroup.id}/sub/${subCategory.id}`)
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
