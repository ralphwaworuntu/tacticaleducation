import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/common/PageHeader';

type SystemMetrics = {
  memory: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  cpu: {
    core: number;
    model: string;
    speed: number;
    usage: number;
  }[];
  uptime: number;
};

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatUptime(seconds: number) {
  const days = Math.floor(seconds / (24 * 60 * 60));
  seconds -= days * 24 * 60 * 60;
  const hours = Math.floor(seconds / (60 * 60));
  seconds -= hours * 60 * 60;
  const minutes = Math.floor(seconds / 60);
  seconds -= minutes * 60;
  return `${days}d ${hours}h ${minutes}m ${Math.round(seconds)}s`;
}

export function AdminMonitoringPage() {
  const { data, isLoading } = useQuery<SystemMetrics | null>({
    queryKey: ['admin-system-metrics'],
    queryFn: async () => {
      const result = await apiGet<SystemMetrics>('/admin/monitoring/system-metrics').catch(() => null);
      return result ?? null;
    },
    refetchInterval: 5000,
    retry: false,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
  });

  return (
    <section className="page-shell">
      <PageHeader variant="panel"
        eyebrow="Admin"
        title="System Monitoring"
        description="Monitor the health of the backend system."
      />

      {isLoading && <Skeleton className="h-64" />}

      {!isLoading && !data && (
        <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4 text-brand-800">
          <p className="text-sm font-semibold">Gagal memuat data monitoring.</p>
          <p className="text-xs">Pastikan Anda login sebagai admin dan backend berjalan.</p>
        </div>
      )}

      {data && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-widest text-slate-500">Memory</p>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Total</span>
                  <strong>{formatBytes(data.memory.total)}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Used</span>
                  <strong>{formatBytes(data.memory.used)} ({data.memory.usage.toFixed(2)}%)</strong>
                </div>
                <div className="flex justify-between">
                  <span>Free</span>
                  <strong>{formatBytes(data.memory.free)}</strong>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-brand-500 transition-all"
                    style={{ width: `${Math.min(Math.max(data.memory.usage, 0), 100)}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-widest text-slate-500">Uptime</p>
              <p className="mt-4 text-2xl font-bold">{formatUptime(data.uptime)}</p>
            </CardContent>
          </Card>

          <Card className="md:col-span-2 lg:col-span-1">
            <CardContent className="p-6">
              <p className="text-xs uppercase tracking-widest text-slate-500">CPU Usage</p>
              <div className="mt-4 space-y-3 text-sm">
                {data.cpu.map((cpu) => (
                  <div key={cpu.core} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>Core {cpu.core}</span>
                      <strong>{cpu.usage.toFixed(2)}%</strong>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-slate-500 transition-all"
                        style={{ width: `${Math.min(Math.max(cpu.usage, 0), 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
}
