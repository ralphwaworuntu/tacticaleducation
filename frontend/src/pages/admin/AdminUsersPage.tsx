import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiGet, apiPatch, apiPost } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import type { AuthUser } from '@/store/auth';

type AdminUser = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: 'ADMIN' | 'MEMBER';
  isActive: boolean;
  createdAt: string;
  memberArea?: { slug: string } | null;
};

export function AdminUsersPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { setSession, accessToken } = useAuth();
  const [statusConfirm, setStatusConfirm] = useState<{ user: AdminUser; nextStatus: boolean } | null>(null);
  const [resetConfirm, setResetConfirm] = useState<AdminUser | null>(null);
  const [resetResult, setResetResult] = useState<{ userId: string; tempPassword: string } | null>(null);
  const [impersonateConfirm, setImpersonateConfirm] = useState<AdminUser | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['admin-users'], queryFn: () => apiGet<AdminUser[]>('/admin/users') });

  const mutation = useMutation({
    mutationFn: (payload: { id: string; role: 'ADMIN' | 'MEMBER' }) => apiPatch(`/admin/users/${payload.id}/role`, { role: payload.role }),
    onSuccess: () => {
      toast.success('Role pengguna diperbarui');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: () => toast.error('Gagal memperbarui role'),
  });

  const statusMutation = useMutation({
    mutationFn: (payload: { id: string; isActive: boolean }) => apiPatch(`/admin/users/${payload.id}/status`, { isActive: payload.isActive }),
    onSuccess: () => {
      toast.success('Status akun diperbarui');
      setStatusConfirm(null);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: () => toast.error('Gagal memperbarui status akun'),
  });

  const resetMutation = useMutation({
    mutationFn: (payload: { id: string }) => apiPost<{ userId: string; tempPassword: string }>(`/admin/users/${payload.id}/reset-password`),
    onSuccess: (payload) => {
      toast.success('Password baru berhasil dibuat');
      setResetConfirm(null);
      setResetResult(payload);
    },
    onError: () => toast.error('Gagal mereset password'),
  });

  const impersonateMutation = useMutation({
    mutationFn: (payload: { id: string }) =>
      apiPost<{ user: AuthUser; accessToken: string; refreshToken: string }>(`/admin/users/${payload.id}/impersonate`),
    onSuccess: (payload) => {
      setImpersonateConfirm(null);
      setSession(payload);
      toast.success('Mengakses dashboard member.');
      navigate('/app');
    },
    onError: () => toast.error('Gagal membuka dashboard member'),
  });

  const users = data ?? [];

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await api.get('/admin/users/export', {
        responseType: 'blob',
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'manajemen-pengguna.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error('Gagal mengunduh CSV pengguna');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Manajemen Pengguna</h2>
          <p className="mt-2 text-sm text-slate-500">Promosikan mentor menjadi admin atau pantau member aktif.</p>
        </div>
        <Button type="button" variant="outline" onClick={handleExport} disabled={isExporting}>
          {isExporting ? 'Mengunduh...' : 'Download CSV'}
        </Button>
      </div>
      <Card>
        <CardContent className="space-y-4 p-6">
          {isLoading && <Skeleton className="h-48" />}
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2">Nama</th>
                  <th>Email</th>
                  <th>Telepon</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Kode Akses</th>
                  <th>Bergabung</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const roleDisabled = user.name === 'Super Admin';
                  const statusDisabled = roleDisabled;
                  const impersonateDisabled = roleDisabled || user.role !== 'MEMBER';
                  return (
                    <tr key={user.id} className="border-t border-slate-100">
                      <td className="py-3 font-medium text-slate-900">{user.name}</td>
                      <td>{user.email}</td>
                      <td>{user.phone ?? '-'}</td>
                      <td>
                        <select
                          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold"
                          value={user.role}
                          disabled={roleDisabled || mutation.isPending}
                          onChange={(event) =>
                            mutation.mutate({ id: user.id, role: event.target.value as 'ADMIN' | 'MEMBER' })
                          }
                        >
                          <option value="MEMBER">MEMBER</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            user.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                          } ${statusDisabled ? 'opacity-50' : ''}`}
                          disabled={statusDisabled || statusMutation.isPending}
                          onClick={() =>
                            setStatusConfirm({
                              user,
                              nextStatus: !user.isActive,
                            })
                          }
                        >
                          {user.isActive ? 'Aktif' : 'Nonaktif'}
                        </button>
                      </td>
                      <td>{user.memberArea?.slug ?? '-'}</td>
                      <td>{new Date(user.createdAt).toLocaleDateString('id-ID')}</td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={roleDisabled || resetMutation.isPending}
                            onClick={() => setResetConfirm(user)}
                          >
                            Reset Password
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={impersonateDisabled || impersonateMutation.isPending}
                            onClick={() => setImpersonateConfirm(user)}
                          >
                            Masuk Dashboard
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!isLoading && users.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-4 text-center text-slate-500">
                      Belum ada pengguna.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      <ConfirmDialog
        open={Boolean(statusConfirm)}
        title={statusConfirm?.nextStatus ? 'Aktifkan akun ini?' : 'Nonaktifkan akun ini?'}
        description={
          statusConfirm?.nextStatus
            ? 'Pengguna akan kembali dapat mengakses dashboard setelah diaktifkan.'
            : 'Pengguna tidak dapat login hingga Anda mengaktifkannya kembali.'
        }
        confirmText={statusConfirm?.nextStatus ? 'Aktifkan' : 'Nonaktifkan'}
        cancelText="Batal"
        loading={statusMutation.isPending}
        onConfirm={() => {
          if (!statusConfirm) return;
          statusMutation.mutate({ id: statusConfirm.user.id, isActive: statusConfirm.nextStatus });
        }}
        onCancel={() => {
          if (statusMutation.isPending) return;
          setStatusConfirm(null);
        }}
      />
      <ConfirmDialog
        open={Boolean(resetConfirm)}
        title="Reset password member?"
        description="Sistem akan membuat password baru. Bagikan password ini secara aman kepada member."
        confirmText="Reset"
        cancelText="Batal"
        loading={resetMutation.isPending}
        onConfirm={() => {
          if (!resetConfirm) return;
          resetMutation.mutate({ id: resetConfirm.id });
        }}
        onCancel={() => {
          if (resetMutation.isPending) return;
          setResetConfirm(null);
        }}
      />
      <ConfirmDialog
        open={Boolean(resetResult)}
        title="Password baru siap"
        description={resetResult ? `Password sementara: ${resetResult.tempPassword}` : ''}
        confirmText="Saya sudah catat"
        cancelText="Tutup"
        loading={false}
        onConfirm={() => setResetResult(null)}
        onCancel={() => setResetResult(null)}
      />
      <ConfirmDialog
        open={Boolean(impersonateConfirm)}
        title="Masuk sebagai member?"
        description="Anda akan beralih ke akun member dan sesi admin akan tergantikan pada perangkat ini."
        confirmText="Lanjutkan"
        cancelText="Batal"
        loading={impersonateMutation.isPending}
        onConfirm={() => {
          if (!impersonateConfirm) return;
          impersonateMutation.mutate({ id: impersonateConfirm.id });
        }}
        onCancel={() => {
          if (impersonateMutation.isPending) return;
          setImpersonateConfirm(null);
        }}
      />
    </section>
  );
}
