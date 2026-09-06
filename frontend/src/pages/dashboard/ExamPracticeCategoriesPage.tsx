import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { getAssetUrl } from '@/lib/media';
import type { PracticeCategory } from '@/types/exam';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useExamControlStatus } from '@/hooks/useExamControl';
import { PageHeader } from '@/components/common/PageHeader';

export function ExamPracticeCategoriesPage() {
  const navigate = useNavigate();
  const examStatus = useExamControlStatus();
  const examEnabled = Boolean(examStatus.data?.enabled && examStatus.data?.allowed);
  const { data: categories, isLoading } = useQuery({
    queryKey: ['exam-practice-categories'],
    queryFn: () => apiGet<PracticeCategory[]>('/ujian/practice/categories'),
    enabled: examEnabled,
  });

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

  return (
    <section className="page-shell">
      <PageHeader
        eyebrow="Kategori Ujian Soal"
        title="Pilih Kategori Ujian"
        description="Masuk ke kategori untuk melihat sub kategori ujian."
        action={
          <Button variant="outline" onClick={() => navigate('/app/ujian/soal/riwayat')}>
            Lihat Riwayat Ujian
          </Button>
        }
      />
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Kuota Ujian Soal</p>
          <h3 className="mt-2 text-3xl font-bold text-slate-900">
            {examStatus.data?.examQuota === 0 || examStatus.data?.examQuota === undefined
              ? 'Tidak terbatas'
              : `${Math.max(examStatus.data.examQuota - examStatus.data.examsUsed, 0)} kali tersisa`}
          </h3>
          {typeof examStatus.data?.examQuota === 'number' && (
            <p className="text-sm text-slate-500">
              Total {examStatus.data.examQuota} - Terpakai {examStatus.data.examsUsed ?? 0}
            </p>
          )}
        </div>
        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5 text-sm text-slate-600">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Aturan Anti-Cheat</p>
          <ul className="mt-3 list-disc space-y-1 pl-4">
            <li>Ujian berjalan dalam mode layar penuh.</li>
            <li>Dilarang berpindah tab atau membuka aplikasi lain.</li>
            <li>Pelanggaran akan menghentikan sesi dan kuota tetap terhitung.</li>
          </ul>
        </div>
      </section>
      {categories.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
          Belum ada kategori ujian.
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
                    <Button className="w-full" onClick={() => navigate(`/app/ujian/soal/kategori/${category.slug}`)}>
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
