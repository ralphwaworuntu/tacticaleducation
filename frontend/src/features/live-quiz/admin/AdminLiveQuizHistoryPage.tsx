import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { liveQuizApi } from '../api';
import { formatDateTime, isActivePhase, phaseLabel } from '../format';

const FILTERS = [
  { value: '', label: 'Semua' },
  { value: 'ACTIVE', label: 'Berjalan' },
  { value: 'FINISHED', label: 'Selesai' },
  { value: 'CANCELLED', label: 'Dibatalkan' },
];

export function AdminLiveQuizHistoryPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['live-quiz', 'sessions', status, page],
    queryFn: () => liveQuizApi.listSessions({ ...(status ? { status } : {}), page, pageSize: 15 }),
  });
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="page-shell">
      <PageHeader
        variant="panel"
        eyebrow="Live Quiz"
        title="Riwayat sesi"
        description="Semua sesi live beserta laporan hasil, peringkat, dan ekspor CSV."
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Button
            key={filter.value}
            size="sm"
            variant={status === filter.value ? 'primary' : 'outline'}
            onClick={() => {
              setStatus(filter.value);
              setPage(1);
            }}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-6">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : data?.items.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Kuis</th>
                    <th>Status</th>
                    <th>Peserta</th>
                    <th>Tutor</th>
                    <th>Dibuat</th>
                    <th className="text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((session) => (
                    <tr key={session.id}>
                      <td className="font-semibold text-slate-900">{session.title}</td>
                      <td>
                        <Badge variant={session.status === 'FINISHED' ? 'success' : 'outline'}>
                          {phaseLabel(session.status)}
                        </Badge>
                      </td>
                      <td>{session.playerCount}</td>
                      <td>{session.hostName}</td>
                      <td className="whitespace-nowrap">{formatDateTime(session.createdAt)}</td>
                      <td className="text-right">
                        {isActivePhase(session.status) ? (
                          <Button asChild size="sm">
                            <Link to={`/admin/live-quiz/host/${session.id}`}>Buka</Link>
                          </Button>
                        ) : (
                          <Button asChild size="sm" variant="outline">
                            <Link to={`/admin/live-quiz/laporan/${session.id}`}>Laporan</Link>
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-slate-500">Belum ada sesi.</p>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Sebelumnya
          </Button>
          <span className="text-sm text-slate-600">
            Halaman {page} dari {totalPages}
          </span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Berikutnya
          </Button>
        </div>
      )}
    </div>
  );
}
