import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { getAssetUrl } from '@/lib/media';
import type { PackageOption } from '@/types/landing';
import type { LandingItem, LandingResourceConfig } from '@/components/admin/LandingSectionManager';
import { LandingSectionManager } from '@/components/admin/LandingSectionManager';
import { PageHeader } from '@/components/common/PageHeader';

type LandingStat = { id: string; label: string; value: number };
type LandingTestimonial = { id: string; name: string; message: string; role?: string; avatarUrl?: string; videoUrl?: string };
type LandingGallery = { id: string; title: string; imageUrl: string; kind: string };
type LandingVideo = { id: string; title: string; embedUrl: string; thumbnail?: string; description?: string };
type LandingAnnouncement = {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
  imageUrl?: string | null;
  targetAll?: boolean;
  targetPackageIds?: string[];
};
type LandingFaq = { id: string; question: string; answer: string; order: number };
type LandingNews = { id: string; title: string; slug: string; excerpt: string; content: string; coverUrl?: string; kind: 'NEWS' | 'INSIGHT' };
type MemberAreaBackground = { enabled: boolean; imageUrl?: string | null };

type HeroSlide = { id: string; imageUrl: string; order: number };
type MemberOverviewSlide = {
  id: string;
  title?: string | null;
  subtitle?: string | null;
  imageUrl: string;
  ctaLabel?: string | null;
  ctaLink?: string | null;
  order: number;
};
type ContactConfig = { email: string; whatsappPrimary: string; whatsappConsult: string; companyAddress: string };
type WelcomeModalConfig = { id: string; enabled: boolean; imageUrl: string; linkUrl?: string | null; createdAt?: string };

type LandingOverview = {
  stats: LandingStat[];
  testimonials: LandingTestimonial[];
  gallery: LandingGallery[];
  videos: LandingVideo[];
  announcements: LandingAnnouncement[];
  faqs: LandingFaq[];
  news: LandingNews[];
};

const landingSections: LandingResourceConfig[] = [
  {
    key: 'stats',
    title: 'Highlight Angka',
    endpoint: 'stats',
    primaryField: 'label',
    secondaryField: 'value',
    fields: [
      { name: 'label', label: 'Label', placeholder: 'Materi Video' },
      { name: 'value', label: 'Nilai', type: 'number', defaultValue: 0 },
    ],
  },
  {
    key: 'testimonials',
    title: 'Testimoni',
    endpoint: 'testimonials',
    primaryField: 'name',
    secondaryField: 'role',
    fields: [
      { name: 'name', label: 'Nama' },
      { name: 'role', label: 'Role / Lolos' },
      { name: 'message', label: 'Pesan', type: 'textarea' },
      { name: 'avatarUrl', label: 'Avatar URL', type: 'url' },
      { name: 'videoUrl', label: 'Video URL', type: 'url' },
    ],
  },
  {
    key: 'gallery',
    title: 'Galeri',
    endpoint: 'gallery',
    primaryField: 'title',
    secondaryField: 'kind',
    fields: [
      { name: 'title', label: 'Judul' },
      { name: 'imageUrl', label: 'Gambar', type: 'url' },
      { name: 'kind', label: 'Kategori (ALUMNI/AKTIVITAS)', placeholder: 'ALUMNI' },
    ],
  },
  {
    key: 'videos',
    title: 'Video YouTube',
    endpoint: 'videos',
    primaryField: 'title',
    fields: [
      { name: 'title', label: 'Judul' },
      { name: 'embedUrl', label: 'Embed URL', type: 'url' },
      { name: 'thumbnail', label: 'Thumbnail', type: 'url' },
      { name: 'description', label: 'Deskripsi', type: 'textarea' },
    ],
  },
  {
    key: 'faqs',
    title: 'FAQ',
    endpoint: 'faq',
    primaryField: 'question',
    fields: [
      { name: 'question', label: 'Pertanyaan' },
      { name: 'answer', label: 'Jawaban', type: 'textarea' },
      { name: 'order', label: 'Urutan', type: 'number', defaultValue: 0 },
    ],
  },
  {
    key: 'news',
    title: 'Artikel / Berita',
    endpoint: 'news',
    primaryField: 'title',
    secondaryField: 'slug',
    fields: [
      { name: 'title', label: 'Judul' },
      { name: 'slug', label: 'Slug' },
      { name: 'excerpt', label: 'Ringkasan', type: 'textarea' },
      { name: 'content', label: 'Konten', type: 'textarea' },
      { name: 'kind', label: 'Tipe (NEWS/INSIGHT)', placeholder: 'NEWS', defaultValue: 'NEWS' },
    ],
    uploadField: {
      name: 'coverImage',
      label: 'Cover Artikel (Opsional)',
      previewKey: 'coverUrl',
      helper: 'JPG/PNG/WEBP maksimal 4MB. Kosongkan jika tanpa cover.',
      accept: 'image/*',
    },
  },
];

export function AdminLandingPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-landing'], queryFn: () => apiGet<LandingOverview>('/admin/landing') });
  const { data: heroSlides } = useQuery({ queryKey: ['admin-hero-slides'], queryFn: () => apiGet<HeroSlide[]>('/admin/site/hero-slides') });
  const { data: packages } = useQuery({ queryKey: ['admin-packages'], queryFn: () => apiGet<PackageOption[]>('/admin/packages') });
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [heroFileKey, setHeroFileKey] = useState(0);
  const heroSlideUpload = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('slide', file);
      return apiPost('/admin/site/hero-slides', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => {
      toast.success('Slide hero ditambahkan');
      setHeroFile(null);
      setHeroFileKey((prev) => prev + 1);
      queryClient.invalidateQueries({ queryKey: ['admin-hero-slides'] });
    },
    onError: () => toast.error('Gagal mengunggah slide hero'),
  });
  const deleteHeroSlide = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/site/hero-slides/${id}`),
    onSuccess: () => {
      toast.success('Slide hero dihapus');
      queryClient.invalidateQueries({ queryKey: ['admin-hero-slides'] });
    },
    onError: () => toast.error('Gagal menghapus slide'),
  });

  const memberSlideForm = useForm<{ title: string; subtitle: string; imageUrl: string; ctaLabel: string; ctaLink: string; order?: number }>({
    defaultValues: {
      title: '',
      subtitle: '',
      imageUrl: '',
      ctaLabel: '',
      ctaLink: '',
      order: undefined,
    },
  });
  const { data: memberSlides } = useQuery({ queryKey: ['admin-member-slides'], queryFn: () => apiGet<MemberOverviewSlide[]>('/admin/dashboard/slides') });
  const createMemberSlide = useMutation({
    mutationFn: (values: { title: string; subtitle: string; imageUrl: string; ctaLabel: string; ctaLink: string; order?: number }) =>
      apiPost('/admin/dashboard/slides', {
        ...values,
        order: Number.isFinite(values.order) ? Number(values.order) : undefined,
      }),
    onSuccess: () => {
      toast.success('Slide member ditambahkan');
      memberSlideForm.reset();
      queryClient.invalidateQueries({ queryKey: ['admin-member-slides'] });
    },
    onError: () => toast.error('Gagal menyimpan slide member'),
  });
  const deleteMemberSlide = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/dashboard/slides/${id}`),
    onSuccess: () => {
      toast.success('Slide member dihapus');
      queryClient.invalidateQueries({ queryKey: ['admin-member-slides'] });
    },
    onError: () => toast.error('Gagal menghapus slide member'),
  });

  const contactForm = useForm<ContactConfig>({
    defaultValues: { email: '', whatsappPrimary: '', whatsappConsult: '', companyAddress: '' },
  });
  const { data: contactConfig } = useQuery({ queryKey: ['admin-contact-config'], queryFn: () => apiGet<ContactConfig>('/admin/site/contact-config') });
  useEffect(() => {
    if (contactConfig) {
      contactForm.reset(contactConfig);
    }
  }, [contactConfig, contactForm]);
  const saveContact = useMutation({
    mutationFn: (values: ContactConfig) => apiPut('/admin/site/contact-config', values),
    onSuccess: () => {
      toast.success('Informasi kontak diperbarui');
      queryClient.invalidateQueries({ queryKey: ['admin-contact-config'] });
    },
    onError: () => toast.error('Gagal memperbarui informasi kontak'),
  });
  const onSubmitContact = contactForm.handleSubmit((values) => saveContact.mutate(values));
  const onSubmitMemberSlide = memberSlideForm.handleSubmit((values) => createMemberSlide.mutate(values));

  const [memberBackgroundFile, setMemberBackgroundFile] = useState<File | null>(null);
  const [memberBackgroundEnabled, setMemberBackgroundEnabled] = useState(true);
  const { data: memberBackground } = useQuery({
    queryKey: ['admin-member-background'],
    queryFn: () => apiGet<MemberAreaBackground>('/admin/site/member-background'),
  });
  useEffect(() => {
    if (memberBackground) {
      setMemberBackgroundEnabled(memberBackground.enabled);
    }
  }, [memberBackground]);
  const saveMemberBackground = useMutation({
    mutationFn: (payload: FormData) => apiPut('/admin/site/member-background', payload),
    onSuccess: () => {
      toast.success('Background member area diperbarui');
      queryClient.invalidateQueries({ queryKey: ['admin-member-background'] });
      setMemberBackgroundFile(null);
    },
    onError: () => toast.error('Gagal memperbarui background member area'),
  });
  const onSubmitMemberBackground = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData();
    formData.append('enabled', String(memberBackgroundEnabled));
    if (memberBackgroundFile) {
      formData.append('image', memberBackgroundFile);
    }
    saveMemberBackground.mutate(formData);
  };

  const welcomeForm = useForm<{ enabled: boolean; linkUrl: string }>({
    defaultValues: { enabled: true, linkUrl: '' },
  });
  const [welcomeFile, setWelcomeFile] = useState<File | null>(null);
  const [editingWelcomeId, setEditingWelcomeId] = useState<string | null>(null);
  const { data: welcomeList } = useQuery({
    queryKey: ['admin-welcome-modal'],
    queryFn: () => apiGet<WelcomeModalConfig[]>('/admin/site/welcome-modal'),
  });
  useEffect(() => {
    if (editingWelcomeId && welcomeList) {
      const current = welcomeList.find((item) => item.id === editingWelcomeId);
      if (current) {
        welcomeForm.reset({ enabled: Boolean(current.enabled), linkUrl: current.linkUrl ?? '' });
      }
    } else {
      welcomeForm.reset({ enabled: true, linkUrl: '' });
    }
  }, [editingWelcomeId, welcomeList, welcomeForm]);
  const saveWelcome = useMutation({
    mutationFn: (payload: FormData) =>
      editingWelcomeId
        ? apiPut(`/admin/site/welcome-modal/${editingWelcomeId}`, payload)
        : apiPost('/admin/site/welcome-modal', payload),
    onSuccess: () => {
      toast.success(editingWelcomeId ? 'Welcome modal diperbarui' : 'Welcome modal ditambahkan');
      queryClient.invalidateQueries({ queryKey: ['admin-welcome-modal'] });
      setWelcomeFile(null);
      setEditingWelcomeId(null);
    },
    onError: () => toast.error('Gagal memperbarui welcome modal'),
  });
  const deleteWelcome = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/site/welcome-modal/${id}`),
    onSuccess: () => {
      toast.success('Welcome modal dihapus');
      queryClient.invalidateQueries({ queryKey: ['admin-welcome-modal'] });
      setWelcomeFile(null);
      setEditingWelcomeId(null);
    },
    onError: () => toast.error('Gagal menghapus welcome modal'),
  });
  const onSubmitWelcome = welcomeForm.handleSubmit((values) => {
    const formData = new FormData();
    formData.append('enabled', String(values.enabled));
    if (values.linkUrl) {
      formData.append('linkUrl', values.linkUrl);
    }
    if (welcomeFile) {
      formData.append('image', welcomeFile);
    } else if (!editingWelcomeId) {
      toast.error('Unggah gambar untuk welcome modal baru');
      return;
    }
    saveWelcome.mutate(formData);
  });

  if (isLoading || !data) {
    return <Skeleton className="h-96" />;
  }

  return (
    <section className="page-shell">
      <PageHeader
        variant="panel"
        eyebrow="Admin"
        title="Konten Landing Page"
        description="Kelola kontak, hero, galeri, FAQ, dan konten publik yang tampil di situs."
      />
      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <p className="eyebrow-label">Kontak Perusahaan</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">Email & Nomor WhatsApp</h3>
            <p className="mt-1 text-sm text-slate-500">Data ini digunakan pada landing page, footer, dan tombol konsultasi.</p>
          </div>
          <form className="grid gap-3 md:grid-cols-3" onSubmit={onSubmitContact}>
            <div>
              <label className="admin-field-label">Email Perusahaan</label>
              <Input type="email" placeholder="hallo@tacticaleducation.id" {...contactForm.register('email')} />
            </div>
            <div>
              <label className="admin-field-label">WhatsApp Utama</label>
              <Input placeholder="6281234567890" {...contactForm.register('whatsappPrimary')} />
            </div>
            <div>
              <label className="admin-field-label">WhatsApp Konsultasi</label>
              <Input placeholder="628111223344" {...contactForm.register('whatsappConsult')} />
            </div>
            <div className="md:col-span-3">
              <label className="admin-field-label">Alamat Kantor</label>
              <Textarea placeholder="Jl. Contoh No. 123, Jakarta" {...contactForm.register('companyAddress')} />
            </div>
            <div className="md:col-span-3">
              <Button type="submit" disabled={saveContact.isPending}>
                {saveContact.isPending ? 'Menyimpan...' : 'Simpan Kontak'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <p className="eyebrow-label">Background Member Area</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">Atur tampilan belakang dashboard member</h3>
            <p className="mt-1 text-sm text-slate-500">Gunakan gambar untuk memperkuat branding pada area member.</p>
          </div>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={onSubmitMemberBackground}>
            <label className="admin-check-row md:col-span-2">
              <input
                type="checkbox"
                checked={memberBackgroundEnabled}
                onChange={(event) => setMemberBackgroundEnabled(event.target.checked)}
              />
              Aktifkan background member area
            </label>
            <div className="md:col-span-2 space-y-2">
              {memberBackground?.imageUrl && (
                <div className="rounded-2xl border border-slate-200 p-2">
                  <p className="text-xs font-semibold text-slate-500">Preview saat ini</p>
                  <img
                    src={getAssetUrl(memberBackground.imageUrl)}
                    alt="Background member area"
                    className="mt-2 h-40 w-full rounded-2xl object-cover"
                  />
                </div>
              )}
              <Input type="file" accept="image/*" onChange={(event) => setMemberBackgroundFile(event.target.files?.[0] ?? null)} />
              <p className="text-[11px] text-slate-500">Unggah gambar JPG/PNG/WEBP agar tampil sebagai background dashboard member.</p>
            </div>
            <div className="md:col-span-2 flex flex-wrap gap-3">
              <Button type="submit" disabled={saveMemberBackground.isPending}>
                {saveMemberBackground.isPending ? 'Menyimpan...' : 'Simpan Background'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const formData = new FormData();
                  formData.append('enabled', 'false');
                  formData.append('removeImage', 'true');
                  saveMemberBackground.mutate(formData);
                }}
                disabled={saveMemberBackground.isPending}
              >
                Hapus Background
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <p className="eyebrow-label">Welcome Modal</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">Popup promosi untuk member</h3>
            <p className="mt-1 text-sm text-slate-500">Tampilkan promo khusus saat member membuka dashboard.</p>
          </div>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={onSubmitWelcome}>
            <label className="admin-check-row">
              <input type="checkbox" {...welcomeForm.register('enabled')} />
              Aktifkan welcome modal
            </label>
            <Input placeholder="Link promo (opsional)" {...welcomeForm.register('linkUrl')} />
            <div className="md:col-span-2 space-y-2">
              {editingWelcomeId && welcomeList && (
                <div className="rounded-2xl border border-slate-200 p-2">
                  <p className="text-xs font-semibold text-slate-500">Preview saat ini</p>
                  <img
                    src={getAssetUrl(welcomeList.find((item) => item.id === editingWelcomeId)?.imageUrl)}
                    alt="Welcome modal"
                    className="mt-2 h-40 w-full rounded-2xl object-cover"
                  />
                </div>
              )}
              <Input type="file" accept="image/*" onChange={(event) => setWelcomeFile(event.target.files?.[0] ?? null)} />
              <p className="text-[11px] text-slate-500">
                {editingWelcomeId ? 'Pilih gambar baru untuk mengganti, atau biarkan kosong untuk tetap memakai gambar lama.' : 'Unggah gambar JPG/PNG/WEBP untuk promo baru.'}
              </p>
            </div>
            <div className="md:col-span-2 flex flex-wrap gap-3">
              <Button type="submit" disabled={saveWelcome.isPending}>
                {saveWelcome.isPending ? 'Menyimpan...' : editingWelcomeId ? 'Simpan Perubahan' : 'Tambah Welcome Modal'}
              </Button>
              {editingWelcomeId && (
                <Button type="button" variant="outline" disabled={deleteWelcome.isPending} onClick={() => deleteWelcome.mutate(editingWelcomeId)}>
                  {deleteWelcome.isPending ? 'Menghapus...' : 'Hapus'}
                </Button>
              )}
              {editingWelcomeId && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditingWelcomeId(null);
                    setWelcomeFile(null);
                  }}
                >
                  Batal
                </Button>
              )}
            </div>
          </form>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {welcomeList?.map((item) => (
              <div key={item.id} className="space-y-2 rounded-2xl border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">Welcome Modal</p>
                    <p className="text-[11px] text-slate-500">{item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}</p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${item.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                  >
                    {item.enabled ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
                <img src={getAssetUrl(item.imageUrl)} alt="Welcome" className="h-32 w-full rounded-xl object-cover" />
                {item.linkUrl && (
                  <a href={item.linkUrl} target="_blank" rel="noreferrer" className="text-xs text-brand-600 underline">
                    {item.linkUrl}
                  </a>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingWelcomeId(item.id);
                      setWelcomeFile(null);
                    }}
                  >
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteWelcome.mutate(item.id)} disabled={deleteWelcome.isPending}>
                    Hapus
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="eyebrow-label">Slider Hero Landing</p>
              <h3 className="text-xl font-semibold text-slate-900">Tambah visual carousel untuk home page</h3>
              <p className="text-xs text-slate-500">Unggah beberapa gambar sekaligus untuk efek slider.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Input
              key={heroFileKey}
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setHeroFile(file);
              }}
              className="max-w-sm"
            />
            <Button
              type="button"
              onClick={() => {
                if (!heroFile) {
                  toast.error('Pilih file slide terlebih dahulu');
                  return;
                }
                heroSlideUpload.mutate(heroFile);
              }}
              disabled={heroSlideUpload.isPending}
            >
              {heroSlideUpload.isPending ? 'Mengunggah...' : 'Tambah Slide'}
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {(heroSlides ?? []).map((slide) => (
              <div key={slide.id} className="rounded-2xl border border-slate-100 p-3">
                <img src={slide.imageUrl} alt="Hero slide" className="h-40 w-full rounded-xl object-cover" loading="lazy" />
                <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
                  <p>Urutan {slide.order + 1}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteHeroSlide.mutate(slide.id)}
                    disabled={deleteHeroSlide.isPending}
                  >
                    Hapus
                  </Button>
                </div>
              </div>
            ))}
            {(heroSlides ?? []).length === 0 && <p className="text-sm text-slate-500">Belum ada slide hero.</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="eyebrow-label">Slider Member Area</p>
              <h3 className="text-xl font-semibold text-slate-900">Visual besar pada halaman overview member</h3>
              <p className="text-xs text-slate-500">Tambah gambar motivasi lengkap dengan CTA internal.</p>
            </div>
          </div>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={onSubmitMemberSlide}>
            <Input placeholder="Judul" {...memberSlideForm.register('title')} />
            <Input placeholder="Subjudul" {...memberSlideForm.register('subtitle')} />
            <Input placeholder="Image URL" {...memberSlideForm.register('imageUrl')} className="md:col-span-2" />
            <Input placeholder="CTA Label" {...memberSlideForm.register('ctaLabel')} />
            <Input placeholder="CTA Link" {...memberSlideForm.register('ctaLink')} />
            <Input type="number" placeholder="Urutan" {...memberSlideForm.register('order', { valueAsNumber: true })} />
            <div className="md:col-span-2">
              <Button type="submit" disabled={createMemberSlide.isPending}>
                {createMemberSlide.isPending ? 'Menyimpan...' : 'Tambah Slide'}
              </Button>
            </div>
          </form>
          <div className="grid gap-3 md:grid-cols-2">
            {(memberSlides ?? []).map((slide) => (
              <div key={slide.id} className="rounded-2xl border border-slate-100 p-4">
                <img src={slide.imageUrl} alt={slide.title ?? 'Member slide'} className="h-40 w-full rounded-xl object-cover" loading="lazy" />
                <p className="mt-2 text-sm font-semibold text-slate-900">{slide.title ?? 'Tanpa judul'}</p>
                {slide.subtitle && <p className="text-xs text-slate-500">{slide.subtitle}</p>}
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>Urutan {slide.order + 1}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteMemberSlide.mutate(slide.id)}
                    disabled={deleteMemberSlide.isPending}
                  >
                    Hapus
                  </Button>
                </div>
              </div>
            ))}
            {(memberSlides ?? []).length === 0 && <p className="text-sm text-slate-500">Belum ada slide member.</p>}
          </div>
        </CardContent>
      </Card>

      {landingSections.map((section) => {
        const sectionItems = (data as Record<string, LandingItem[]> | undefined)?.[section.key] ?? [];
        return (
          <LandingSectionManager
            key={section.key}
            config={section}
            items={sectionItems}
            packageOptions={packages ?? []}
          />
        );
      })}
    </section>
  );
}
