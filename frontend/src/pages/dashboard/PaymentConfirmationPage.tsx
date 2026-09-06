import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { apiGet, apiPost } from '@/lib/api';
import type { MemberTransaction } from '@/types/exam';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/common/PageHeader';

const confirmSchema = z.object({
  code: z.string().min(4, 'Pilih kode transaksi'),
  description: z.string().max(300).optional(),
  proof: z
    .custom<FileList>((files) => files instanceof FileList && files.length > 0, 'Bukti pembayaran wajib diunggah')
    .refine((files) => files.length <= 1, 'Unggah satu file saja'),
});

type ConfirmValues = z.infer<typeof confirmSchema>;

export function PaymentConfirmationPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['transactions'], queryFn: () => apiGet<MemberTransaction[]>('/commerce/transactions') });
  const list = (data ?? []).filter((trx) => trx.status !== 'PAID');
  const [fileName, setFileName] = useState('');

  const form = useForm<ConfirmValues>({
    resolver: zodResolver(confirmSchema),
    defaultValues: { code: params.get('code') ?? '', description: '' },
  });
  const proofField = form.register('proof');

  const mutation = useMutation({
    mutationFn: ({ code, payload }: { code: string; payload: FormData }) =>
      apiPost(`/commerce/transactions/${code}/confirm`, payload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    onSuccess: () => {
      toast.success('Bukti pembayaran terkirim. Tim admin akan segera mengecek.');
      form.reset({ code: '', description: '' } as Partial<ConfirmValues>);
      form.resetField('proof');
      setFileName('');
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      navigate('/app/riwayat-transaksi');
    },
    onError: () => toast.error('Gagal mengirim bukti pembayaran'),
  });

  if (isLoading) {
    return <Skeleton className="h-72" />;
  }

  return (
    <section className="page-shell">
      <PageHeader
        title="Konfirmasi Pembayaran"
        description="Unggah file bukti transfer (JPG, PNG, WEBP, atau PDF maks. 5MB). Sistem akan menyimpan otomatis berdasarkan nama member."
      />

      <form
        className="space-y-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm"
        onSubmit={form.handleSubmit((values) => {
          const file = values.proof.item(0);
          if (!file) {
            toast.error('Bukti pembayaran wajib diunggah');
            return;
          }
          const formData = new FormData();
          formData.append('proof', file);
          if (values.description) {
            formData.append('description', values.description);
          }
          mutation.mutate({ code: values.code, payload: formData });
        })}
      >
        <div>
          <label className="text-xs font-semibold uppercase text-slate-500">Kode Transaksi</label>
          <select
            className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            {...form.register('code')}
          >
            <option value="">Pilih kode transaksi</option>
            {list.map((trx) => (
              <option key={trx.id} value={trx.code}>
                {trx.code} • {trx.type === 'ADDON' ? `Addon ${trx.addon?.name ?? ''}` : trx.package.name} ({trx.status})
              </option>
            ))}
          </select>
          {form.formState.errors.code && <p className="mt-1 text-xs text-red-500">{form.formState.errors.code.message}</p>}
        </div>

        <div>
          <label className="text-xs font-semibold uppercase text-slate-500">File Bukti Pembayaran</label>
          <Input
            type="file"
            accept="image/*,application/pdf"
            className="mt-2"
            {...proofField}
            onChange={(event) => {
              proofField.onChange(event);
              setFileName(event.target.files?.[0]?.name ?? '');
            }}
          />
          {fileName && <p className="mt-2 text-xs text-slate-500">File terpilih: {fileName}</p>}
          {form.formState.errors.proof && <p className="mt-1 text-xs text-red-500">{form.formState.errors.proof.message as string}</p>}
        </div>

        <div>
          <label className="text-xs font-semibold uppercase text-slate-500">Catatan Tambahan</label>
          <Textarea className="mt-2" rows={4} placeholder="Tulis nama pengirim / bank" {...form.register('description')} />
        </div>

        <Button type="submit" className="w-full" disabled={mutation.isPending || list.length === 0}>
          {mutation.isPending ? 'Mengunggah...' : 'Kirim Konfirmasi'}
        </Button>
        {list.length === 0 && <p className="text-xs text-slate-500">Tidak ada transaksi pending untuk dikonfirmasi.</p>}
      </form>
    </section>
  );
}
