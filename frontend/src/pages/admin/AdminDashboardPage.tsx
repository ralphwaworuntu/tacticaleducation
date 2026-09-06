import { useQuery } from '@tanstack/react-query';
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

const overviewCards: Array<{ key: OverviewMetricKey; label: string; format?: 'currency' }> = [
  { key: 'users', label: 'Total Pengguna' },
  { key: 'tryouts', label: 'Tryout Aktif' },
  { key: 'practiceSets', label: 'Latihan & Tugas' },
  { key: 'materials', label: 'Materi Belajar' },
  { key: 'transactions', label: 'Transaksi' },
  { key: 'transactionAmount', label: 'Nilai Transaksi (PAID)', format: 'currency' },
];

export function AdminDashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ['admin-overview'], queryFn: () => apiGet<AdminOverview>('/admin/overview') });

  if (isLoading || !data) {
    return <Skeleton className="h-64" />;
  }

  const chartMax = data.chartSeries.length ? Math.max(...data.chartSeries.map((item) => item.value), 1) : 1;

  return (
    <section className="page-shell">
      <PageHeader variant="panel"
        eyebrow="Admin"
        title="Ringkasan Sistem"
        description="Monitor metrik penting Tactical Education secara real-time."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {overviewCards.map((card) => {
          const value = Number(data[card.key]);
          const formatted = card.format === 'currency'
            ? value.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
            : value.toLocaleString('id-ID');
          return (
            <div key={card.key} className="admin-metric-card">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.label}</p>
              <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{formatted}</p>
            </div>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-6">
          <p className="text-sm font-semibold text-slate-800">Statistik Sistem</p>
          <p className="mt-1 text-xs text-slate-500">Perbandingan volume data antar modul utama.</p>
          <div className="mt-5 space-y-4">
            {data.chartSeries.map((series) => {
              const width = Math.max((series.value / chartMax) * 100, 5);
              return (
                <div key={series.label}>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{series.label}</span>
                    <span className="font-semibold text-slate-900">{series.value.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
