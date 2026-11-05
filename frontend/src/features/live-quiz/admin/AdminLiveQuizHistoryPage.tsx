import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { getApiErrorMessage } from '@/lib/api';
import { liveQuizApi } from '../api';
import { formatDateTime, isActivePhase, phaseLabel } from '../format';
import type { SessionListItem } from '../types';

const FILTERS = [
  { value: '', label: 'Semua' },
  { value: 'ACTIVE', label: 'Berjalan' },
  { value: 'FINISHED', label: 'Selesai' },
  { value: 'CANCELLED', label: 'Dibatalkan' },
];

export function AdminLiveQuizHistoryPage() {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const quizId = params.get('quizId') ?? '';
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState<SessionListItem | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['live-quiz', 'sessions', status, page, quizId],
    queryFn: () => liveQuizApi.listSessions({ ...(status ? { status } : {}), ...(quizId ? { quizId } : {}), page, pageSize: 15 }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => liveQuizApi.deleteSession(id),
    onSuccess: () => {
      toast.success('Riwayat sesi dihapus. Kuis utama tetap ada.');
      setToDelete(null);
      void queryClient.invalidateQueries({ queryKey: ['live-quiz'] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Gagal menghapus riwayat sesi.')),
  });
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="page-shell">
      <PageHeader
        variant="panel"
        eyebrow="Live Quiz"
        title="Riwayat sesi"
        description="Semua sesi live beserta laporan hasil, peringkat, dan ekspor CSV. Menghapus riwayat sesi tidak menghapus kuis utamanya."
      />

      {quizId && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <span>Menampilkan riwayat satu kuis.</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const next = new URLSearchParams(params);
              next.delete('quizId');
              setParams(next);
              setPage(1);
            }}
          >
            Tampilkan semua
          </Button>
        </div>
      )}

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
                        <div className="flex flex-wrap justify-end gap-2">
                          {isActivePhase(session.status) ? (
                            <Button asChild size="sm">
                              <Link to={`/admin/live-quiz/host/${session.id}`}>Buka</Link>
                            </Button>
                          ) : (
                            <>
                              <Button asChild size="sm" variant="outline">
                                <Link to={`/admin/live-quiz/laporan/${session.id}`}>Lihat Hasil</Link>
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                onClick={() => setToDelete(session)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Hapus Riwayat Sesi
                              </Button>
                            </>
                          )}
                        </div>
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

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Hapus riwayat sesi?"
        description={
          toDelete
            ? `Sesi "${toDelete.title}" (${phaseLabel(toDelete.status)}, ${toDelete.playerCount} peserta, ${formatDateTime(toDelete.createdAt)}) akan dihapus. Nilai dan jawaban pada sesi ini ikut terhapus. Kuis utama, bank soal, akun siswa, dan sesi lain tetap ada.`
            : undefined
        }
        confirmText="Hapus"
        loading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
        onCancel={() => {
          if (!remove.isPending) setToDelete(null);
        }}
      />

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
