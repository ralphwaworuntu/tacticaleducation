import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Layers, ListChecks, Plus, Radio, Users } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { liveQuizApi } from '../api';
import { phaseLabel } from '../format';

export function AdminLiveQuizDashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['live-quiz', 'dashboard'],
    queryFn: liveQuizApi.dashboard,
    refetchInterval: 15000,
  });

  const stats = [
    { label: 'Total kuis', value: data?.quizCount, icon: Layers },
    { label: 'Total sesi', value: data?.sessionCount, icon: Radio },
    { label: 'Sesi selesai', value: data?.finishedSessions, icon: ListChecks },
    { label: 'Total peserta', value: data?.playerCount, icon: Users },
  ];

  return (
    <div className="page-shell">
      <PageHeader
        variant="panel"
        eyebrow="Live Quiz"
        title="Tactical Live Quiz"
        description="Kuis interaktif real-time untuk kelas: tutor membuka sesi, siswa bergabung lewat PIN/QR di HP, skor dan peringkat tampil langsung."
        action={
          <>
            <Button asChild variant="outline">
              <Link to="/admin/live-quiz/riwayat">
                <BarChart3 className="h-4 w-4" />
                Riwayat & laporan
              </Link>
            </Button>
            <Button asChild>
              <Link to="/admin/live-quiz/kuis/baru">
                <Plus className="h-4 w-4" />
                Buat kuis baru
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <div key={item.label} className="admin-metric-card">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-500">{item.label}</p>
              <item.icon className="h-5 w-5 text-brand-500" aria-hidden />
            </div>
            {isLoading ? (
              <Skeleton className="mt-3 h-8 w-16" />
            ) : (
              <p className="mt-2 text-3xl font-bold text-slate-900">{item.value ?? 0}</p>
            )}
          </div>
        ))}
      </div>

      {isError && <p className="text-sm text-red-600">Gagal memuat data dashboard.</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Sesi sedang berjalan" subtitle="Buka kembali layar tutor jika browser tertutup." />
          <CardContent className="space-y-3">
            {data?.activeSessions.length ? (
              data.activeSessions.map((session) => (
                <div key={session.id} className="admin-list-item flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{session.title}</p>
                    <p className="text-xs text-slate-500">
                      PIN {session.pin ?? '-'} · {session.playerCount} peserta
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="success">{phaseLabel(session.status)}</Badge>
                    <Button asChild size="sm">
                      <Link to={`/admin/live-quiz/host/${session.id}`}>Buka</Link>
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-6 text-center text-sm text-slate-500">Tidak ada sesi aktif.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader title="Sesi terakhir selesai" />
          <CardContent className="space-y-3">
            {data?.recentSessions.length ? (
              data.recentSessions.map((session) => (
                <Link
                  key={session.id}
                  to={`/admin/live-quiz/laporan/${session.id}`}
                  className="admin-list-item flex items-center justify-between gap-3 hover:border-brand-200"
                >
                  <span className="truncate font-semibold text-slate-900">{session.title}</span>
                  <span className="shrink-0 text-xs text-slate-500">{session.playerCount} peserta</span>
                </Link>
              ))
            ) : (
              <p className="py-6 text-center text-sm text-slate-500">Belum ada sesi selesai.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
