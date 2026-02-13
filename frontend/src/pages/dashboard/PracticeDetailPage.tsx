import { useMemo, useState } from 'react';
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
import { useFullscreenExam } from '@/hooks/useFullscreenExam';
import { toast } from 'sonner';
import { ExamCountdownModal } from '@/components/dashboard/ExamCountdownModal';

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
  const [fullscreenGateOpen, setFullscreenGateOpen] = useState(false);
  const [countdownOpen, setCountdownOpen] = useState(false);
  const [countdownToken, setCountdownToken] = useState(0);
  const { data, isLoading } = useQuery({
    queryKey: ['practice-detail', slug],
    queryFn: () => apiGet<PracticeSetInfo>(`/exams/practice/${slug}/info`),
    enabled: Boolean(slug),
  });
  const { request: requestFullscreen, isSupported: fullscreenSupported } = useFullscreenExam({ active: false });
  const returnTo = slug ? `/app/latihan-soal/detail/${slug}` : '/app/latihan-soal';

  const status = useMemo(() => getScheduleStatus(data?.openAt, data?.closeAt), [data?.closeAt, data?.openAt]);
  const backToList = useMemo(() => {
    const categorySlug = data?.subSubCategory?.subCategory?.category?.slug;
    const subCategoryId = data?.subSubCategory?.subCategory?.id;
    const subSubId = data?.subSubCategory?.id;
    if (!categorySlug || !subCategoryId || !subSubId) return null;
    return `/app/latihan-soal/kategori/${categorySlug}/sub/${subCategoryId}/subsub/${subSubId}`;
  }, [data?.subSubCategory]);

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

  return (
    <div className="space-y-6">
      {!hasActiveMembership && (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Kamu belum memiliki paket aktif. Hanya latihan gratis yang bisa dikerjakan.
        </section>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Detail Latihan Soal</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">{data.title}</h1>
          <p className="mt-2 text-sm text-slate-600">{data.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => (backToList ? navigate(backToList) : navigate(-1))}>
            Kembali
          </Button>
          <Button
            onClick={() => {
              if (!hasActiveMembership && !data.isFree) {
                toast.error('Aktifkan paket untuk mulai latihan.');
                return;
              }
              if (!fullscreenSupported) {
                setCountdownToken((prev) => prev + 1);
                setCountdownOpen(true);
                return;
              }
              setFullscreenGateOpen(true);
            }}
            disabled={!status.canStart || (!hasActiveMembership && !data.isFree)}
          >
            {status.canStart ? 'Mulai Latihan Soal' : status.label}
          </Button>
        </div>
      </div>

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
      {fullscreenGateOpen && fullscreenSupported && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/70 px-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl">
            <p className="text-xs uppercase tracking-[0.4em] text-brand-500">Persiapan Latihan</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">Aktifkan Layar Penuh</h2>
            <p className="mt-2 text-sm text-slate-500">Klik tombol di bawah untuk masuk fullscreen lalu mulai latihan.</p>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="ghost" onClick={() => setFullscreenGateOpen(false)}>
                Batal
              </Button>
              <Button
                onClick={async () => {
                  try {
                    await requestFullscreen();
                  } catch {
                    toast.error('Mode layar penuh wajib diizinkan untuk memulai latihan.');
                    return;
                  }
                  setFullscreenGateOpen(false);
                  setCountdownToken((prev) => prev + 1);
                  setCountdownOpen(true);
                }}
              >
                Aktifkan & Mulai
              </Button>
            </div>
          </div>
        </div>
      )}
      <ExamCountdownModal
        open={countdownOpen}
        resetKey={countdownToken}
        title="Mulai Latihan"
        subtitle="Tetap berada di halaman ini hingga selesai."
        onComplete={() => {
          if (!data) return;
          sessionStorage.setItem('practice_start_slug', data.slug);
          setCountdownOpen(false);
          navigate('/app/latihan-soal/mulai?skipCountdown=1', {
            state: { startPractice: { slug: data.slug }, returnTo, skipCountdown: true },
          });
        }}
        onCancel={() => setCountdownOpen(false)}
      />
    </div>
  );
}
