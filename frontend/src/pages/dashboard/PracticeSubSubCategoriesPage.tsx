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
import { PageHeader } from '@/components/common/PageHeader';

export function PracticeSubSubCategoriesPage() {
  const navigate = useNavigate();
  const { categorySlug, subCategoryId } = useParams<{ categorySlug: string; subCategoryId: string }>();
  const membership = useMembershipStatus();
  const hasActiveMembership = Boolean(membership.data?.isActive);
  const { data: categories, isLoading } = useQuery({
    queryKey: ['practice-categories'],
    queryFn: () => apiGet<PracticeCategory[]>('/exams/practice/categories'),
  });

  const { category, subCategory } = useMemo(() => {
    const selectedCategory = categories?.find((item) => item.slug === categorySlug) ?? null;
    const selectedSubCategory = selectedCategory?.subCategories.find((sub) => sub.id === subCategoryId) ?? null;
    return { category: selectedCategory, subCategory: selectedSubCategory };
  }, [categories, categorySlug, subCategoryId]);

  if (membership.isLoading) {
    return <Skeleton className="h-72" />;
  }

  if (hasActiveMembership && membership.data?.allowPractice === false) {
    return (
      <section className="rounded-3xl border border-brand-200 bg-brand-50 p-6 text-sm text-brand-800">
        Paket membership kamu tidak mencakup akses latihan soal. Hubungi admin untuk upgrade paket.
      </section>
    );
  }

  if (isLoading || !categories) {
    return <Skeleton className="h-72" />;
  }

  if (!category || !subCategory) {
    return (
      <section className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
        Sub kategori tidak ditemukan.
      </section>
    );
  }

  return (
    <section className="page-shell">
      {!hasActiveMembership && (
        <section className="rounded-3xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800">
          Kamu belum memiliki paket aktif. Kamu tetap bisa melihat paket latihan, tetapi hanya latihan gratis yang bisa dikerjakan.
        </section>
      )}
      <PageHeader
        eyebrow="Sub Sub Kategori"
        title={subCategory.name}
        description="Pilih sub sub kategori untuk melihat paket soal."
        action={
          <Button variant="outline" onClick={() => navigate(`/app/latihan-soal/kategori/${category.slug}`)}>
            Kembali
          </Button>
        }
      />
      {subCategory.subSubs.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
          Sub sub kategori belum tersedia.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {subCategory.subSubs.map((subSub) => {
            const cover = getAssetUrl(subSub.imageUrl) || getAssetUrl(subCategory.imageUrl) || '/Alumni.png';
            return (
              <Card key={subSub.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <img src={cover} alt={subSub.name} className="h-36 w-full object-cover" loading="lazy" />
                  <div className="space-y-2 p-4">
                    <h3 className="text-lg font-semibold text-slate-900">{subSub.name}</h3>
                    <p className="text-sm text-slate-600">{subSub.sets.length} paket latihan.</p>
                    <Button
                      className="w-full"
                      onClick={() =>
                        navigate(`/app/latihan-soal/kategori/${category.slug}/sub/${subCategory.id}/subsub/${subSub.id}`)
                      }
                    >
                      Lihat Paket Soal
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
