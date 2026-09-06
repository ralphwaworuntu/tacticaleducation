import { prisma } from '../../config/prisma';

function resolvePublicUrl(path: string | null | undefined, baseUrl?: string) {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  if (!baseUrl) {
    return path;
  }
  return `${baseUrl}${path}`;
}

const fallbackStats = [
  { label: 'Materi Video', value: 1200 },
  { label: 'Soal Try Out', value: 4500 },
  { label: 'Jumlah Alumni', value: 724 },
  { label: 'Modul Interaktif', value: 35 },
];

const fallbackReasons = [
  'Pendampingan mentor eks penguji POLRI/TNI.',
  'Bank soal ter-update dan terstandardisasi CAT.',
  'Kurikulum adaptif sesuai kisi resmi.',
  'Simulasi tes real-time lengkap analitiknya.',
  'Grup komunitas 24/7 dan progress report mingguan.',
];

const fallbackPackages = [
  {
    name: 'Tes Masuk POLRI',
    category: 'POLRI',
    price: 1499000,
    description: 'Bimbingan intensif AKPOL & BINTARA lengkap dengan simulasi CAT.',
  },
  {
    name: 'Tes Masuk TNI',
    category: 'TNI',
    price: 1599000,
    description: 'Pendampingan AKMIL & BINTARA TNI mencakup psikotes, samapta, dan WAWANCARA.',
  },
];

const contactSettingKeys = ['company_email', 'whatsapp_primary', 'whatsapp_consult', 'company_address'] as const;

type ContactSettingKey = (typeof contactSettingKeys)[number];

function buildContactInfo(settings: Array<{ key: string; value: string }>) {
  const map = settings.reduce<Record<string, string>>((acc, setting) => {
    acc[setting.key] = setting.value;
    return acc;
  }, {});

  const whatsappPrimary = map.whatsapp_primary ?? '6281234567890';
  return {
    email: map.company_email ?? 'hallo@tacticaleducation.id',
    whatsappPrimary,
    whatsappConsult: map.whatsapp_consult ?? whatsappPrimary,
    companyAddress: map.company_address ?? 'Alamat perusahaan belum diatur',
  };
}

export async function getHomeContent(baseUrl?: string) {
  const [stats, packages, testimonials, videos, heroSetting, heroSlides, contactSettings] = await Promise.all([
    prisma.landingStat.findMany(),
    prisma.membershipPackage.findMany({ where: { isActive: true }, take: 6 }),
    prisma.testimonial.findMany({ take: 6 }),
    prisma.youtubeVideo.findMany({ take: 6 }),
    prisma.siteSetting.findUnique({ where: { key: 'hero_image' } }),
    prisma.heroSlide.findMany({ orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] }),
    prisma.siteSetting.findMany({ where: { key: { in: [...contactSettingKeys] } } }),
  ]);

  const heroPath = heroSetting?.value ?? '/Alumni.png';
  const heroUrl = resolvePublicUrl(heroPath, baseUrl) ?? '/Alumni.png';
  const slides = heroSlides.length
    ? heroSlides.map((slide) => ({ id: slide.id, imageUrl: resolvePublicUrl(slide.imageUrl, baseUrl) ?? heroUrl }))
    : [{ id: 'fallback', imageUrl: heroUrl }];
  const contact = buildContactInfo(contactSettings);

  return {
    hero: {
      title: 'Bimbel Online Terbaik untuk TNI & POLRI',
      subtitle: 'Tactical Education memadukan kurikulum adaptif, mentor elite, dan teknologi simulasi CAT modern.',
      ctaPrimary: { label: 'Gabung Sekarang', href: '/auth/register' },
      ctaSecondary: { label: 'Paket Bimbel', href: '/paket-bimbel' },
      imageUrl: heroUrl,
      slides,
    },
    stats: stats.length ? stats : fallbackStats,
    reasons: fallbackReasons,
    packages: packages.length
      ? packages.map((pkg) => ({
          id: pkg.id,
          name: pkg.name,
          category: pkg.category,
          price: pkg.price,
          description: pkg.description,
          badgeLabel: pkg.badgeLabel,
        }))
      : fallbackPackages,
    testimonials,
    videos,
    contact,
  };
}

export async function getContactInfo() {
  const settings = await prisma.siteSetting.findMany({ where: { key: { in: [...contactSettingKeys] } } });
  return buildContactInfo(settings);
}

export async function getProfilePage() {
  const profileCopy = `Tactical Education hadir sebagai pusat persiapan casis POLRI dan TNI dengan pendekatan humanis, adaptif, dan terukur.
Sejak 2018 kami membantu ribuan siswa lolos seleksi AKPOL, BINTARA, AKMIL, dan BINTARA TNI dengan kombinasi kelas live, modul digital, dan simulator CAT.`;

  return {
    title: 'Profil Kami',
    body: profileCopy,
    highlights: [
      'Fokus pada pembelajaran terarah berbasis data hasil tryout.',
      'Kurikulum disusun oleh mentor aktif dengan pengalaman lebih dari 10 tahun.',
      'Satu dashboard untuk tryout, latihan soal, materi, tes kecermatan, dan transaksi.',
    ],
  };
}

export async function getBimbelPackages() {
  const packages = await prisma.membershipPackage.findMany({ where: { isActive: true } });
  return packages;
}

export async function getGalleryContent() {
  const [alumni, activities] = await Promise.all([
    prisma.galleryItem.findMany({ where: { kind: 'ALUMNI' }, take: 12 }),
    prisma.galleryItem.findMany({ where: { kind: 'AKTIVITAS' }, take: 12 }),
  ]);
  return { alumni, activities };
}

export async function getTestimonials() {
  const testimonials = await prisma.testimonial.findMany({ take: 12 });
  return testimonials;
}
