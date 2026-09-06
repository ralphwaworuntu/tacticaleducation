import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { formatDate } from '@/utils/format';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useMembershipStatus } from '@/hooks/useMembershipStatus';
import { MembershipRequired } from '@/components/dashboard/MembershipRequired';
import { PageHeader } from '@/components/common/PageHeader';
import type { CermatMode } from '@/types/cermat';
import { CERMAT_MODE_LABELS } from '@/types/cermat';

type CermatAttemptDetail = {
  id: string;
  mode: CermatMode;
  totalSessions: number;
  sessionCount: number;
  averageScore: number;
  totalCorrect: number;
  totalQuestions: number;
  finishedAt?: string | null;
  startedAt: string;
  sessions: Array<{
    id: string;
    sessionIndex: number;
    totalQuestions: number;
    correctCount: number;
    score: number | null;
    finishedAt?: string | null;
    createdAt: string;
  }>;
};

export function CermatHistoryDetailPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const membership = useMembershipStatus();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['cermat-history-detail', attemptId],
    queryFn: () => apiGet<CermatAttemptDetail>(`/exams/cermat/history/${attemptId}`),
    enabled: Boolean(membership.data?.isActive && attemptId),
  });

  if (membership.isLoading || isLoading) {
    return <Skeleton className="h-72" />;
  }

  if (!membership.data?.isActive) {
    return <MembershipRequired status={membership.data} />;
  }

  if (membership.data?.allowCermat === false) {
    return (
      <section className="rounded-3xl border border-brand-200 bg-brand-50 p-6 text-sm text-brand-800">
        Paket membership kamu tidak mencakup akses tes kecermatan. Hubungi admin untuk upgrade paket.
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className="page-shell">
        <div className="rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-slate-600">Detail hasil tes tidak ditemukan.</p>
          <Button asChild className="mt-4" variant="outline">
            <Link to="/app/tes-kecermatan/riwayat">Kembali ke Riwayat</Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="page-shell">
      <PageHeader
        eyebrow="Detail Hasil Kecermatan"
        title={CERMAT_MODE_LABELS[data.mode]}
        description={`Rincian ${data.sessionCount} sesi — selesai ${formatDate(data.finishedAt ?? data.startedAt)}`}
        action={
          <Button asChild variant="outline">
            <Link to="/app/tes-kecermatan/riwayat">Kembali</Link>
          </Button>
        }
      />

      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-900">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">Ringkasan Tes</p>
        <p className="mt-2 text-4xl font-bold">{data.averageScore}%</p>
        <p className="mt-1 text-sm">
          {data.totalCorrect}/{data.totalQuestions} benar dari {data.sessionCount} sesi
        </p>
      </div>

      <div className="rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-lg font-semibold text-slate-900">Rincian Sesi 1 – {data.sessionCount}</h3>
          <p className="text-sm text-slate-500">Skor per sesi dari paket tes yang dipilih.</p>
        </div>
        <div className="divide-y divide-slate-100">
          {data.sessions.map((session) => (
            <div key={session.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <p className="font-semibold text-slate-900">
                  Sesi {session.sessionIndex} — {CERMAT_MODE_LABELS[data.mode]}
                </p>
                <p className="text-sm text-slate-500">{formatDate(session.finishedAt ?? session.createdAt)}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-900">{session.score ?? 0}%</p>
                <p className="text-sm text-slate-500">
                  {session.correctCount}/{session.totalQuestions} benar
                </p>
              </div>
            </div>
          ))}
          {data.sessions.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-500">Belum ada data sesi.</div>
          )}
        </div>
      </div>
    </section>
  );
}
