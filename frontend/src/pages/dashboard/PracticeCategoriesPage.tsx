import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { getAssetUrl } from '@/lib/media';
import type { PracticeCategory } from '@/types/exam';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMembershipStatus } from '@/hooks/useMembershipStatus';

export function PracticeCategoriesPage() {
  const navigate = useNavigate();
  const membership = useMembershipStatus();
  const hasActiveMembership = Boolean(membership.data?.isActive);
  const { data: categories, isLoading } = useQuery({
    queryKey: ['practice-categories'],
    queryFn: () => apiGet<PracticeCategory[]>('/exams/practice/categories'),
  });

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

  return (
    <section className="space-y-6">
      {!hasActiveMembership && (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Kamu belum memiliki paket aktif. Kamu tetap bisa melihat kategori latihan, tetapi hanya latihan gratis yang bisa dikerjakan.
        </section>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Kategori Latihan Soal</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Pilih Kategori Latihan</h1>
          <p className="mt-2 text-sm text-slate-600">Masuk ke kategori untuk melihat sub kategori latihan.</p>
        </div>
        <Button variant="outline" onClick={() => navigate('/app/latihan-soal/riwayat')}>
          Lihat Riwayat Latihan
        </Button>
      </div>
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Kuota Latihan Soal</p>
          <h3 className="mt-2 text-3xl font-bold text-slate-900">
            {membership.data?.moduleRemaining === null || membership.data?.moduleRemaining === undefined
              ? 'Tidak terbatas'
              : `${membership.data.moduleRemaining} kali tersisa`}
          </h3>
          {typeof membership.data?.moduleQuota === 'number' && (
            <p className="text-sm text-slate-500">
              Total {membership.data.moduleQuota} - Terpakai {membership.data.moduleUsed ?? 0}
            </p>
          )}
        </div>
        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5 text-sm text-slate-600">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Aturan Anti-Cheat</p>
          <ul className="mt-3 list-disc space-y-1 pl-4">
            <li>Latihan berjalan dalam mode layar penuh.</li>
            <li>Dilarang membuka tab atau aplikasi lain selama mengerjakan.</li>
            <li>Pelanggaran dapat menghentikan sesi latihan.</li>
          </ul>
        </div>
      </section>
      {categories.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
          Belum ada kategori latihan.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => {
            const cover = getAssetUrl(category.imageUrl) || '/Alumni.png';
            return (
              <Card key={category.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <img src={cover} alt={category.name} className="h-36 w-full object-cover" loading="lazy" />
                  <div className="space-y-2 p-4">
                    <h3 className="text-lg font-semibold text-slate-900">{category.name}</h3>
                    <p className="text-sm text-slate-600">{category.subCategories.length} sub kategori tersedia.</p>
                    <Button className="w-full" onClick={() => navigate(`/app/latihan-soal/kategori/${category.slug}`)}>
                      Lihat Sub Kategori
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
