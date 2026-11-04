import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, ClipboardList, FolderOpen, Package, Radio, Receipt, ShieldCheck, Users } from 'lucide-react';
import { apiGet } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/common/PageHeader';

type AdminOverview = {
  users: number;
  tryouts: number;
  practiceSets: number;
  materials: number;
  transactions: number;
  transactionAmount: number;
  chartSeries: Array<{ label: string; value: number }>;
};

type OverviewMetricKey = Exclude<keyof AdminOverview, 'chartSeries'>;

const overviewCards: Array<{
  key: OverviewMetricKey;
  label: string;
  hint: string;
  icon: typeof Users;
  tone: 'blue' | 'purple' | 'teal' | 'amber';
  format?: 'currency';
}> = [
  { key: 'users', label: 'Total Pengguna', hint: 'Akun terdaftar', icon: Users, tone: 'blue' },
  { key: 'tryouts', label: 'Tryout Aktif', hint: 'Paket tryout', icon: ClipboardList, tone: 'purple' },
  { key: 'practiceSets', label: 'Latihan & Tugas', hint: 'Set soal latihan', icon: BookOpen, tone: 'purple' },
  { key: 'materials', label: 'Materi Belajar', hint: 'Modul tersedia', icon: FolderOpen, tone: 'teal' },
  { key: 'transactions', label: 'Total Transaksi', hint: 'Semua status', icon: Receipt, tone: 'amber' },
  { key: 'transactionAmount', label: 'Nilai Transaksi Paid', hint: 'Jumlah terbayar', icon: Package, tone: 'amber', format: 'currency' },
];

const seriesTone: Record<string, 'blue' | 'purple' | 'teal' | 'amber'> = {
  'Total Pengguna': 'blue',
  'Tryout Aktif': 'purple',
  'Latihan & Tugas': 'purple',
  'Materi Belajar': 'teal',
  Transaksi: 'amber',
};

const quickActions = [
  { to: '/admin/exam-control', label: 'Kontrol Ujian', icon: ShieldCheck, tone: 'navy' as const },
  { to: '/admin/live-quiz', label: 'Live Quiz', icon: Radio, tone: 'blue' as const },
  { to: '/admin/users', label: 'Manajemen User', icon: Users, tone: 'blue' as const },
  { to: '/admin/commerce', label: 'Paket & Transaksi', icon: Package, tone: 'amber' as const },
];

export function AdminDashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ['admin-overview'], queryFn: () => apiGet<AdminOverview>('/admin/overview') });

  if (isLoading || !data) {
    return <Skeleton className="h-64" />;
  }

  return (
    <section className="page-shell">
      <PageHeader
        variant="panel"
        eyebrow="Admin"
        title="Ringkasan Sistem"
        description="Monitor metrik penting Tactical Edukasi. Angka di bawah adalah data aktual, tanpa tren buatan."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {overviewCards.map((card) => {
          const value = Number(data[card.key]);
          const formatted =
            card.format === 'currency'
              ? value.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
              : value.toLocaleString('id-ID');
          const Icon = card.icon;
          return (
            <div key={card.key} className="admin-metric-card" data-tone={card.tone}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
                <span className={`te-icon-sm te-icon-${card.tone}`}>
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
              </div>
              <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{formatted}</p>
              <p className="mt-1 text-xs text-slate-500">{card.hint}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardContent className="p-6">
            <p className="text-lg font-semibold text-slate-900">Volume modul</p>
            <p className="mt-1 text-sm text-slate-500">
              Setiap metrik memakai skala sendiri. Grafik tidak membandingkan satuan yang berbeda.
            </p>
            <ul className="mt-5 divide-y divide-slate-100">
              {data.chartSeries.map((series) => (
                <li key={series.label} className="flex items-center justify-between py-3">
                  <span className="flex items-center gap-2 text-sm text-slate-600">
                    <span className={`te-dot te-dot-${seriesTone[series.label] ?? 'navy'}`} aria-hidden />
                    {series.label}
                  </span>
                  <span className="text-lg font-bold tabular-nums text-slate-900">{series.value.toLocaleString('id-ID')}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-lg font-semibold text-slate-900">Aksi cepat</p>
            <p className="mt-1 text-sm text-slate-500">Pintasan ke halaman yang sering dipakai.</p>
            <div className="mt-4 grid gap-2">
              {quickActions.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-800 transition-colors duration-150 hover:border-slate-300 hover:bg-slate-50"
                  >
                    <span className={`te-icon-sm te-icon-${item.tone}`}>
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
