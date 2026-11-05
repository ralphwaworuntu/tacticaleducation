import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, apiGet } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/common/PageHeader';

type ReportSummary = {
  members: number;
  tryoutCategories: number;
  tryoutQuestions: number;
  practiceCategories: number;
  practiceQuestions: number;
};

type MemberActivity = {
  id: string;
  name: string;
  email: string;
  joinedAt: string;
  membership: { packageName?: string | null; activatedAt?: string | null; expiresAt?: string | null } | null;
  latestTryout?: { score?: number | null; createdAt?: string | null } | null;
  latestPractice?: { score?: number | null; createdAt?: string | null } | null;
  latestCermat?: { correctCount?: number | null; totalQuestions?: number | null; createdAt?: string | null } | null;
};

type UserManagement = {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
  isActive: boolean;
  createdAt: string;
  phone?: string | null;
  memberArea?: { slug: string } | null;
};

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('id-ID');
}

export function AdminReportingPage() {
  const { accessToken } = useAuth();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sort, setSort] = useState<'asc' | 'desc'>('desc');

  const params = useMemo(() => {
    const query = new URLSearchParams();
    if (startDate) query.set('startDate', startDate);
    if (endDate) query.set('endDate', endDate);
    query.set('sort', sort);
    return query.toString();
  }, [startDate, endDate, sort]);

  const summaryQuery = useQuery({
    queryKey: ['report-summary', params],
    queryFn: () => apiGet<ReportSummary>(`/admin/reporting/summary?${params}`),
  });
  const membersQuery = useQuery({
    queryKey: ['report-members', params],
    queryFn: () => apiGet<MemberActivity[]>(`/admin/reporting/members?${params}`),
  });
  const usersQuery = useQuery({
    queryKey: ['report-users', params],
    queryFn: () => apiGet<UserManagement[]>(`/admin/reporting/users?${params}`),
  });

  const handleExport = async (type: 'members' | 'users') => {
    const response = await api.get(`/admin/reporting/export?type=${type}&${params}`, {
      responseType: 'blob',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });
    const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = type === 'members' ? 'report-members.csv' : 'report-users.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
  };

  if (summaryQuery.isLoading || membersQuery.isLoading || usersQuery.isLoading) {
    return <Skeleton className="h-72" />;
  }

  const summary = summaryQuery.data;

  return (
    <section className="page-shell">
      <PageHeader variant="panel"
        eyebrow="Admin"
        title="Reporting"
        description="Pantau data member, soal, dan aktivitas dalam satu dashboard."
      />

      <Card>
        <CardContent className="grid gap-4 p-6 md:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
          <div>
            <label className="admin-field-label">Mulai</label>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <label className="admin-field-label">Sampai</label>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <label className="admin-field-label">Urutan</label>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as 'asc' | 'desc')}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
            >
              <option value="desc">Terbaru</option>
              <option value="asc">Terlama</option>
            </select>
          </div>
          <div className="flex flex-wrap items-end justify-end gap-2 md:justify-self-end">
            <Button type="button" variant="outline" className="w-full md:w-auto" onClick={() => handleExport('members')}>
              Export Member CSV
            </Button>
            <Button type="button" variant="outline" className="w-full md:w-auto" onClick={() => handleExport('users')}>
              Export User CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="admin-metric-card" data-tone="blue">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Member</p>
            <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
              {summary.members.toLocaleString('id-ID')}
            </p>
          </div>
          <div className="admin-metric-card" data-tone="purple">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Kategori & Soal Tryout</p>
            <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
              {summary.tryoutCategories} / {summary.tryoutQuestions}
            </p>
          </div>
          <div className="admin-metric-card" data-tone="purple">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Kategori & Soal Latihan</p>
            <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
              {summary.practiceCategories} / {summary.practiceQuestions}
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Aktivitas Member</h3>
            <p className="mt-1 text-sm text-slate-500">Ringkasan tryout, latihan, dan tes kecermatan terbaru.</p>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Email</th>
                  <th>Bergabung</th>
                  <th>Membership</th>
                  <th>Tryout</th>
                  <th>Latihan</th>
                  <th>Kecermatan</th>
                </tr>
              </thead>
              <tbody>
                {(membersQuery.data ?? []).map((member) => (
                  <tr key={member.id}>
                    <td className="font-medium text-slate-900">{member.name}</td>
                    <td>{member.email}</td>
                    <td className="whitespace-nowrap">{formatDate(member.joinedAt)}</td>
                    <td>{member.membership?.packageName ?? '-'}</td>
                    <td>{member.latestTryout?.score ?? '-'}</td>
                    <td>{member.latestPractice?.score ?? '-'}</td>
                    <td>
                      {member.latestCermat
                        ? `${member.latestCermat.correctCount}/${member.latestCermat.totalQuestions}`
                        : '-'}
                    </td>
                  </tr>
                ))}
                {(membersQuery.data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-500">
                      Tidak ada data member.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Manajemen Pengguna</h3>
            <p className="mt-1 text-sm text-slate-500">Daftar user beserta status aktif & role.</p>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Telepon</th>
                  <th>Kode Akses</th>
                  <th>Bergabung</th>
                </tr>
              </thead>
              <tbody>
                {(usersQuery.data ?? []).map((user) => (
                  <tr key={user.id}>
                    <td className="font-medium text-slate-900">{user.name}</td>
                    <td>{user.email}</td>
                    <td>{user.role}</td>
                    <td>
                      <span
                        className={
                          user.isActive
                            ? 'status-chip status-chip-success'
                            : 'status-chip bg-slate-100 text-slate-500'
                        }
                      >
                        {user.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td>{user.phone ?? '-'}</td>
                    <td>{user.memberArea?.slug ?? '-'}</td>
                    <td className="whitespace-nowrap">{formatDate(user.createdAt)}</td>
                  </tr>
                ))}
                {(usersQuery.data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-500">
                      Tidak ada data user.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
