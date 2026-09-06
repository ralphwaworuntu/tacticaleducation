import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPut } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/common/PageHeader';
import { AdminPanel, FormField, FormSection, formSelectClassName } from '@/components/admin/ExamSetFormUi';
import { CERMAT_MODE_LABELS, type CermatConfig, type CermatMode } from '@/types/cermat';

type PsikoTryoutConfig = {
  breakSeconds: number;
  cermatMode: CermatMode;
};

export function AdminKecermatanPage() {
  const queryClient = useQueryClient();

  const { data: cermatConfig } = useQuery({
    queryKey: ['admin-cermat-config'],
    queryFn: () => apiGet<CermatConfig>('/admin/exams/cermat-config'),
  });

  const { data: psikoConfig } = useQuery({
    queryKey: ['admin-psiko-tryout-config'],
    queryFn: () => apiGet<PsikoTryoutConfig>('/admin/tryouts/psiko-config'),
  });

  const cermatForm = useForm<CermatConfig>({
    defaultValues: { questionCount: 60, durationSeconds: 60, totalSessions: 10, breakSeconds: 5 },
  });

  const psikoForm = useForm<PsikoTryoutConfig>({
    defaultValues: { breakSeconds: 5, cermatMode: 'NUMBER' },
  });

  const saveCermatConfig = useMutation({
    mutationFn: (values: CermatConfig) => apiPut('/admin/exams/cermat-config', values),
    onSuccess: () => {
      toast.success('Pengaturan modul kecermatan disimpan');
      queryClient.invalidateQueries({ queryKey: ['admin-cermat-config'] });
      queryClient.invalidateQueries({ queryKey: ['cermat-config'] });
    },
    onError: () => toast.error('Gagal menyimpan pengaturan modul kecermatan'),
  });

  const savePsikoConfig = useMutation({
    mutationFn: (values: PsikoTryoutConfig) => apiPut('/admin/tryouts/psiko-config', values),
    onSuccess: () => {
      toast.success('Pengaturan integrasi PSIKO disimpan');
      queryClient.invalidateQueries({ queryKey: ['admin-psiko-tryout-config'] });
    },
    onError: () => toast.error('Gagal menyimpan pengaturan integrasi PSIKO'),
  });

  useEffect(() => {
    if (cermatConfig) {
      cermatForm.reset(cermatConfig);
    }
  }, [cermatConfig, cermatForm]);

  useEffect(() => {
    if (psikoConfig) {
      psikoForm.reset(psikoConfig);
    }
  }, [psikoConfig, psikoForm]);

  const onSubmitCermat = cermatForm.handleSubmit((values) => saveCermatConfig.mutate(values));
  const onSubmitPsiko = psikoForm.handleSubmit((values) => savePsikoConfig.mutate(values));

  return (
    <section className="page-shell space-y-6">
      <PageHeader variant="panel"
        eyebrow="Admin"
        title="Kecermatan"
        description="Kelola pengaturan modul tes kecermatan dan integrasinya dengan alur tryout PSIKO."
      />

      <div className="rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 via-white to-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-brand-900">Dua area pengaturan</p>
        <ul className="mt-3 space-y-2 text-xs text-slate-700">
          <li>
            <strong className="text-slate-900">Modul kecermatan</strong> — jumlah soal, durasi, dan sesi saat member
            mengerjakan tes kecermatan langsung.
          </li>
          <li>
            <strong className="text-slate-900">Integrasi PSIKO</strong> — jeda antar sesi tryout POLRI/PSIKO dan jenis
            tes kecermatan yang muncul setelah paket PSIKO selesai.
          </li>
        </ul>
      </div>

      <AdminPanel
        step={1}
        title="Modul Tes Kecermatan"
        description="Berlaku untuk halaman Tes Kecermatan member — soal per sesi, durasi, total putaran, dan jeda istirahat."
      >
        <form className="space-y-5" onSubmit={onSubmitCermat}>
          <FormSection step={1} title="Parameter sesi" description="Atur isi dan tempo setiap putaran tes kecermatan.">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <FormField label="Jumlah soal per sesi" hint="Soal yang ditampilkan dalam satu putaran.">
                <Input type="number" min={1} {...cermatForm.register('questionCount', { valueAsNumber: true })} />
              </FormField>
              <FormField label="Durasi (detik)" hint="Waktu pengerjaan per sesi.">
                <Input type="number" min={1} {...cermatForm.register('durationSeconds', { valueAsNumber: true })} />
              </FormField>
              <FormField label="Total sesi" hint="Berapa kali sesi diulang.">
                <Input type="number" min={1} {...cermatForm.register('totalSessions', { valueAsNumber: true })} />
              </FormField>
              <FormField label="Jeda antar sesi (detik)" hint="Istirahat antara putaran kecermatan.">
                <Input type="number" min={0} {...cermatForm.register('breakSeconds', { valueAsNumber: true })} />
              </FormField>
            </div>
          </FormSection>
          <Button type="submit" disabled={saveCermatConfig.isPending}>
            {saveCermatConfig.isPending ? 'Menyimpan...' : 'Simpan Modul Kecermatan'}
          </Button>
        </form>
      </AdminPanel>

      <AdminPanel
        step={2}
        title="Integrasi Tryout PSIKO"
        description="Berlaku setelah member menyelesaikan paket sesi tryout POLRI / PSIKO — jeda antar sesi dan lanjutan kecermatan."
        meta="Hanya relevan untuk kategori POLRI dengan sub kategori PSIKO"
      >
        <form className="space-y-5" onSubmit={onSubmitPsiko}>
          <FormSection step={1} title="Alur sesi PSIKO" description="Pengaturan jeda dan tes kecermatan lanjutan.">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Jeda antar sesi tryout (detik)" hint="Istirahat antara sesi 1, 2, 3, dst.">
                <Input type="number" min={0} max={300} {...psikoForm.register('breakSeconds', { valueAsNumber: true })} />
              </FormField>
              <FormField label="Tes kecermatan lanjutan" hint="Mode soal setelah paket PSIKO selesai.">
                <select className={formSelectClassName} {...psikoForm.register('cermatMode')}>
                  {(Object.keys(CERMAT_MODE_LABELS) as CermatMode[]).map((mode) => (
                    <option key={mode} value={mode}>
                      {CERMAT_MODE_LABELS[mode]}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
          </FormSection>
          <Button type="submit" disabled={savePsikoConfig.isPending}>
            {savePsikoConfig.isPending ? 'Menyimpan...' : 'Simpan Integrasi PSIKO'}
          </Button>
        </form>
      </AdminPanel>
    </section>
  );
}
