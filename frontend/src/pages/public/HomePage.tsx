import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { API_BASE_ORIGIN, apiGet } from '@/lib/api';
import type { HomeContent } from '@/types/content';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { SectionHeader } from '@/components/common/PageHeader';
import { formatCurrency } from '@/utils/format';

export function HomePage() {
  const { data, isLoading } = useQuery({ queryKey: ['home-content'], queryFn: () => apiGet<HomeContent>('/landing/home') });

  const heroImage = data?.hero.imageUrl
    ? data.hero.imageUrl.startsWith('http')
      ? data.hero.imageUrl
      : `${API_BASE_ORIGIN}${data.hero.imageUrl}`
    : '/Alumni.png';

  const heroSlides = useMemo(() => {
    if (!data?.hero.slides || data.hero.slides.length === 0) {
      return [{ id: 'fallback', imageUrl: heroImage }];
    }
    return data.hero.slides;
  }, [data?.hero.slides, heroImage]);
  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64 w-full" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={idx} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-16">
      <section className="grid items-center gap-10 md:grid-cols-2">
        <div>
          <p className="eyebrow-label">No.1 NTT Bimbel Taktis</p>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl">{data.hero.title}</h1>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">{data.hero.subtitle}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link to={data.hero.ctaPrimary.href}>{data.hero.ctaPrimary.label}</Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link to={data.hero.ctaSecondary.href}>{data.hero.ctaSecondary.label}</Link>
            </Button>
          </div>
          <div className="mt-6 flex flex-wrap gap-4">
            {data.stats.map((stat) => (
              <div key={stat.label} className="surface-card px-5 py-4">
                <p className="text-2xl font-bold text-slate-900">{stat.value.toLocaleString('id-ID')}</p>
                <p className="text-sm text-slate-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
        <HeroImageSlider key={heroSlides.map((slide) => slide.id).join(':')} slides={heroSlides} />
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <SectionHeader eyebrow="Kenapa Harus Bimbel?" title="Problem casis yang paling sering ditemui" />
            <ul className="mt-4 space-y-3 text-slate-600">
              {['Informasi pendaftaran yang berubah-ubah', 'Kuota terbatas & persaingan ketat', 'Kurang latihan soal & evaluasi berkala', 'Belum terbiasa dengan sistem CAT modern'].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-brand-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <SectionHeader eyebrow="Kenapa Tactical?" title="Solusi terintegrasi dalam satu dashboard" />
            <ul className="mt-4 space-y-3 text-slate-600">
              {data.reasons.map((reason) => (
                <li key={reason} className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      <section>
        <SectionHeader
          eyebrow="Paket Bimbel"
          title="Pilih jalur sesuai fokus tes kamu"
          action={
            <Button variant="ghost" asChild className="hidden md:inline-flex">
              <Link to="/paket-bimbel">Lihat semua paket</Link>
            </Button>
          }
        />
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {data.packages.map((pkg) => (
            <Card key={pkg.name} className="relative overflow-hidden">
              <CardContent className="space-y-4 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">{pkg.category}</p>
                    <h3 className="text-xl font-semibold text-slate-900">{pkg.name}</h3>
                  </div>
                  {pkg.badgeLabel && <Badge>{pkg.badgeLabel}</Badge>}
                </div>
                <p className="text-sm text-slate-600">{pkg.description}</p>
                <p className="text-3xl font-bold text-slate-900">{formatCurrency(pkg.price)}</p>
                <div className="flex gap-3">
                  <Button asChild className="flex-1">
                    <Link to="/auth/register">Daftar Disini</Link>
                  </Button>
                  <Button variant="outline" asChild className="flex-1">
                    <Link to="/paket-bimbel">Click Here</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-10 md:grid-cols-2">
        <div>
          <SectionHeader
            eyebrow="Kelas Bimbel Itu Apa Sih?"
            title="Satu tempat untuk teori, simulasi, dan mentoring"
            titleClassName="text-2xl sm:text-3xl"
          />
          <p className="mt-4 text-slate-600">
            Tactical Education lahir dari kebutuhan casis yang ingin belajar secara fokus, personal, dan terukur. Kami menyatukan
            materi video, modul interaktif, tryout CAT, hingga pendampingan mentor dalam satu PWA.
          </p>
          <p className="mt-3 text-slate-600">
            Sistem adaptif kami membaca progresmu dan menyiapkan rekomendasi latihan berikutnya sehingga setiap menit belajar
            tetap efektif.
          </p>
        </div>
        <Card className="bg-slate-900 text-white">
          <CardContent className="space-y-4 p-6">
            <h3 className="text-2xl font-semibold">Keunggulan Platform</h3>
            <ul className="space-y-3 text-slate-200">
              {['Dashboard tryout & pembahasan otomatis', 'Tracking skor dan rekomendasi belajar', 'Akses materi lintas perangkat (PWA)', 'Komunitas dan afiliasi member get member'].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-brand-300" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      <section>
        <SectionHeader eyebrow="Testimoni" title="Cerita dari para alumni" />
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {data.testimonials.map((item) => (
            <Card key={item.id}>
              <CardContent className="space-y-3 p-6">
                <p className="text-sm text-slate-600">“{item.message}”</p>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                  {item.role && <p className="text-xs text-slate-500">{item.role}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <SectionHeader eyebrow="Video Pembelajaran" title="Simak highlight kelas kami" />
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {data.videos.map((video) => (
            <div key={video.id} className="surface-card overflow-hidden">
              <div className="aspect-video">
                <iframe title={video.title} src={video.embedUrl} className="h-full w-full" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
              </div>
              <div className="p-4">
                <p className="text-sm font-semibold text-slate-900">{video.title}</p>
                {video.description && <p className="text-xs text-slate-500">{video.description}</p>}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

type HeroSlideItem = { id: string; imageUrl: string };

function HeroImageSlider({ slides }: { slides: HeroSlideItem[] }) {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  return (
    <div className="relative">
      <div className="relative aspect-square w-full overflow-hidden rounded-[48px] border border-slate-100 shadow-[0_25px_60px_rgba(15,23,42,0.35)]">
        {slides.map((slide, index) => (
          <img
            key={slide.id}
            src={slide.imageUrl}
            alt="Hero slide"
            loading={index === 0 ? 'eager' : 'lazy'}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${index === activeSlide ? 'opacity-100' : 'opacity-0'}`}
          />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-4 rounded-[40px] border border-white/40 shadow-[inset_0_40px_80px_rgba(255,255,255,0.35)]" />
      <div className="pointer-events-none absolute -inset-3 -z-10 rounded-[52px] bg-gradient-to-br from-white via-brand-50/60 to-brand-100 blur-3xl" />
      {slides.length > 1 && (
        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2">
          {slides.map((slide, index) => (
            <button
              type="button"
              key={slide.id}
              onClick={() => setActiveSlide(index)}
              className={`h-2 w-6 rounded-full transition ${index === activeSlide ? 'bg-brand-500' : 'bg-white/60'}`}
              aria-label={`Slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
