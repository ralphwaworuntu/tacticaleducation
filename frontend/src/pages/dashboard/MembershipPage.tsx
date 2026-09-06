import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost } from '@/lib/api';
import type { AddonPackage, MemberTransaction, MembershipPackage, MembershipStatus, PaymentSetting } from '@/types/exam';
import { formatCurrency } from '@/utils/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/common/PageHeader';

export function MembershipPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ['membership-packages'], queryFn: () => apiGet<MembershipPackage[]>('/commerce/packages') });
  const { data: status } = useQuery({
    queryKey: ['membership-status'],
    queryFn: () => apiGet<MembershipStatus>('/commerce/membership/status'),
  });
  const { data: addons } = useQuery({
    queryKey: ['addon-packages'],
    queryFn: () => apiGet<AddonPackage[]>('/commerce/addons'),
    enabled: Boolean(status?.isActive),
  });
  const { data: paymentInfo } = useQuery({
    queryKey: ['payment-info'],
    queryFn: () => apiGet<PaymentSetting>('/commerce/payment-info'),
  });
  const [selected, setSelected] = useState<MembershipPackage | null>(null);
  const [selectedAddon, setSelectedAddon] = useState<AddonPackage | null>(null);
  const mutation = useMutation({
    mutationFn: (packageId: string) =>
      apiPost<MemberTransaction>('/commerce/transactions', {
        type: 'MEMBERSHIP',
        packageId,
        method: 'Manual Transfer',
      }),
    onSuccess: (transaction) => {
      toast.success('Transaksi dibuat. Lanjutkan unggah bukti transfer.');
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['membership-status'] });
      navigate(`/app/konfirmasi-pembayaran?code=${transaction.code}`);
    },
    onError: () => toast.error('Gagal membuat transaksi'),
  });

  const addonMutation = useMutation({
    mutationFn: (addon: AddonPackage) => {
      if (!status?.transactionId) {
        throw new Error('Membership belum aktif');
      }
      return apiPost<MemberTransaction>('/commerce/transactions', {
        type: 'ADDON',
        addonId: addon.id,
        targetTransactionId: status.transactionId,
        method: 'Manual Transfer',
      });
    },
    onSuccess: (transaction) => {
      toast.success('Transaksi addon dibuat. Lanjutkan unggah bukti transfer.');
      setSelectedAddon(null);
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['membership-status'] });
      navigate(`/app/konfirmasi-pembayaran?code=${transaction.code}`);
    },
    onError: () => toast.error('Gagal membuat transaksi addon'),
  });

  if (isLoading || !data) {
    return <Skeleton className="h-72" />;
  }

  return (
    <section className="page-shell">
      <PageHeader
        title="Paket Membership"
        description="Pilih paket dengan fasilitas sesuai kebutuhan persiapanmu."
      />
      <Card>
        <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Status Membership</p>
            {status?.isActive ? (
              <div className="mt-2 space-y-1">
                <h3 className="text-2xl font-semibold text-slate-900">{status.packageName}</h3>
                <p className="text-sm text-slate-600">
                  Berlaku hingga{' '}
                  <span className="font-semibold">
                    {status.expiresAt ? new Date(status.expiresAt).toLocaleDateString('id-ID') : 'Tidak tersedia'}
                  </span>
                </p>
                <p className="text-sm text-slate-600">
                  Sisa Kuota Tryout:{' '}
                  <span className="font-semibold">
                    {status.tryoutQuota && status.tryoutQuota > 0
                      ? `${Math.max((status.tryoutQuota ?? 0) - (status.tryoutUsed ?? 0), 0)} dari ${status.tryoutQuota}`
                      : 'Tak terbatas'}
                  </span>
                </p>
              </div>
            ) : (
              <div className="mt-2 space-y-1">
                <h3 className="text-2xl font-semibold text-slate-900">Belum Ada Paket Aktif</h3>
                <p className="text-sm text-slate-600">Beli paket untuk membuka dashboard tryout dan materi.</p>
              </div>
            )}
          </div>
          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">Rekening Pembayaran</p>
            <p className="mt-2">Bank: {paymentInfo?.bankName ?? 'BCA'}</p>
            <p>No. Rekening: {paymentInfo?.accountNumber ?? '0000000000'}</p>
            <p>Atas Nama: {paymentInfo?.accountHolder ?? 'TACTICAL EDUCATION'}</p>
            <p className="mt-2 text-xs text-slate-500">Kirim sesuai nominal agar verifikasi lebih cepat.</p>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-6 md:grid-cols-3">
        {data.map((pkg) => (
          <Card key={pkg.id} className="relative">
            <CardContent className="space-y-3 p-6">
              {pkg.badgeLabel && (
                <span className="absolute right-4 top-4 rounded-full bg-brand-500 px-3 py-1 text-xs font-semibold text-white">
                  {pkg.badgeLabel}
                </span>
              )}
              <p className="text-xs uppercase tracking-widest text-slate-500">{pkg.category}</p>
              <h3 className="text-2xl font-bold text-slate-900">{pkg.name}</h3>
              <p className="text-sm text-slate-600">{pkg.description}</p>
              <p className="text-3xl font-bold text-slate-900">{formatCurrency(pkg.price)}</p>
              <ul className="space-y-2 text-sm text-slate-600">
                {(pkg.features ?? []).map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-brand-500" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
                <p>Durasi: <span className="font-semibold">{pkg.durationDays} hari</span></p>
                <p>Kuota Tryout: <span className="font-semibold">{pkg.tryoutQuota ?? 0}</span></p>
                <p>Modul Aktif: <span className="font-semibold">{pkg.materialCount ?? pkg.features?.length ?? 0}</span></p>
              </div>
              <Button
                onClick={() => {
                  if (status?.isActive && status.packageId === pkg.id) return;
                  setSelected(pkg);
                }}
                disabled={mutation.isPending || (status?.isActive && status.packageId === pkg.id)}
                variant={status?.isActive && status.packageId === pkg.id ? 'muted' : 'primary'}
                className="w-full"
              >
                {status?.isActive && status.packageId === pkg.id
                  ? 'Paket Anda Saat Ini'
                  : mutation.isPending
                    ? 'Memproses...'
                    : 'Beli Paket'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {status?.isActive && addons && addons.length > 0 && (
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-500">Paket Addon</p>
                <h3 className="text-xl font-bold text-slate-900">Tambah Kuota & Modul</h3>
                <p className="text-sm text-slate-600">Add-on ini berlaku untuk semua paket membership aktif.</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {addons.slice(0, 2).map((addon) => (
                <div key={addon.id} className="rounded-2xl border border-slate-100 p-4 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{addon.name}</p>
                      <p className="text-xs text-slate-500">Tambahan Tryout {addon.tryoutBonus ?? 0}x • Modul {addon.moduleBonus ?? 0}</p>
                    </div>
                    <span className="text-sm font-bold text-slate-900">{formatCurrency(addon.price)}</span>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{addon.description}</p>
                  <Button
                    variant="outline"
                    className="mt-4 w-full"
                    onClick={() => setSelectedAddon(addon)}
                    disabled={addonMutation.isPending}
                  >
                    {addonMutation.isPending ? 'Memproses...' : 'Beli Addon'}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Konfirmasi Pembelian</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-900">{selected.name}</h3>
            <p className="mt-1 text-sm text-slate-600">Transfer sesuai nominal {formatCurrency(selected.price)} ke rekening berikut:</p>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-semibold">Bank {paymentInfo?.bankName ?? 'BCA'}</p>
              <p>No. Rekening: <span className="font-mono text-lg">{paymentInfo?.accountNumber ?? '0000000000'}</span></p>
              <p>Atas Nama: {paymentInfo?.accountHolder ?? 'TACTICAL EDUCATION'}</p>
              <p className="mt-2 text-xs text-slate-500">Kirim sesuai nominal agar verifikasi cepat.</p>
            </div>
            <div className="mt-6 space-y-3">
              <Button className="w-full" disabled={mutation.isPending} onClick={() => mutation.mutate(selected.id)}>
                {mutation.isPending ? 'Membuat transaksi...' : 'Buat Transaksi & Lanjut' }
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSelected(null);
                  navigate('/app/konfirmasi-pembayaran');
                }}
              >
                Upload Bukti Pembayaran
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setSelected(null)}>
                Batalkan
              </Button>
            </div>
          </div>
        </div>
      )}

      {selectedAddon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Addon Kuota</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-900">{selectedAddon.name}</h3>
            <p className="mt-1 text-sm text-slate-600">Transfer sesuai nominal {formatCurrency(selectedAddon.price)} ke rekening berikut:</p>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-semibold">Bank {paymentInfo?.bankName ?? 'BCA'}</p>
              <p>No. Rekening: <span className="font-mono text-lg">{paymentInfo?.accountNumber ?? '0000000000'}</span></p>
              <p>Atas Nama: {paymentInfo?.accountHolder ?? 'TACTICAL EDUCATION'}</p>
              <p className="mt-2 text-xs text-slate-500">Kirim sesuai nominal agar verifikasi cepat.</p>
            </div>
            <div className="mt-6 space-y-3">
              <Button
                className="w-full"
                disabled={addonMutation.isPending}
                onClick={() => addonMutation.mutate(selectedAddon)}
              >
                {addonMutation.isPending ? 'Membuat transaksi...' : 'Buat Transaksi Addon'}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setSelectedAddon(null)}>
                Batalkan
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
