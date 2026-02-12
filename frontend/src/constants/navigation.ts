type NavItem = {
  label: string;
  to: string;
  exact?: boolean;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

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
    title: 'Dashboard',
    items: [{ label: 'Ringkasan', to: '/app', exact: true }],
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
    title: 'Latihan',
    items: [
      { label: 'Tryout', to: '/app/latihan/tryout' },
      { label: 'Latihan Soal', to: '/app/latihan-soal' },
      { label: 'Tes Kecermatan', to: '/app/tes-kecermatan' },
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
    title: 'Materi',
    items: [{ label: 'Modul & Materi', to: '/app/materi' }],
  },
  {
    title: 'Beli Paket',
    items: [
      { label: 'Paket Membership', to: '/app/paket-membership' },
      { label: 'Konfirmasi Pembayaran', to: '/app/konfirmasi-pembayaran' },
      { label: 'Riwayat Transaksi', to: '/app/riwayat-transaksi' },
    ],
  },
  {
    title: 'Member Get Member',
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
    title: 'Konten Akademik',
    items: [
      { label: 'Tryouts & Tes', to: '/admin/tryouts' },
      { label: 'Latihan & Tugas', to: '/admin/practice' },
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
