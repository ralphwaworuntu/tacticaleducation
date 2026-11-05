import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, ChevronRight, ClipboardList, Eye, FolderOpen } from 'lucide-react';
import { apiGet } from '@/lib/api';
import type { DashboardOverview } from '@/types/dashboard';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/utils/format';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { getAssetUrl } from '@/lib/media';
import { useMembershipStatus } from '@/hooks/useMembershipStatus';

const quickAccess = [
  { to: '/app/latihan/tryout', label: 'Tryout', hint: 'Simulasi tes', icon: ClipboardList, tone: 'blue' as const },
  { to: '/app/latihan-soal', label: 'Latihan Soal', hint: 'Bank soal harian', icon: BookOpen, tone: 'purple' as const },
  { to: '/app/tes-kecermatan', label: 'Tes Kecermatan', hint: 'Latihan cepat', icon: Eye, tone: 'amber' as const },
  { to: '/app/materi', label: 'Materi Belajar', hint: 'Modul & video', icon: FolderOpen, tone: 'teal' as const },
];

export function DashboardHomePage() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard-overview'], queryFn: () => apiGet<DashboardOverview>('/dashboard/overview') });
  const { user } = useAuth();
  const membership = useMembershipStatus();
  const slides = data?.slides ?? [];
  const firstName = user?.name?.trim().split(/\s+/)[0] ?? 'Siswa';

  if (isLoading || !data) {
    return <Skeleton className="h-96" />;
  }

  return (
    <div className="page-shell">
      <section className="te-welcome relative overflow-hidden rounded-[14px] px-5 py-6 text-white shadow-sm sm:px-7 sm:py-7">
        <span className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/10" aria-hidden />
        <span className="pointer-events-none absolute -bottom-12 right-16 h-28 w-28 rotate-12 rounded-2xl border border-white/15" aria-hidden />
        <span className="pointer-events-none absolute bottom-4 left-[42%] h-16 w-16 rounded-full bg-[#3478F6]/25" aria-hidden />
        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">Tactical Edukasi</p>
          <h1 className="mt-2 text-[1.375rem] font-bold tracking-tight sm:text-[1.75rem]">Selamat Datang, {firstName}!</h1>
          <p className="mt-1 max-w-xl text-sm text-white/85 sm:text-base">Siap melanjutkan persiapan tes hari ini?</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild className="bg-white text-brand-700 hover:bg-slate-100">
              <Link to="/app/latihan-soal">Mulai Latihan</Link>
            </Button>
            <Button asChild variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20">
              <Link to="/app/materi">Lihat Materi</Link>
            </Button>
          </div>
        </div>
      </section>

      {user?.role === 'MEMBER' && !user.membership?.isActive && (
        <div className="rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
          <p className="text-sm font-semibold">Membership belum aktif</p>
          <p className="text-xs text-amber-800">Selesaikan pembayaran agar admin dapat mengaktifkan akses tryout & materi.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link to="/app/paket-membership">Lihat Paket</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/app/konfirmasi-pembayaran">Konfirmasi Pembayaran</Link>
            </Button>
          </div>
        </div>
      )}

      <section>
        <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Akses cepat</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {quickAccess.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className="te-access-card flex items-center gap-3 pr-3"
                data-tone={item.tone}
              >
                <span className={`te-icon te-icon-${item.tone}`}>
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold text-slate-900">{item.label}</span>
                  <span className="block text-xs text-slate-500">{item.hint}</span>
                </span>
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-500" aria-hidden>
                  <ChevronRight className="h-4 w-4" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <span className="te-dot te-dot-blue" aria-hidden /> Tryout selesai
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{data.summary.tryouts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <span className="te-dot te-dot-teal" aria-hidden /> Materi tersedia
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{data.summary.materials}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <span className="te-dot te-dot-amber" aria-hidden /> Pembayaran pending
            </p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{data.summary.pendingPayments}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">Status membership</p>
            <p className="mt-2">
              <span
                className={
                  membership.data?.isPremium
                    ? 'status-chip status-chip-warning'
                    : membership.data?.isActive
                      ? 'status-chip status-chip-success'
                      : 'status-chip status-chip-warning'
                }
              >
                {membership.data?.isPremium ? 'Premium' : membership.data?.isActive ? 'Aktif' : 'Belum aktif'}
              </span>
            </p>
            <p className="mt-2 text-xs text-slate-400">Kode orang tua: {user?.memberArea?.slug ?? '-'}</p>
          </CardContent>
        </Card>
      </section>

      {slides.length > 0 && <DashboardHeroSlider key={slides.map((slide) => slide.id).join(':')} slides={slides} />}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Pengumuman" subtitle="Informasi terbaru dari admin" />
          <CardContent className="p-0">
            {data.announcements.length === 0 ? (
              <p className="px-6 py-8 text-sm text-slate-500">Belum ada pengumuman.</p>
            ) : (
              <ul className={`divide-y divide-slate-100 ${data.announcements.length > 3 ? 'max-h-[18rem] overflow-y-auto' : ''}`}>
                {data.announcements.map((item) => (
                  <li key={item.id} className="space-y-3 px-6 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="shrink-0 text-xs text-slate-500">{formatDate(item.publishedAt)}</p>
                    </div>
                    {item.imageUrl && (
                      <img src={getAssetUrl(item.imageUrl)} alt={item.title} className="h-28 w-full rounded-xl object-cover" loading="lazy" />
                    )}
                    <p className="text-sm text-slate-600">{item.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Aktivitas terbaru" subtitle="Riwayat tryout kamu" />
          <CardContent className="p-0">
            {data.tryoutResults.length === 0 ? (
              <p className="px-6 py-8 text-sm text-slate-500">Belum ada tryout yang dikerjakan.</p>
            ) : (
              <ul className={`divide-y divide-slate-100 ${data.tryoutResults.length > 3 ? 'max-h-[18rem] overflow-y-auto' : ''}`}>
                {data.tryoutResults.map((result) => (
                  <li key={result.id} className="px-6 py-4">
                    <p className="text-sm font-semibold text-slate-900">{result.tryout.name}</p>
                    <p className="text-xs text-slate-500">
                      {result.tryout.subCategory.category.name} · {formatDate(result.startedAt)}
                    </p>
                    <p className="mt-1 text-2xl font-bold text-accent-amber">{Math.round(result.score)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader title="Transaksi terbaru" />
        <CardContent className="p-0">
          {data.transactions.length === 0 ? (
            <p className="px-6 py-8 text-sm text-slate-500">Belum ada transaksi.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Paket</th>
                    <th>Metode</th>
                    <th>Status</th>
                    <th>Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {data.transactions.map((trx) => {
                    const name = trx.type === 'ADDON' ? trx.addon?.name ?? 'Addon' : trx.package.name;
                    return (
                      <tr key={trx.id}>
                        <td className="font-semibold text-slate-900">{trx.code}</td>
                        <td>
                          <span className="block">{name}</span>
                          <span className="text-xs uppercase tracking-wide text-slate-400">
                            {trx.type === 'ADDON' ? 'Addon' : 'Membership'}
                          </span>
                        </td>
                        <td>{trx.method}</td>
                        <td>
                          <span
                            className={
                              trx.status === 'PAID'
                                ? 'status-chip status-chip-success'
                                : trx.status === 'REJECTED'
                                  ? 'status-chip status-chip-danger'
                                  : 'status-chip status-chip-warning'
                            }
                          >
                            {trx.status}
                          </span>
                        </td>
                        <td className="font-semibold text-slate-900">{formatCurrency(trx.amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type DashboardSlideItem = {
  id: string;
  imageUrl: string;
  title?: string | null;
  subtitle?: string | null;
  ctaLabel?: string | null;
  ctaLink?: string | null;
};

function DashboardHeroSlider({ slides }: { slides: DashboardSlideItem[] }) {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  return (
    <div className="relative overflow-hidden rounded-[14px] border border-slate-200 bg-slate-900 text-white">
      <div className="relative h-44 w-full sm:h-56 md:h-64">
        {slides.map((slide, index) => (
          <img
            key={slide.id}
            src={getAssetUrl(slide.imageUrl)}
            alt={slide.title ?? 'Dashboard slide'}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${index === activeSlide ? 'opacity-100' : 'opacity-0'}`}
            loading={index === 0 ? 'eager' : 'lazy'}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 to-slate-900/20" />
        <div className="relative flex h-full flex-col justify-center gap-2 px-6">
          <h2 className="text-xl font-bold sm:text-2xl">{slides[activeSlide]?.title ?? 'Tetap konsisten'}</h2>
          {slides[activeSlide]?.subtitle && <p className="text-sm text-white/80">{slides[activeSlide]!.subtitle}</p>}
          {slides[activeSlide]?.ctaLabel && slides[activeSlide]?.ctaLink && (
            <Button asChild variant="outline" className="w-fit bg-white/10 text-white hover:bg-white/20">
              <a href={slides[activeSlide]!.ctaLink}>{slides[activeSlide]!.ctaLabel}</a>
            </Button>
          )}
        </div>
      </div>
      {slides.length > 1 && (
        <div className="absolute bottom-3 right-4 flex gap-2">
          {slides.map((slide, index) => (
            <button
              type="button"
              key={slide.id}
              className={`h-2 w-6 rounded-full transition ${index === activeSlide ? 'bg-white' : 'bg-white/40'}`}
              onClick={() => setActiveSlide(index)}
              aria-label={`Slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
