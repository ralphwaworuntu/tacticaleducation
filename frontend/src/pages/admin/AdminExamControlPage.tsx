import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPut } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useExamControlStatus } from '@/hooks/useExamControl';
import type { ExamBlockConfig } from '@/types/exam';
import type { PackageOption } from '@/types/landing';

type ExamControlForm = {
  enabled: boolean;
  targetAll: boolean;
  targetPackageIds: string[];
  tryoutQuota: number;
  examQuota: number;
  startAt: string;
  endAt: string;
};

type ExamControlPayload = {
  enabled: boolean;
  targetAll: boolean;
  targetPackageIds: string[];
  tryoutQuota: number;
  examQuota: number;
  startAt?: string | null;
  endAt?: string | null;
};

type ExamBlockForm = {
  practiceEnabled: boolean;
  tryoutEnabled: boolean;
  examEnabled: boolean;
};

export function AdminExamControlPage() {
  const queryClient = useQueryClient();
  const { data: control, isLoading } = useQuery({
    queryKey: ['admin-exam-control'],
    queryFn: () => apiGet<ExamControlPayload>('/admin/site/exam-control'),
  });
  const { data: blockConfig, isLoading: blockConfigLoading } = useQuery({
    queryKey: ['admin-exam-block-config'],
    queryFn: () => apiGet<ExamBlockConfig>('/admin/site/exam-block-config'),
  });
  const { data: packages } = useQuery({
    queryKey: ['admin-packages'],
    queryFn: () => apiGet<PackageOption[]>('/admin/packages'),
  });
  const examStatus = useExamControlStatus();
  const form = useForm<ExamControlForm>({
    defaultValues: {
      enabled: false,
      targetAll: true,
      targetPackageIds: [],
      tryoutQuota: 0,
      examQuota: 0,
      startAt: '',
      endAt: '',
    },
  });
  const blockForm = useForm<ExamBlockForm>({
    defaultValues: {
      practiceEnabled: true,
      tryoutEnabled: true,
      examEnabled: true,
    },
  });

  const toInputDateTime = (value?: string | null) => {
    if (!value) return '';
    const date = new Date(value);
    const pad = (num: number) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
      date.getHours(),
    )}:${pad(date.getMinutes())}`;
  };

  useEffect(() => {
    if (control) {
      form.reset({
        enabled: control.enabled,
        targetAll: control.targetAll,
        targetPackageIds: control.targetPackageIds ?? [],
        tryoutQuota: control.tryoutQuota,
        examQuota: control.examQuota,
        startAt: toInputDateTime(control.startAt),
        endAt: toInputDateTime(control.endAt),
      });
    }
  }, [control, form]);

  useEffect(() => {
    if (blockConfig) {
      blockForm.reset({
        practiceEnabled: blockConfig.practiceEnabled,
        tryoutEnabled: blockConfig.tryoutEnabled,
        examEnabled: blockConfig.examEnabled,
      });
    }
  }, [blockConfig, blockForm]);

  const saveControl = useMutation({
    mutationFn: (values: ExamControlForm) => apiPut('/admin/site/exam-control', values),
    onSuccess: () => {
      toast.success('Kontrol ujian diperbarui');
      queryClient.invalidateQueries({ queryKey: ['admin-exam-control'] });
      queryClient.invalidateQueries({ queryKey: ['exam-control-status'] });
    },
    onError: () => toast.error('Gagal menyimpan kontrol ujian'),
  });

  const saveBlockConfig = useMutation({
    mutationFn: (values: ExamBlockForm) => apiPut('/admin/site/exam-block-config', values),
    onSuccess: () => {
      toast.success('Pengaturan blokir ujian diperbarui');
      queryClient.invalidateQueries({ queryKey: ['admin-exam-block-config'] });
      queryClient.invalidateQueries({ queryKey: ['exam-block-config', '/exams'] });
      queryClient.invalidateQueries({ queryKey: ['exam-block-config', '/ujian'] });
    },
    onError: () => toast.error('Gagal menyimpan pengaturan blokir'),
  });

  const onSubmit = form.handleSubmit((values) => saveControl.mutate(values));
  const onSubmitBlockConfig = blockForm.handleSubmit((values) => saveBlockConfig.mutate(values));
  const targetAll = Boolean(useWatch({ control: form.control, name: 'targetAll', defaultValue: true }));
  const targetPackageIds = (useWatch({
    control: form.control,
    name: 'targetPackageIds',
    defaultValue: [],
  }) ?? []) as string[];

  if (isLoading || blockConfigLoading) {
    return <Skeleton className="h-72" />;
  }

  return (
    <section className="space-y-6">
      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">Blokir Ujian</p>
            <h3 className="text-2xl font-semibold text-slate-900">Aktifkan / nonaktifkan fitur blokir</h3>
            <p className="text-xs text-slate-500">
              Jika dimatikan, member tidak akan terblokir saat keluar dari fullscreen.
            </p>
          </div>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmitBlockConfig}>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
              <input type="checkbox" {...blockForm.register('practiceEnabled')} />
              Blokir Latihan Soal
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
              <input type="checkbox" {...blockForm.register('tryoutEnabled')} />
              Blokir Tryout
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
              <input type="checkbox" {...blockForm.register('examEnabled')} />
              Blokir Ujian
            </label>
            <div className="md:col-span-2">
              <Button type="submit" disabled={saveBlockConfig.isPending}>
                {saveBlockConfig.isPending ? 'Menyimpan...' : 'Simpan Pengaturan Blokir'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">Kontrol Ujian</p>
            <h3 className="text-2xl font-semibold text-slate-900">Kelola akses & kuota Ujian</h3>
          </div>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
              <input type="checkbox" {...form.register('enabled')} />
              Aktifkan section Ujian
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
              <input type="checkbox" {...form.register('targetAll')} />
              Berikan akses ke semua member
            </label>
            <div className="md:col-span-2 space-y-2">
              <p className="text-xs font-semibold text-slate-500">Paket yang dapat mengakses</p>
              <div className="grid gap-2 md:grid-cols-2">
                {packages?.map((pkg) => (
                  <label
                    key={pkg.id}
                    className="flex items-center gap-2 rounded-2xl border border-slate-100 bg-white px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={targetPackageIds.includes(pkg.id)}
                      disabled={targetAll}
                      onChange={(event) => {
                        const current = form.getValues('targetPackageIds');
                        const next = event.target.checked
                          ? [...current, pkg.id]
                          : current.filter((id) => id !== pkg.id);
                        form.setValue('targetPackageIds', next);
                      }}
                    />
                    {pkg.name}
                  </label>
                ))}
              </div>
              {targetAll && <p className="text-[11px] text-slate-500">Saat aktif, seluruh member otomatis mendapatkan akses.</p>}
            </div>
            <div className="md:col-span-2 grid gap-4 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid-cols-2">
              <p>Kuota Tryout</p>
              <p>Kuota Ujian Soal</p>
            </div>
            <Input
              className="mt-1"
              type="number"
              placeholder="Masukkan angka (0 = tidak terbatas)"
              {...form.register('tryoutQuota', { valueAsNumber: true })}
            />
            <Input
              className="mt-1"
              type="number"
              placeholder="Masukkan angka (0 = tidak terbatas)"
              {...form.register('examQuota', { valueAsNumber: true })}
            />
            <div className="md:col-span-2 grid gap-4 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid-cols-2">
              <p>Jadwal Mulai Ujian</p>
              <p>Jadwal Berakhir Ujian</p>
            </div>
            <Input
              className="mt-1"
              type="datetime-local"
              placeholder="Pilih tanggal & jam mulai"
              {...form.register('startAt')}
            />
            <Input
              className="mt-1"
              type="datetime-local"
              placeholder="Pilih tanggal & jam berakhir"
              {...form.register('endAt')}
            />
            <div className="md:col-span-2">
              <Button type="submit" disabled={saveControl.isPending}>
                {saveControl.isPending ? 'Menyimpan...' : 'Simpan Kontrol Ujian'}
              </Button>
            </div>
          </form>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">Status saat ini</p>
            {examStatus.data ? (
              <ul className="mt-2 space-y-1">
                <li>Section aktif: {examStatus.data.enabled ? 'Ya' : 'Tidak'}</li>
                <li>Akses member: {examStatus.data.allowed ? 'Diizinkan' : 'Terbatas'}</li>
                <li>
                  Tryout digunakan: {examStatus.data.tryoutsUsed}/
                  {examStatus.data.tryoutQuota === 0 ? 'Tidak terbatas' : examStatus.data.tryoutQuota}
                </li>
                <li>
                  Ujian soal digunakan: {examStatus.data.examsUsed}/
                  {examStatus.data.examQuota === 0 ? 'Tidak terbatas' : examStatus.data.examQuota}
                </li>
                {examStatus.data.startAt && <li>Mulai: {new Date(examStatus.data.startAt).toLocaleString('id-ID')}</li>}
                {examStatus.data.endAt && <li>Berakhir: {new Date(examStatus.data.endAt).toLocaleString('id-ID')}</li>}
              </ul>
            ) : (
              <p className="text-slate-500">Memuat status ujian...</p>
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">Kelola Kelas Gratis</p>
            <h3 className="text-2xl font-semibold text-slate-900">Atur kelas/soal yang diberikan gratis</h3>
            <p className="text-sm text-slate-500">Konten dan aksi akan ditambahkan di tahap berikutnya.</p>
          </div>
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            Tempat kosong untuk konfigurasi kelas gratis.
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
