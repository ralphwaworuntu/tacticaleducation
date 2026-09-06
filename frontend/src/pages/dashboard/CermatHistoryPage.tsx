import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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

type CermatHistoryAttempt = {
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

const HISTORY_MODES: CermatMode[] = ['IMAGE', 'NUMBER', 'LETTER'];

export function CermatHistoryPage() {
  const membership = useMembershipStatus();
  const [activeMode, setActiveMode] = useState<CermatMode>('IMAGE');
  const { data, isLoading } = useQuery({
    queryKey: ['cermat-history'],
    queryFn: () => apiGet<CermatHistoryAttempt[]>('/exams/cermat/history'),
    enabled: Boolean(membership.data?.isActive),
  });

  const filtered = useMemo(() => (data ?? []).filter((item) => item.mode === activeMode), [activeMode, data]);

  if (membership.isLoading) {
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

  if (isLoading || !data) {
    return <Skeleton className="h-72" />;
  }

  return (
    <section className="page-shell">
      <PageHeader
        eyebrow="Riwayat Tes Kecermatan"
        title="Rekap Tes Kecermatan"
        description="Setiap baris adalah satu paket tes lengkap. Buka Detail untuk melihat rincian sesi."
        action={
          <>
            {HISTORY_MODES.map((mode) => (
              <Button
                key={mode}
                variant={activeMode === mode ? 'primary' : 'outline'}
                onClick={() => setActiveMode(mode)}
              >
                {CERMAT_MODE_LABELS[mode]}
              </Button>
            ))}
          </>
        }
      />

      <div className="rounded-3xl border border-slate-100 bg-white shadow-sm">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">Belum ada riwayat untuk varian ini.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <p className="font-semibold text-slate-900">
                    {CERMAT_MODE_LABELS[item.mode]} — {item.sessionCount} sesi
                  </p>
                  <p className="text-sm text-slate-500">{formatDate(item.finishedAt ?? item.startedAt)}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {item.totalCorrect}/{item.totalQuestions} benar keseluruhan
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="text-right">
                    <p className="text-2xl font-bold text-slate-900">{item.averageScore ?? 0}%</p>
                    <p className="text-sm text-slate-500">Rata-rata skor</p>
                  </div>
                  <Button asChild variant="outline">
                    <Link to={`/app/tes-kecermatan/riwayat/${item.id}`}>Detail</Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
