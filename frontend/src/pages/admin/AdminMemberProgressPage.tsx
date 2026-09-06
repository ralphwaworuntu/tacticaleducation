import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { toast } from 'sonner';
import { PageHeader } from '@/components/common/PageHeader';
import { apiGet, apiPost } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type MonitoringSummary = {
  id: string;
  name: string;
  email: string;
  joinedAt: string;
  membership: {
    packageName?: string | null;
    activatedAt?: string | null;
    expiresAt?: string | null;
  } | null;
  latestTryout: { score: number | null; createdAt: string } | null;
  latestPractice: { score: number | null; createdAt: string } | null;
  latestCermat: { correct: number; total: number; createdAt: string } | null;
};

type MonitoringDetail = {
  id: string;
  name: string;
  email: string;
  tryoutResults: Array<{ id: string; score: number | null; createdAt: string; tryout: { name: string } }>;
  practiceResults: Array<{ id: string; score: number | null; createdAt: string; set: { title: string } }>;
  cermatSessions: Array<{ id: string; correctCount: number; totalQuestions: number; createdAt: string }>;
};

const formatScore = (value?: number | null) => (typeof value === 'number' ? `${value.toFixed(1)}%` : '-');

type ExamBlockItem = {
  id: string;
  type: 'TRYOUT' | 'PRACTICE' | 'CERMAT';
  reason?: string | null;
  code: string;
  violationCount: number;
  blockedAt: string;
  user: { id: string; name: string; email: string };
};

export function AdminMemberProgressPage() {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [grantUserId, setGrantUserId] = useState('');
  const [grantAmount, setGrantAmount] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['admin-monitoring-users'],
    queryFn: () => apiGet<MonitoringSummary[]>('/admin/monitoring/users'),
  });

  const {
    data: detail,
    isLoading: detailLoading,
  } = useQuery({
    queryKey: ['admin-monitoring-detail', selectedUser],
    queryFn: () => apiGet<MonitoringDetail>(`/admin/monitoring/users/${selectedUser}`),
    enabled: Boolean(selectedUser),
  });

  const {
    data: blocks,
    isLoading: blocksLoading,
    refetch: refetchBlocks,
  } = useQuery({
    queryKey: ['admin-exam-blocks'],
    queryFn: () => apiGet<ExamBlockItem[]>('/admin/exams/blocks'),
  });

  const regenerateBlock = useMutation<ExamBlockItem, unknown, string>({
    mutationFn: (blockId) => apiPost<ExamBlockItem>(`/admin/exams/blocks/${blockId}/regenerate`),
    onSuccess: (updated) => {
      toast.success('Kode blokir diperbarui', { description: `${updated.user.name} • ${updated.code}` });
      refetchBlocks();
    },
    onError: () => toast.error('Gagal membuat kode baru'),
  });

  const grantQuota = useMutation({
    mutationFn: (payload: { userId: string; amount: number }) =>
      apiPost<{ tryoutRemaining: number | null; tryoutQuota: number; tryoutUsed: number }>(
        '/admin/membership/grant-tryout',
        payload,
      ),
    onSuccess: (payload) => {
      const remainingLabel = payload.tryoutRemaining === null ? 'Kuota tak terbatas' : `${payload.tryoutRemaining}x tryout tersisa`;
      toast.success('Kuota gratis ditambahkan', { description: remainingLabel });
      setGrantAmount(1);
    },
    onError: (error) => {
      const message = (error as AxiosError<{ message?: string }>).response?.data?.message;
      toast.error(message ?? 'Gagal menambahkan kuota gratis');
    },
  });

  const handleGrantSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!grantUserId) {
      toast.error('Pilih member terlebih dahulu');
      return;
    }
    if (grantAmount <= 0) {
      toast.error('Jumlah kuota minimal 1');
      return;
    }
    grantQuota.mutate({ userId: grantUserId, amount: grantAmount });
  };

  return (
    <section className="page-shell">
      <PageHeader variant="panel"
        eyebrow="Admin"
        title="Monitoring Kemajuan Member"
        description="Pantau progres tryout, latihan, dan tes kecermatan seluruh member."
      />

      <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500">Daftar Member</p>
                <h3 className="text-xl font-semibold text-slate-900">Aktivitas Terbaru</h3>
              </div>
            </div>
            {isLoading && <Skeleton className="h-64" />}
            <div className="space-y-3">
              {(data ?? []).map((member) => {
                const isActive = selectedUser === member.id;
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => setSelectedUser(member.id)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition hover:border-brand-300 ${
                      isActive ? 'border-brand-500 bg-brand-50' : 'border-slate-100 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{member.name}</p>
                        <p className="text-xs text-slate-500">{member.email}</p>
                      </div>
                      <p className="text-xs text-slate-500">
                        Bergabung {new Date(member.joinedAt).toLocaleDateString('id-ID')}
                      </p>
                    </div>
                    <div className="mt-2 grid gap-2 text-xs text-slate-600 md:grid-cols-3">
                      <span>
                        Paket:{' '}
                        <strong>{member.membership?.packageName ?? 'Belum aktif'}</strong>
                      </span>
                      <span>
                        Tryout:{' '}
                        <strong>{member.latestTryout ? formatScore(member.latestTryout.score) : '-'}</strong>
                      </span>
                      <span>
                        Cermat:{' '}
                        <strong>
                          {member.latestCermat
                            ? `${member.latestCermat.correct}/${member.latestCermat.total}`
                            : '-'}
                        </strong>
                      </span>
                    </div>
                  </button>
                );
              })}
              {!isLoading && (data ?? []).length === 0 && (
                <p className="text-sm text-slate-500">Belum ada member.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-6">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500">Detail Progres</p>
              <h3 className="text-xl font-semibold text-slate-900">{detail?.name ?? 'Pilih member'}</h3>
              {detail && <p className="text-xs text-slate-500">{detail.email}</p>}
            </div>
            {detailLoading && <Skeleton className="h-48" />}
            {!selectedUser && <p className="text-sm text-slate-500">Pilih member untuk melihat detail hasil belajar.</p>}
            {detail && (
              <div className="space-y-4 text-sm text-slate-600">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Tryout Terakhir</p>
                  <ul className="mt-2 space-y-2">
                    {detail.tryoutResults.slice(0, 5).map((result) => (
                      <li key={result.id} className="rounded-xl border border-slate-100 p-3">
                        <p className="font-semibold text-slate-900">{result.tryout.name}</p>
                        <p className="text-xs text-slate-500">
                          Skor {formatScore(result.score)} • {new Date(result.createdAt).toLocaleDateString('id-ID')}
                        </p>
                      </li>
                    ))}
                    {detail.tryoutResults.length === 0 && <p className="text-xs text-slate-500">Belum ada riwayat tryout.</p>}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Latihan Soal</p>
                  <ul className="mt-2 space-y-2">
                    {detail.practiceResults.slice(0, 5).map((result) => (
                      <li key={result.id} className="rounded-xl border border-slate-100 p-3">
                        <p className="font-semibold text-slate-900">{result.set.title}</p>
                        <p className="text-xs text-slate-500">
                          Skor {formatScore(result.score)} • {new Date(result.createdAt).toLocaleDateString('id-ID')}
                        </p>
                      </li>
                    ))}
                    {detail.practiceResults.length === 0 && <p className="text-xs text-slate-500">Belum ada riwayat latihan.</p>}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Tes Kecermatan</p>
                  <ul className="mt-2 space-y-2">
                    {detail.cermatSessions.slice(0, 5).map((session) => (
                      <li key={session.id} className="rounded-xl border border-slate-100 p-3">
                        <p className="font-semibold text-slate-900">
                          {session.correctCount}/{session.totalQuestions} benar
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(session.createdAt).toLocaleDateString('id-ID')}
                        </p>
                      </li>
                    ))}
                    {detail.cermatSessions.length === 0 && (
                      <p className="text-xs text-slate-500">Belum ada riwayat tes kecermatan.</p>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500">Daftar Blokir Ujian</p>
              <h3 className="text-xl font-semibold text-slate-900">Member Membutuhkan Kode</h3>
              <p className="text-xs text-slate-500">Gunakan tombol di setiap kartu untuk mengirim kode 6 digit baru.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchBlocks()} disabled={blocksLoading}>
              {blocksLoading ? 'Memuat...' : 'Refresh'}
            </Button>
          </div>
          {blocksLoading && <Skeleton className="h-32" />}
          <div className="space-y-3">
            {(blocks ?? []).map((block) => {
              const isPending = regenerateBlock.isPending && regenerateBlock.variables === block.id;
              return (
                <div key={block.id} className="rounded-2xl border border-slate-100 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{block.user.name}</p>
                      <p className="text-xs text-slate-500">{block.user.email}</p>
                    </div>
                    <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
                      {block.type === 'TRYOUT' ? 'Tryout' : block.type === 'CERMAT' ? 'Kecermatan' : 'Latihan'} •{' '}
                      {block.violationCount} pelanggaran
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                    <p>
                      Kode Aktif:{' '}
                      <span className="rounded-lg bg-slate-900 px-2 py-1 font-mono text-base font-semibold text-white">
                        {block.code}
                      </span>
                    </p>
                    <p>Terblokir: {new Date(block.blockedAt).toLocaleString('id-ID')}</p>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Alasan: {block.reason ?? 'Tidak tercatat'}</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button
                      size="sm"
                      onClick={() => regenerateBlock.mutate(block.id)}
                      disabled={isPending}
                    >
                      {isPending ? 'Mengirim...' : 'Generate Kode Baru'}
                    </Button>
                  </div>
                </div>
              );
            })}
            {!blocksLoading && (blocks ?? []).length === 0 && (
              <p className="text-sm text-slate-500">Belum ada member yang diblokir ujian.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">Kuota Tryout Gratis</p>
            <h3 className="text-xl font-semibold text-slate-900">Tambah Kuota untuk Member</h3>
            <p className="text-xs text-slate-500">Gunakan fitur ini untuk membantu member yang butuh kuota tambahan tanpa membeli addon.</p>
          </div>
          <form className="grid gap-3 md:grid-cols-[2fr,1fr,auto]" onSubmit={handleGrantSubmit}>
            <div>
              <p className="text-xs font-semibold text-slate-500">Pilih Member</p>
              <select
                className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-700"
                value={grantUserId}
                onChange={(event) => setGrantUserId(event.target.value)}
              >
                <option value="">Pilih member</option>
                {(data ?? []).map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} — {member.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Jumlah Kuota</p>
              <Input
                type="number"
                min={1}
                max={50}
                value={grantAmount}
                onChange={(event) => setGrantAmount(Number(event.target.value))}
                className="mt-1"
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={grantQuota.isPending}>
                {grantQuota.isPending ? 'Menambahkan...' : 'Tambah Kuota'}
              </Button>
            </div>
          </form>
          <p className="text-[11px] text-slate-500">Kuota gratis akan menambah limit tryout pada membership aktif member.</p>
        </CardContent>
      </Card>
    </section>
  );
}
