import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, apiGet } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';

type RankingUser = {
  id: string;
  name: string;
  email: string;
};

type RankingSummary = {
  user: RankingUser;
  tryoutCount: number;
  tryoutAvg: number;
  practiceCount: number;
  practiceAvg: number;
  cermatCount: number;
  cermatAvg: number;
};

type RankingTryoutItem = {
  id: string;
  score: number | null;
  createdAt: string;
  startedAt: string;
  completedAt?: string | null;
  user: RankingUser;
  tryout: { name: string };
};

type RankingPracticeItem = {
  id: string;
  score: number | null;
  createdAt: string;
  completedAt?: string | null;
  user: RankingUser;
  set: { title: string };
};

type RankingCermatItem = {
  id: string;
  averageScore: number | null;
  startedAt: string;
  finishedAt?: string | null;
  mode: 'NUMBER' | 'LETTER';
  user: RankingUser;
};

type RankingResponse = {
  summary: RankingSummary[];
  tryouts: RankingTryoutItem[];
  practices: RankingPracticeItem[];
  cermat: RankingCermatItem[];
};

const toInputDateTime = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
};

export function AdminRankingPage() {
  const { accessToken } = useAuth();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const params = useMemo(() => {
    const query = new URLSearchParams();
    if (startDate) query.set('startDate', new Date(startDate).toISOString());
    if (endDate) query.set('endDate', new Date(endDate).toISOString());
    return query.toString();
  }, [endDate, startDate]);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin-ranking', params],
    queryFn: () => apiGet<RankingResponse>(`/admin/ranking${params ? `?${params}` : ''}`),
  });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await api.get(`/admin/ranking/export${params ? `?${params}` : ''}`, {
        responseType: 'blob',
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'ranking-summary.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-900">Ranking Member</h2>
        <p className="mt-2 text-sm text-slate-500">Rekapan nilai latihan soal, tryout, dan kecermatan berdasarkan rentang waktu.</p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <p className="text-xs font-semibold text-slate-500">Mulai</p>
              <Input type="datetime-local" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Selesai</p>
              <Input type="datetime-local" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={() => refetch()} disabled={isFetching}>
                {isFetching ? 'Memuat...' : 'Terapkan Filter'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
              >
                Reset
              </Button>
              <Button variant="outline" onClick={handleExport} disabled={isExporting}>
                {isExporting ? 'Mengekspor...' : 'Export CSV'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h3 className="text-xl font-semibold text-slate-900">Rekapan Per Member</h3>
          {isLoading && <Skeleton className="h-40" />}
          {!isLoading && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-2">Member</th>
                    <th className="py-2">Tryout</th>
                    <th className="py-2">Latihan</th>
                    <th className="py-2">Kecermatan</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700">
                  {(data?.summary ?? []).map((item) => (
                    <tr key={item.user.id} className="border-t">
                      <td className="py-3">
                        <div className="font-semibold text-slate-900">{item.user.name}</div>
                        <div className="text-xs text-slate-500">{item.user.email}</div>
                      </td>
                      <td className="py-3">
                        <div className="font-semibold">{item.tryoutAvg.toFixed(1)}%</div>
                        <div className="text-xs text-slate-500">{item.tryoutCount} sesi</div>
                      </td>
                      <td className="py-3">
                        <div className="font-semibold">{item.practiceAvg.toFixed(1)}%</div>
                        <div className="text-xs text-slate-500">{item.practiceCount} sesi</div>
                      </td>
                      <td className="py-3">
                        <div className="font-semibold">{item.cermatAvg.toFixed(1)}%</div>
                        <div className="text-xs text-slate-500">{item.cermatCount} sesi</div>
                      </td>
                    </tr>
                  ))}
                  {!data?.summary?.length && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-500">
                        Belum ada data ranking pada rentang waktu ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="space-y-4 p-6">
            <h3 className="text-lg font-semibold text-slate-900">Detail Tryout</h3>
            {isLoading && <Skeleton className="h-32" />}
            {!isLoading && (
              <div className="space-y-3 text-sm text-slate-600">
                {(data?.tryouts ?? []).map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-100 p-3">
                    <div className="font-semibold text-slate-900">{item.tryout.name}</div>
                    <div className="text-xs text-slate-500">{item.user.name} - {item.user.email}</div>
                    <div className="mt-2 text-xs text-slate-500">
                      Mulai {toInputDateTime(item.startedAt)} - Selesai {item.completedAt ? toInputDateTime(item.completedAt) : '-'}
                    </div>
                    <div className="mt-2 font-semibold">{(item.score ?? 0).toFixed(1)}%</div>
                  </div>
                ))}
                {!data?.tryouts?.length && <p className="text-sm text-slate-500">Belum ada data tryout.</p>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-6">
            <h3 className="text-lg font-semibold text-slate-900">Detail Latihan</h3>
            {isLoading && <Skeleton className="h-32" />}
            {!isLoading && (
              <div className="space-y-3 text-sm text-slate-600">
                {(data?.practices ?? []).map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-100 p-3">
                    <div className="font-semibold text-slate-900">{item.set.title}</div>
                    <div className="text-xs text-slate-500">{item.user.name} - {item.user.email}</div>
                    <div className="mt-2 text-xs text-slate-500">
                      Mulai {toInputDateTime(item.createdAt)} - Selesai {item.completedAt ? toInputDateTime(item.completedAt) : '-'}
                    </div>
                    <div className="mt-2 font-semibold">{(item.score ?? 0).toFixed(1)}%</div>
                  </div>
                ))}
                {!data?.practices?.length && <p className="text-sm text-slate-500">Belum ada data latihan.</p>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-6">
            <h3 className="text-lg font-semibold text-slate-900">Detail Kecermatan</h3>
            {isLoading && <Skeleton className="h-32" />}
            {!isLoading && (
              <div className="space-y-3 text-sm text-slate-600">
                {(data?.cermat ?? []).map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-100 p-3">
                    <div className="font-semibold text-slate-900">{item.mode === 'LETTER' ? 'Huruf' : 'Angka'}</div>
                    <div className="text-xs text-slate-500">{item.user.name} - {item.user.email}</div>
                    <div className="mt-2 text-xs text-slate-500">
                      Mulai {toInputDateTime(item.startedAt)} - Selesai {item.finishedAt ? toInputDateTime(item.finishedAt) : '-'}
                    </div>
                    <div className="mt-2 font-semibold">{(item.averageScore ?? 0).toFixed(1)}%</div>
                  </div>
                ))}
                {!data?.cermat?.length && <p className="text-sm text-slate-500">Belum ada data kecermatan.</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
