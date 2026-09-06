import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { getAssetUrl } from '@/lib/media';
import type { Tryout } from '@/types/exam';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useMembershipStatus } from '@/hooks/useMembershipStatus';
import { toast } from 'sonner';
import { getPsikoSequenceBySubCategory, isPolriPsikoTryout } from '@/utils/tryoutPackage';
import { PageHeader } from '@/components/common/PageHeader';

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString('id-ID') : '-';
}

function getScheduleStatus(openAt?: string | null, closeAt?: string | null) {
  const now = Date.now();
  if (openAt && new Date(openAt).getTime() > now) {
    return { canStart: false, label: `Dibuka ${formatDateTime(openAt)}` };
  }
  if (closeAt && new Date(closeAt).getTime() < now) {
    return { canStart: false, label: 'Periode tryout berakhir' };
  }
  return { canStart: true, label: 'Sedang dibuka' };
}

export function TryoutDetailPage() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const membership = useMembershipStatus();
  const hasActiveMembership = Boolean(membership.data?.isActive);
  const { data, isLoading } = useQuery({
    queryKey: ['tryout-detail', slug],
    queryFn: () => apiGet<Tryout>(`/exams/tryouts/${slug}/info`),
    enabled: Boolean(slug),
  });
  const { data: allTryouts } = useQuery({
    queryKey: ['tryouts'],
    queryFn: () => apiGet<Tryout[]>('/exams/tryouts'),
    enabled: Boolean(slug),
  });
  const returnTo = data
    ? `/app/latihan/tryout/kategori/${data.subCategory.category.id}/sub/${data.subCategory.id}`
    : '/app/latihan/tryout';
  const psikoSessions = useMemo(() => {
    if (!data || !allTryouts || !isPolriPsikoTryout(data)) return [];
    return getPsikoSequenceBySubCategory(allTryouts, data.subCategory.id);
  }, [allTryouts, data]);
  const isPsikoPackage = Boolean(data && isPolriPsikoTryout(data));
  const packageHeadTryout = psikoSessions[0] ?? data ?? null;
  const packageIsFree = isPsikoPackage
    ? (psikoSessions.length ? psikoSessions.every((item) => Boolean(item.isFree)) : Boolean(data?.isFree))
    : Boolean(data?.isFree);
  const packageStartSlug = packageHeadTryout?.slug ?? data?.slug ?? '';
  const status = useMemo(
    () => getScheduleStatus(packageHeadTryout?.openAt, packageHeadTryout?.closeAt),
    [packageHeadTryout?.closeAt, packageHeadTryout?.openAt],
  );

  if (membership.isLoading) {
    return <Skeleton className="h-72" />;
  }

  if (hasActiveMembership && membership.data?.allowTryout === false) {
    return (
      <section className="rounded-3xl border border-brand-200 bg-brand-50 p-6 text-sm text-brand-800">
        Paket membership kamu tidak mencakup akses latihan tryout. Hubungi admin untuk upgrade paket.
      </section>
    );
  }

  if (isLoading || !data) {
    return <Skeleton className="h-72" />;
  }

  const infoItems = [
    { label: 'Peminatan', value: data.subCategory.category.name },
    { label: 'Kategori Mata Pelajaran', value: data.subCategory.name },
    { label: 'Judul Tryout', value: isPsikoPackage ? 'PAKET SOAL PSIKO' : data.name },
    { label: isPsikoPackage ? 'Jumlah Sesi' : 'Jumlah Soal', value: isPsikoPackage ? String(psikoSessions.length) : String(data.totalQuestions) },
    {
      label: isPsikoPackage ? 'Total Soal Paket' : 'Durasi',
      value: isPsikoPackage
        ? String(psikoSessions.reduce((acc, item) => acc + item.totalQuestions, 0))
        : `${data.durationMinutes} menit`,
    },
    {
      label: isPsikoPackage ? 'Total Durasi Paket' : 'Akses Gratis',
      value: isPsikoPackage
        ? `${psikoSessions.reduce((acc, item) => acc + item.durationMinutes, 0)} menit`
        : data.isFree
          ? 'Ya'
          : 'Tidak',
    },
    {
      label: isPsikoPackage ? 'Akses Gratis Paket' : 'Waktu Akses Mulai Tryout',
      value: isPsikoPackage
        ? packageIsFree
          ? 'Ya'
          : 'Tidak'
        : formatDateTime(data.openAt),
    },
    {
      label: isPsikoPackage ? 'Waktu Akses Mulai Paket' : 'Waktu Akses Berakhir Tryout',
      value: isPsikoPackage ? formatDateTime(packageHeadTryout?.openAt) : formatDateTime(data.closeAt),
    },
    ...(isPsikoPackage ? [{ label: 'Waktu Akses Berakhir Paket', value: formatDateTime(packageHeadTryout?.closeAt) }] : []),
  ];

  const handleStart = () => {
    if (!packageHeadTryout || !packageStartSlug) return;
    if (!hasActiveMembership && !packageIsFree) {
      toast.error('Aktifkan paket untuk mulai tryout.');
      return;
    }
    sessionStorage.setItem('tryout_start_slug', packageStartSlug);
    navigate('/app/latihan/tryout/mulai', {
      state: { startTryoutSlug: packageStartSlug, returnTo },
    });
  };

  return (
    <section className="page-shell">
      <PageHeader
        eyebrow="Detail Tryout"
        title={isPsikoPackage ? 'PAKET SOAL PSIKO' : data.name}
        description="Siapkan diri sebelum masuk mode layar penuh dan hitung mundur."
        action={
          <>
            <Button
              variant="ghost"
              onClick={() =>
                navigate(`/app/latihan/tryout/kategori/${data.subCategory.category.id}/sub/${data.subCategory.id}`)
              }
            >
              Kembali
            </Button>
            <Button
              onClick={handleStart}
              disabled={!status.canStart || (!hasActiveMembership && !packageIsFree)}
            >
              {status.canStart ? (isPsikoPackage ? 'Mulai Paket Soal' : 'Mulai Tryout') : status.label}
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="space-y-4 p-6">
          {getAssetUrl(data.coverImageUrl) && (
            <img
              src={getAssetUrl(data.coverImageUrl)}
              alt={data.name}
              className="h-56 w-full rounded-3xl object-cover md:h-72"
              loading="lazy"
            />
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <Badge variant={status.canStart ? 'brand' : 'outline'}>{status.label}</Badge>
            <span className="uppercase tracking-[0.3em]">{data.subCategory.category.name}</span>
            {isPsikoPackage && <Badge variant="outline">PAKET SOAL</Badge>}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {infoItems.map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{item.label}</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>
          {isPsikoPackage && psikoSessions.length > 0 && (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Detail Sesi Paket</p>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {psikoSessions.map((session) => (
                  <div key={session.id} className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-sm font-semibold text-slate-900">Sesi {session.sessionOrder}</p>
                    <p className="text-xs text-slate-600">{session.name}</p>
                    <p className="text-xs text-slate-500">
                      {session.totalQuestions} soal • {session.durationMinutes} menit
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
