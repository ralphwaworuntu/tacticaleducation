import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { DashboardOverview } from '@/types/dashboard';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/utils/format';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { getAssetUrl } from '@/lib/media';

export function DashboardHomePage() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard-overview'], queryFn: () => apiGet<DashboardOverview>('/dashboard/overview') });
  const { user } = useAuth();

  const slides = data?.slides ?? [];

  if (isLoading || !data) {
    return <Skeleton className="h-96" />;
  }

  return (
    <div className="space-y-6">
      {user?.role === 'MEMBER' && !user.membership?.isActive && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <p className="text-sm font-semibold">Membership kamu belum aktif.</p>
          <p className="text-xs text-amber-800">
            Selesaikan pembayaran dan unggah bukti agar admin dapat mengaktifkan akses tryout & materi.
          </p>
          <div className="mt-4 flex gap-3">
            <Button asChild size="sm">
              <Link to="/app/paket-membership">Lihat Paket</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/app/konfirmasi-pembayaran">Konfirmasi Pembayaran</Link>
            </Button>
          </div>
        </div>
      )}

      {slides.length > 0 && <DashboardHeroSlider key={slides.map((slide) => slide.id).join(':')} slides={slides} />}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">Tryout yang Sudah Dikerjakan</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{data.summary.tryouts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">Materi Tersedia</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{data.summary.materials}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">Pembayaran Pending</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{data.summary.pendingPayments}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-slate-500">Kode Akses Orang Tua</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{user?.memberArea?.slug ?? '-'}</p>
            <p className="mt-1 text-xs text-slate-400">Bagikan kode ini untuk akses halaman orang tua.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader title="Pengumuman" />
          <CardContent className="p-0">
            <ul
              className={`divide-y divide-slate-100 ${
                data.announcements.length > 3 ? 'max-h-[18rem] overflow-y-auto pr-1' : ''
              }`}
            >
              {data.announcements.map((item) => (
                <li key={item.id} className="space-y-3 border-b border-slate-100 px-6 py-4 last:border-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="text-xs text-slate-500">{formatDate(item.publishedAt)}</p>
                  </div>
                  {item.imageUrl && (
                    <img
                      src={getAssetUrl(item.imageUrl)}
                      alt={item.title}
                      className="h-32 w-full rounded-2xl object-cover"
                      loading="lazy"
                    />
                  )}
                  <p className="text-sm text-slate-600">{item.body}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Riwayat Tryout Terbaru" />
          <CardContent className="p-0">
            <ul
              className={`divide-y divide-slate-100 ${
                data.tryoutResults.length > 3 ? 'max-h-[18rem] overflow-y-auto pr-1' : ''
              }`}
            >
              {data.tryoutResults.map((result) => (
                <li key={result.id} className="px-6 py-4">
                  <p className="text-sm font-semibold text-slate-900">{result.tryout.name}</p>
                  <p className="text-xs text-slate-500">
                    {result.tryout.subCategory.category.name} - {formatDate(result.startedAt)}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-brand-500">{Math.round(result.score)}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader title="Transaksi Terbaru" />
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Kode</th>
                  <th className="px-4 py-3">Paket</th>
                  <th className="px-4 py-3">Metode</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Jumlah</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.transactions.map((trx) => {
                  const name = trx.type === 'ADDON' ? trx.addon?.name ?? 'Addon' : trx.package.name;
                  return (
                    <tr key={trx.id}>
                      <td className="px-4 py-3 font-semibold text-slate-900">{trx.code}</td>
                      <td className="px-4 py-3 text-slate-600">
                        <div className="flex flex-col">
                          <span>{name}</span>
                          <span className="text-xs uppercase tracking-wide text-slate-400">{trx.type === 'ADDON' ? 'Addon' : 'Membership'}</span>
                        </div>
                      </td>
                    <td className="px-4 py-3 text-slate-600">{trx.method}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{trx.status}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{formatCurrency(trx.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
    if (slides.length <= 1) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 text-white">
      <div className="relative h-80 w-full md:h-[28rem]">
        {slides.map((slide, index) => (
          <img
            key={slide.id}
            src={slide.imageUrl}
            alt={slide.title ?? 'Dashboard slide'}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${index === activeSlide ? 'opacity-100' : 'opacity-0'}`}
            loading={index === 0 ? 'eager' : 'lazy'}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 to-slate-900/20" />
        <div className="relative flex h-full flex-col justify-center gap-3 px-8">
          <p className="text-xs uppercase tracking-[0.4em] text-brand-200/80">Member Spotlight</p>
          <h2 className="text-3xl font-bold">{slides[activeSlide]?.title ?? 'Tetap konsisten'}</h2>
          {slides[activeSlide]?.subtitle && <p className="text-sm text-white/80">{slides[activeSlide]!.subtitle}</p>}
          {slides[activeSlide]?.ctaLabel && slides[activeSlide]?.ctaLink && (
            <Button asChild variant="outline" className="w-fit bg-white/10 text-white hover:bg-white/20">
              <a href={slides[activeSlide]!.ctaLink}>{slides[activeSlide]!.ctaLabel}</a>
            </Button>
          )}
        </div>
      </div>
      {slides.length > 1 && (
        <div className="absolute bottom-4 right-6 flex gap-2">
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
