import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { getAssetUrl } from '@/lib/media';
import type { Tryout } from '@/types/exam';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useExamControlStatus } from '@/hooks/useExamControl';
import { useMembershipStatus } from '@/hooks/useMembershipStatus';

export function ExamTryoutListPage() {
  const navigate = useNavigate();
  const { categoryId, subCategoryId } = useParams<{ categoryId: string; subCategoryId: string }>();
  const examStatus = useExamControlStatus();
  const examEnabled = Boolean(examStatus.data?.enabled && examStatus.data?.allowed);
  const membership = useMembershipStatus();
  const hasActiveMembership = Boolean(membership.data?.isActive);
  const { data: tryouts, isLoading } = useQuery({
    queryKey: ['exam-tryouts'],
    queryFn: () => apiGet<Tryout[]>('/ujian/tryouts'),
    enabled: examEnabled,
  });
  const [nowTs, setNowTs] = useState(() => Date.now());

  const listing = useMemo(() => {
    if (!tryouts || !categoryId || !subCategoryId) return null;
    const items = tryouts.filter((item) => item.subCategory.id === subCategoryId);
    const categoryName = items[0]?.subCategory.category.name ?? '';
    const subCategoryName = items[0]?.subCategory.name ?? '';
    return { items, categoryName, subCategoryName };
  }, [categoryId, subCategoryId, tryouts]);

  const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString('id-ID') : null);
  const getScheduleText = (tryout: Tryout) => {
    const start = formatDateTime(tryout.openAt);
    const end = formatDateTime(tryout.closeAt);
    if (!start && !end) {
      return 'Tersedia sepanjang waktu';
    }
    return `${start ?? 'Segera'} - ${end ?? 'Tanpa batas'}`;
  };
  const getScheduleStatus = (tryout: Tryout) => {
    const now = nowTs;
    if (tryout.openAt && new Date(tryout.openAt).getTime() > now) {
      return { active: false, label: `Dibuka ${formatDateTime(tryout.openAt)}` };
    }
    if (tryout.closeAt && new Date(tryout.closeAt).getTime() < now) {
      return { active: false, label: 'Periode tryout berakhir' };
    }
    return { active: true, label: 'Sedang dibuka' };
  };

  useEffect(() => {
    const timer = window.setInterval(() => setNowTs(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  if (examStatus.isLoading) {
    return <Skeleton className="h-72" />;
  }

  if (!examEnabled) {
    return (
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        Akses ujian belum diaktifkan oleh admin atau tidak tersedia untuk akunmu.
      </section>
    );
  }

  if (isLoading || !tryouts) {
    return <Skeleton className="h-72" />;
  }

  if (!listing) {
    return (
      <section className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
        Sub kategori tidak ditemukan.
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Daftar Tryout Ujian</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">{listing.subCategoryName}</h1>
          <p className="mt-2 text-sm text-slate-600">{listing.categoryName}</p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate(`/app/ujian/tryout/kategori/${categoryId}`)}
        >
          Kembali
        </Button>
      </div>
      {listing.items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
          Belum ada tryout di sub kategori ini.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {listing.items.map((item) => {
            const status = getScheduleStatus(item);
            const cover = getAssetUrl(item.coverImageUrl) || getAssetUrl(item.subCategory.imageUrl) || '/Alumni.png';
            return (
              <Card key={item.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <img src={cover} alt={item.name} className="h-40 w-full object-cover" loading="lazy" />
                  <div className="space-y-2 p-4">
                    <p className="text-xs uppercase tracking-widest text-slate-500">
                      {item.subCategory.category.name} / {item.subCategory.name}
                    </p>
                    <h3 className="text-lg font-semibold text-slate-900">{item.name}</h3>
                    <p className="text-sm text-slate-600">{item.summary}</p>
                    <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {item.isFree && <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">Gratis</span>}
                      {!hasActiveMembership && !item.isFree && (
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">Butuh Paket</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">Jadwal: {getScheduleText(item)}</p>
                    <p className={`text-[11px] ${status.active ? 'text-emerald-600' : 'text-red-500'}`}>
                      Status: {status.label}
                    </p>
                    <Button className="w-full" onClick={() => navigate(`/app/ujian/tryout/detail/${item.slug}`)}>
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
