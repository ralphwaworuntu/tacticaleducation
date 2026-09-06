import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { getAssetUrl } from '@/lib/media';
import type { PracticeSetInfo } from '@/types/exam';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useMembershipStatus } from '@/hooks/useMembershipStatus';
import { toast } from 'sonner';
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
    return { canStart: false, label: 'Periode latihan berakhir' };
  }
  return { canStart: true, label: 'Sedang dibuka' };
}

export function PracticeDetailPage() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const membership = useMembershipStatus();
  const hasActiveMembership = Boolean(membership.data?.isActive);
  const { data, isLoading } = useQuery({
    queryKey: ['practice-detail', slug],
    queryFn: () => apiGet<PracticeSetInfo>(`/exams/practice/${slug}/info`),
    enabled: Boolean(slug),
  });
  const returnTo = data
    ? `/app/latihan-soal/kategori/${data.subSubCategory.subCategory.category.slug}/sub/${data.subSubCategory.subCategory.id}/subsub/${data.subSubCategory.id}`
    : '/app/latihan-soal';

  const status = useMemo(() => getScheduleStatus(data?.openAt, data?.closeAt), [data?.closeAt, data?.openAt]);

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

  if (isLoading || !data) {
    return <Skeleton className="h-72" />;
  }

  const infoItems = [
    { label: 'Peminatan', value: data.subSubCategory.subCategory.category.name },
    { label: 'Kategori Mata Pelajaran', value: data.subSubCategory.subCategory.name },
    { label: 'Mata Pelajaran', value: data.subSubCategory.name },
    { label: 'Judul Latihan Soal', value: data.title },
    { label: 'Jumlah Soal', value: String(data.totalQuestions) },
    { label: 'Durasi', value: `${data.durationMinutes} menit` },
    { label: 'Akses Gratis', value: data.isFree ? 'Ya' : 'Tidak' },
    { label: 'Waktu Akses Mulai Latihan', value: formatDateTime(data.openAt) },
    { label: 'Waktu Akses Berakhir Latihan', value: formatDateTime(data.closeAt) },
  ];

  const handleStart = () => {
    if (!hasActiveMembership && !data.isFree) {
      toast.error('Aktifkan paket untuk mulai latihan.');
      return;
    }
    sessionStorage.setItem('practice_start_slug', data.slug);
    navigate('/app/latihan-soal/mulai', {
      state: { startPractice: { slug: data.slug }, returnTo },
    });
  };

  return (
    <section className="page-shell">
      <PageHeader
        eyebrow="Detail Latihan"
        title={data.title}
        description="Siapkan diri sebelum masuk mode layar penuh dan hitung mundur."
        action={
          <>
            <Button
              variant="ghost"
              onClick={() =>
                navigate(
                  `/app/latihan-soal/kategori/${data.subSubCategory.subCategory.category.slug}/sub/${data.subSubCategory.subCategory.id}/subsub/${data.subSubCategory.id}`,
                )
              }
            >
              Kembali
            </Button>
            <Button
              onClick={handleStart}
              disabled={!status.canStart || (!hasActiveMembership && !data.isFree)}
            >
              {status.canStart ? 'Mulai Latihan Soal' : status.label}
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="space-y-4 p-6">
          {getAssetUrl(data.coverImageUrl) && (
            <img
              src={getAssetUrl(data.coverImageUrl)}
              alt={data.title}
              className="h-56 w-full rounded-3xl object-cover md:h-72"
              loading="lazy"
            />
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <Badge variant={status.canStart ? 'brand' : 'outline'}>{status.label}</Badge>
            <span className="uppercase tracking-[0.3em]">{data.level ?? 'Umum'}</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {infoItems.map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{item.label}</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
