type NavItem = {
  label: string;
  to: string;
  exact?: boolean;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

export type { NavItem, NavSection };

export const publicNavLinks = [
  { label: 'Home', href: '/' },
  { label: 'Profil', href: '/profil' },
  { label: 'Paket Bimbel', href: '/paket-bimbel' },
  { label: 'Orang Tua', href: '/orang-tua' },
  { label: 'Galeri', href: '/galeri' },
  { label: 'Testimoni', href: '/testimoni' },
  { label: 'Hubungi Kami', href: '/hubungi-kami' },
];

export const dashboardMenu: NavSection[] = [
  {
    title: 'Beranda',
    items: [{ label: 'Ringkasan', to: '/app', exact: true }],
  },
  {
    title: 'Pembelajaran',
    items: [
      { label: 'Tryout', to: '/app/latihan/tryout' },
      { label: 'Latihan Soal', to: '/app/latihan-soal' },
      { label: 'Tes Kecermatan', to: '/app/tes-kecermatan' },
      { label: 'Modul & Materi', to: '/app/materi' },
    ],
  },
  {
    title: 'Riwayat',
    items: [
      { label: 'Riwayat Tryout', to: '/app/latihan/tryout/riwayat' },
      { label: 'Riwayat Latihan', to: '/app/latihan-soal/riwayat' },
      { label: 'Riwayat Kecermatan', to: '/app/tes-kecermatan/riwayat' },
    ],
  },
  {
    title: 'Membership',
    items: [
      { label: 'Paket Membership', to: '/app/paket-membership' },
      { label: 'Konfirmasi Pembayaran', to: '/app/konfirmasi-pembayaran' },
      { label: 'Riwayat Transaksi', to: '/app/riwayat-transaksi' },
    ],
  },
  {
    title: 'Informasi',
    items: [
      { label: 'Pengumuman', to: '/app/pengumuman' },
      { label: 'FAQ', to: '/app/faq' },
      { label: 'Berita', to: '/app/berita' },
      { label: 'Kalkulator', to: '/app/kalkulator' },
    ],
  },
  {
    title: 'Lainnya',
    items: [{ label: 'Afiliasi', to: '/app/afiliasi' }],
  },
];

export const adminMenu: NavSection[] = [
  {
    title: 'Umum',
    items: [
      { label: 'Overview', to: '/admin', exact: true },
      { label: 'Landing Content', to: '/admin/landing' },
      { label: 'Pengumuman', to: '/admin/announcements' },
      { label: 'Reporting', to: '/admin/reporting' },
      { label: 'Ranking', to: '/admin/ranking' },
      { label: 'Pesan Kontak', to: '/admin/contacts' },
    ],
  },
  {
    title: 'Kontrol Ujian',
    items: [{ label: 'Kontrol Ujian', to: '/admin/exam-control' }],
  },
  {
    title: 'LIVE QUIZ',
    items: [
      { label: 'Dashboard Live Quiz', to: '/admin/live-quiz', exact: true },
      { label: 'Kuis Saya', to: '/admin/live-quiz/kuis' },
      { label: 'Riwayat & Laporan', to: '/admin/live-quiz/riwayat' },
      { label: 'Pengaturan Live Quiz', to: '/admin/live-quiz/pengaturan' },
    ],
  },
  {
    title: 'Konten Akademik',
    items: [
      { label: 'Konversi Word → CSV', to: '/admin/word-converter' },
      { label: 'Tryouts & Tes', to: '/admin/tryouts' },
      { label: 'Latihan & Tugas', to: '/admin/practice' },
      { label: 'Kecermatan', to: '/admin/kecermatan' },
      { label: 'Materi Belajar', to: '/admin/materials' },
      { label: 'Kalkulator', to: '/admin/calculators' },
    ],
  },
  {
    title: 'Bisnis',
    items: [
      { label: 'Paket & Transaksi', to: '/admin/commerce' },
      { label: 'Aktivasi Membership', to: '/admin/activation' },
      { label: 'Monitoring Member', to: '/admin/monitoring' },
      { label: 'Manajemen User', to: '/admin/users' },
    ],
  },
];

const EXTRA_TITLES: Array<{ prefix: string; exact?: boolean; label: string }> = [
  { prefix: '/app/ujian/tryout', label: 'Ujian Tryout' },
  { prefix: '/app/ujian/soal', label: 'Ujian Soal' },
  { prefix: '/admin/live-quiz/host', label: 'Layar Tutor' },
  { prefix: '/admin/live-quiz/laporan', label: 'Laporan Live Quiz' },
  { prefix: '/admin/members', label: 'Progress Member' },
];

export function findNavLabel(pathname: string, menus: NavSection[]): string | null {
  let best: string | null = null;
  let bestLen = -1;
  for (const section of menus) {
    for (const item of section.items) {
      const isMatch = item.exact
        ? pathname === item.to
        : pathname === item.to || pathname.startsWith(`${item.to}/`);
      if (isMatch && item.to.length > bestLen) {
        best = item.label;
        bestLen = item.to.length;
      }
    }
  }
  for (const extra of EXTRA_TITLES) {
    const isMatch = extra.exact ? pathname === extra.prefix : pathname === extra.prefix || pathname.startsWith(`${extra.prefix}/`);
    if (isMatch && extra.prefix.length > bestLen) {
      best = extra.label;
      bestLen = extra.prefix.length;
    }
  }
  return best;
}

export function sectionContainsPath(section: NavSection, pathname: string): boolean {
  return section.items.some((item) =>
    item.exact ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`),
  );
}
