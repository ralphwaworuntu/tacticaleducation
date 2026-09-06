import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { API_BASE_ORIGIN, apiDelete, apiGet, apiPatch, apiPost, apiPut } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import type { AddonPackage, AdminTransaction, Material, MembershipPackage, PaymentSetting } from '@/types/exam';
import { PageHeader } from '@/components/common/PageHeader';

type PackageFormValues = {
  name: string;
  slug: string;
  category: string;
  tagline?: string;
  description: string;
  price: number;
  durationDays: number;
  badgeLabel?: string;
  featuresText: string;
  tryoutQuota: number;
  moduleQuota: number;
  allowTryout: boolean;
  allowPractice: boolean;
  allowCermat: boolean;
  materialIds: string[];
};

type AddonFormValues = {
  name: string;
  slug: string;
  description?: string;
  price: number;
  tryoutBonus: number;
  moduleBonus: number;
  materialIds: string[];
};

const statusOptions: AdminTransaction['status'][] = ['PENDING', 'PAID', 'REJECTED'];

const defaultPackageValues: PackageFormValues = {
  name: '',
  slug: '',
  category: '',
  tagline: '',
  description: '',
  price: 0,
  durationDays: 30,
  badgeLabel: '',
  featuresText: 'Tryout Online, Live Class',
  tryoutQuota: 10,
  moduleQuota: 10,
  allowTryout: true,
  allowPractice: true,
  allowCermat: true,
  materialIds: [],
};

const defaultAddonValues: AddonFormValues = {
  name: '',
  slug: '',
  description: '',
  price: 0,
  tryoutBonus: 0,
  moduleBonus: 0,
  materialIds: [],
};

export function AdminCommercePage() {
  const queryClient = useQueryClient();
  const { data: packagesData, isLoading: packagesLoading } = useQuery({
    queryKey: ['admin-packages'],
    queryFn: () => apiGet<MembershipPackage[]>('/admin/packages'),
  });
  const { data: materialsData } = useQuery({ queryKey: ['admin-materials'], queryFn: () => apiGet<Material[]>('/admin/materials') });
  const { data: addonsData, isLoading: addonsLoading } = useQuery({
    queryKey: ['admin-addons'],
    queryFn: () => apiGet<AddonPackage[]>('/admin/addons'),
  });
  const { data: transactionsData, isLoading: transactionsLoading } = useQuery({
    queryKey: ['admin-transactions'],
    queryFn: () => apiGet<AdminTransaction[]>('/admin/transactions'),
  });
  const { data: paymentSetting } = useQuery({
    queryKey: ['admin-payment-setting'],
    queryFn: () => apiGet<PaymentSetting>('/admin/payment-setting'),
  });

  const [editing, setEditing] = useState<MembershipPackage | null>(null);
  const [editingAddon, setEditingAddon] = useState<AddonPackage | null>(null);
  const packageForm = useForm<PackageFormValues>({ defaultValues: defaultPackageValues });
  const addonForm = useForm<AddonFormValues>({ defaultValues: defaultAddonValues });
  const paymentForm = useForm<PaymentSetting>({ defaultValues: { bankName: '', accountNumber: '', accountHolder: '' } });

  useEffect(() => {
    if (paymentSetting) {
      paymentForm.reset(paymentSetting);
    }
  }, [paymentSetting, paymentForm]);

  const savePackage = useMutation({
    mutationFn: (values: PackageFormValues) => {
      const payload = {
        ...values,
        features: values.featuresText
          .split(',')
          .map((feature) => feature.trim())
          .filter(Boolean),
        tryoutQuota: values.tryoutQuota,
        moduleQuota: values.moduleQuota,
        allowTryout: values.allowTryout,
        allowPractice: values.allowPractice,
        allowCermat: values.allowCermat,
        materialIds: values.materialIds,
      };
      if (editing) {
        return apiPut(`/admin/packages/${editing.id}`, payload);
      }
      return apiPost('/admin/packages', payload);
    },
    onSuccess: () => {
      toast.success('Paket berhasil disimpan');
      setEditing(null);
      packageForm.reset(defaultPackageValues);
      queryClient.invalidateQueries({ queryKey: ['admin-packages'] });
    },
    onError: () => toast.error('Gagal menyimpan paket'),
  });

  const deletePackage = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/packages/${id}`),
    onSuccess: () => {
      toast.success('Paket dihapus');
      queryClient.invalidateQueries({ queryKey: ['admin-packages'] });
    },
    onError: () => toast.error('Tidak dapat menghapus paket'),
  });

  const updateTransactionStatus = useMutation({
    mutationFn: (payload: { id: string; status: AdminTransaction['status'] }) =>
      apiPatch(`/admin/transactions/${payload.id}/status`, { status: payload.status }),
    onSuccess: () => {
      toast.success('Status transaksi diperbarui');
      queryClient.invalidateQueries({ queryKey: ['admin-transactions'] });
    },
    onError: () => toast.error('Gagal memperbarui status'),
  });

  const packages = packagesData ?? [];
  const transactions = transactionsData ?? [];
  const materials = materialsData ?? [];
  const addons = addonsData ?? [];

  const onSubmitPackage = packageForm.handleSubmit((values) => savePackage.mutate(values));

  const togglePackageMaterial = (id: string) => {
    const current = packageForm.getValues('materialIds');
    const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
    packageForm.setValue('materialIds', next, { shouldDirty: true });
  };

  const toggleAddonMaterial = (id: string) => {
    const current = addonForm.getValues('materialIds');
    const next = current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
    addonForm.setValue('materialIds', next, { shouldDirty: true });
  };

  const saveAddon = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: AddonFormValues }) => {
      const requestPayload = payload;
      if (id) {
        return apiPut(`/admin/addons/${id}`, requestPayload);
      }
      return apiPost('/admin/addons', requestPayload);
    },
    onSuccess: () => {
      toast.success('Addon berhasil disimpan');
      setEditingAddon(null);
      addonForm.reset(defaultAddonValues);
      queryClient.invalidateQueries({ queryKey: ['admin-addons'] });
    },
    onError: () => toast.error('Gagal menyimpan addon'),
  });

  const deleteAddon = useMutation({
    mutationFn: (id: string) => apiDelete(`/admin/addons/${id}`),
    onSuccess: () => {
      toast.success('Addon dihapus');
      queryClient.invalidateQueries({ queryKey: ['admin-addons'] });
    },
    onError: () => toast.error('Tidak dapat menghapus addon'),
  });

  const savePaymentSetting = useMutation({
    mutationFn: (values: PaymentSetting) => apiPut('/admin/payment-setting', values),
    onSuccess: () => {
      toast.success('Rekening pembayaran diperbarui');
      queryClient.invalidateQueries({ queryKey: ['admin-payment-setting'] });
    },
    onError: () => toast.error('Gagal menyimpan pengaturan pembayaran'),
  });

  const onSubmitAddon = addonForm.handleSubmit((values) => {
    const payload = { ...values, materialIds: values.materialIds };
    if (editingAddon) {
      return saveAddon.mutate({ id: editingAddon.id, payload });
    }
    return saveAddon.mutate({ payload });
  });

  const onSubmitPaymentSetting = paymentForm.handleSubmit((values) => savePaymentSetting.mutate(values));

  const selectedPackageMaterials = useWatch({ control: packageForm.control, name: 'materialIds' }) ?? [];
  const selectedAddonMaterials = useWatch({ control: addonForm.control, name: 'materialIds' }) ?? [];

  return (
    <section className="page-shell">
      <PageHeader variant="panel"
        eyebrow="Admin"
        title="Paket Membership & Transaksi"
        description="Kelola paket berlangganan dan verifikasi pembayaran."
      />

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow-label">{editing ? 'Edit Paket' : 'Paket Baru'}</p>
              <h3 className="text-xl font-semibold text-slate-900">{editing ? editing.name : 'Form Paket'}</h3>
            </div>
            {editing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(null);
                  packageForm.reset(defaultPackageValues);
                }}
              >
                Batal
              </Button>
            )}
          </div>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={onSubmitPackage}>
            <Input placeholder="Nama Paket" {...packageForm.register('name')} />
            <Input placeholder="Slug" {...packageForm.register('slug')} />
            <Input placeholder="Kategori" {...packageForm.register('category')} />
            <Input placeholder="Tagline" {...packageForm.register('tagline')} />
            <Input type="number" placeholder="Harga" {...packageForm.register('price', { valueAsNumber: true })} />
            <Input type="number" placeholder="Durasi (hari)" {...packageForm.register('durationDays', { valueAsNumber: true })} />
            <Input placeholder="Badge" {...packageForm.register('badgeLabel')} />
            <Input placeholder="Fitur (pisahkan dengan koma)" {...packageForm.register('featuresText')} />
            <Input type="number" placeholder="Kuota Tryout" {...packageForm.register('tryoutQuota', { valueAsNumber: true })} />
            <Input type="number" placeholder="Jumlah Modul" {...packageForm.register('moduleQuota', { valueAsNumber: true })} />
            <div className="md:col-span-2 rounded-2xl border border-slate-100 p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Akses Fitur</p>
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
                <label className="flex items-center gap-2">
                  <input type="checkbox" {...packageForm.register('allowTryout')} className="h-4 w-4 rounded border-slate-300" />
                  <span>Latihan Tryout</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" {...packageForm.register('allowPractice')} className="h-4 w-4 rounded border-slate-300" />
                  <span>Latihan Soal</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" {...packageForm.register('allowCermat')} className="h-4 w-4 rounded border-slate-300" />
                  <span>Tes Kecermatan</span>
                </label>
              </div>
            </div>
            <Textarea className="md:col-span-2" placeholder="Deskripsi" {...packageForm.register('description')} />
            <div className="md:col-span-2">
              <p className="text-xs font-semibold uppercase text-slate-500">Pilih Modul</p>
              <div className="mt-2 grid gap-2 rounded-2xl border border-slate-100 p-4 md:grid-cols-2">
                {materials.map((material) => {
                  const checked = selectedPackageMaterials.includes(material.id);
                  return (
                    <label key={material.id} className="flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePackageMaterial(material.id)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      <span>{material.title}</span>
                    </label>
                  );
                })}
                {materials.length === 0 && <p className="text-sm text-slate-500">Belum ada modul.</p>}
              </div>
            </div>
            <Button type="submit" disabled={savePackage.isPending} className="md:col-span-2">
              {savePackage.isPending ? 'Menyimpan...' : editing ? 'Perbarui Paket' : 'Tambah Paket'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h3 className="text-xl font-semibold text-slate-900">Daftar Paket ({packages.length})</h3>
          {packagesLoading && <Skeleton className="h-48" />} 
          <div className="grid gap-3 md:grid-cols-2">
            {packages.map((pkg) => (
              <div key={pkg.id} className="rounded-2xl border border-slate-100 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{pkg.name}</p>
                    <p className="text-xs text-slate-500">
                      {pkg.category} • Rp {pkg.price.toLocaleString('id-ID')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditing(pkg);
                        packageForm.reset({
                          name: pkg.name,
                          slug: pkg.slug,
                          category: pkg.category,
                          tagline: pkg.tagline ?? '',
                          description: pkg.description,
                          price: pkg.price,
                          durationDays: pkg.durationDays,
                          badgeLabel: pkg.badgeLabel ?? '',
                          featuresText: (pkg.features ?? []).join(', '),
                          tryoutQuota: pkg.tryoutQuota ?? 0,
                          moduleQuota: pkg.moduleQuota ?? 0,
                          allowTryout: pkg.allowTryout ?? true,
                          allowPractice: pkg.allowPractice ?? true,
                          allowCermat: pkg.allowCermat ?? true,
                          materialIds: pkg.materialIds ?? [],
                        });
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deletePackage.mutate(pkg.id)}
                      disabled={deletePackage.isPending}
                    >
                      Hapus
                    </Button>
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate-600">{pkg.description}</p>
                <p className="text-xs text-slate-500">Kuota Tryout: {pkg.tryoutQuota ?? 0}</p>
                <p className="text-xs text-slate-500">Modul: {pkg.materialCount ?? pkg.materialIds?.length ?? 0}</p>
                <p className="text-xs text-slate-500">
                  Akses: {[
                    pkg.allowTryout !== false ? 'Tryout' : null,
                    pkg.allowPractice !== false ? 'Latihan' : null,
                    pkg.allowCermat !== false ? 'Kecermatan' : null,
                  ]
                    .filter(Boolean)
                    .join(', ') || '-'}
                </p>
                <p className="mt-1 text-xs text-slate-500">Fitur: {(pkg.features ?? []).join(', ')}</p>
              </div>
            ))}
            {!packagesLoading && packages.length === 0 && <p className="text-sm text-slate-500">Belum ada paket.</p>}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow-label">Addon Paket</p>
              <h3 className="text-xl font-semibold text-slate-900">Tambah Kuota & Modul</h3>
            </div>
            {editingAddon && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingAddon(null);
                  addonForm.reset(defaultAddonValues);
                }}
              >
                Batal
              </Button>
            )}
          </div>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={onSubmitAddon}>
            <Input placeholder="Nama Addon" {...addonForm.register('name')} />
            <Input placeholder="Slug" {...addonForm.register('slug')} />
            <Textarea className="md:col-span-2" placeholder="Deskripsi" {...addonForm.register('description')} />
            <Input type="number" placeholder="Harga" {...addonForm.register('price', { valueAsNumber: true })} />
            <Input type="number" placeholder="Bonus Tryout" {...addonForm.register('tryoutBonus', { valueAsNumber: true })} />
            <Input type="number" placeholder="Bonus Modul" {...addonForm.register('moduleBonus', { valueAsNumber: true })} />
            <div className="md:col-span-2">
              <p className="text-xs font-semibold uppercase text-slate-500">Tambahkan Modul</p>
              <div className="mt-2 grid gap-2 rounded-2xl border border-slate-100 p-4 md:grid-cols-2">
                {materials.map((material) => {
                  const checked = selectedAddonMaterials.includes(material.id);
                  return (
                    <label key={material.id} className="flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAddonMaterial(material.id)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      <span>{material.title}</span>
                    </label>
                  );
                })}
                {materials.length === 0 && <p className="text-sm text-slate-500">Belum ada modul.</p>}
              </div>
            </div>
            <Button type="submit" disabled={saveAddon.isPending} className="md:col-span-2">
              {saveAddon.isPending ? 'Menyimpan...' : editingAddon ? 'Perbarui Addon' : 'Tambah Addon'}
            </Button>
          </form>
          <div className="grid gap-3 md:grid-cols-2">
            {addonsLoading && <Skeleton className="h-32" />}
            {addons.map((addon) => (
              <div key={addon.id} className="rounded-2xl border border-slate-100 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900">{addon.name}</p>
                    <p className="text-xs text-slate-500">Rp {addon.price.toLocaleString('id-ID')}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingAddon(addon);
                        addonForm.reset({
                          name: addon.name,
                          slug: addon.slug,
                          description: addon.description ?? '',
                          price: addon.price,
                          tryoutBonus: addon.tryoutBonus ?? 0,
                          moduleBonus: addon.moduleBonus ?? 0,
                          materialIds: addon.materialIds ?? [],
                        });
                      }}
                    >
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteAddon.mutate(addon.id)} disabled={deleteAddon.isPending}>
                      Hapus
                    </Button>
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate-600">{addon.description}</p>
                <p className="text-xs text-slate-500">Bonus Tryout: {addon.tryoutBonus ?? 0}</p>
                <p className="text-xs text-slate-500">Bonus Modul: {addon.moduleBonus ?? 0}</p>
              </div>
            ))}
            {!addonsLoading && addons.length === 0 && <p className="text-sm text-slate-500">Belum ada addon.</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <p className="eyebrow-label">Rekening Pembayaran</p>
            <h3 className="text-xl font-semibold text-slate-900">Atur Bank Transfer</h3>
          </div>
          <form className="grid gap-3 md:grid-cols-3" onSubmit={onSubmitPaymentSetting}>
            <Input placeholder="Nama Bank" {...paymentForm.register('bankName')} />
            <Input placeholder="Nomor Rekening" {...paymentForm.register('accountNumber')} />
            <Input placeholder="Atas Nama" {...paymentForm.register('accountHolder')} />
            <Button type="submit" className="md:col-span-3" disabled={savePaymentSetting.isPending}>
              {savePaymentSetting.isPending ? 'Menyimpan...' : 'Simpan Pengaturan'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h3 className="text-xl font-semibold text-slate-900">Transaksi Terbaru ({transactions.length})</h3>
          {transactionsLoading && <Skeleton className="h-48" />}
          <div className="space-y-2">
            {transactions.map((trx) => (
              <div key={trx.id} className="rounded-2xl border border-slate-100 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{trx.code}</p>
                    <p className="text-xs text-slate-500">
                      {trx.type === 'ADDON' ? `Addon ${trx.addon?.name ?? ''}` : trx.package.name} • Rp {trx.amount.toLocaleString('id-ID')} • {trx.user.email}
                    </p>
                    {trx.proofUrl && (
                      <a
                        href={`${API_BASE_ORIGIN}${trx.proofUrl}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-brand-600 underline"
                      >
                        Lihat bukti transfer
                      </a>
                    )}
                  </div>
                  <select
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold"
                    value={trx.status}
                    onChange={(event) =>
                      updateTransactionStatus.mutate({ id: trx.id, status: event.target.value as AdminTransaction['status'] })
                    }
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
            {!transactionsLoading && transactions.length === 0 && <p className="text-sm text-slate-500">Belum ada transaksi.</p>}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
