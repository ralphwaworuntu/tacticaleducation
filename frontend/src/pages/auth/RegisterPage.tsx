import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { apiPost } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/common/PageHeader';

const numberField = z.preprocess(
  (value) => {
    if (value === '' || value === null || value === undefined) return undefined;
    if (typeof value === 'number' && Number.isNaN(value)) return undefined;
    const numeric = typeof value === 'number' ? value : Number(value);
    return Number.isNaN(numeric) ? undefined : numeric;
  },
  z.number().int().positive('Wajib diisi'),
);

const registerSchema = z.object({
  name: z.string().min(3, 'Nama minimal 3 karakter'),
  email: z.string().email('Email tidak valid'),
  phone: z.string().min(9, 'Nomor tidak valid'),
  password: z.string().min(8, 'Minimal 8 karakter'),
  nationalId: z.string().min(6, 'Nomor KTP/KK tidak valid'),
  address: z.string().min(5, 'Alamat domisili wajib diisi'),
  heightCm: numberField,
  weightKg: numberField,
  parentName: z.string().min(3, 'Nama orang tua/wali wajib diisi'),
  parentPhone: z.string().min(9, 'Nomor WA orang tua/wali wajib diisi'),
  parentOccupation: z.string().min(2, 'Pekerjaan orang tua/wali wajib diisi'),
  parentAddress: z.string().min(5, 'Alamat orang tua/wali wajib diisi'),
  healthIssues: z.string().min(3, 'Masalah kesehatan wajib diisi (isi "Tidak ada" jika kosong)'),
  referralCode: z.string().optional(),
});

type RegisterValues = z.input<typeof registerSchema>;

export function RegisterPage() {
  const form = useForm<RegisterValues>({ resolver: zodResolver(registerSchema), defaultValues: { referralCode: '' } });
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  const steps = useMemo(
    () =>
      [
        {
          title: 'Data Pribadi',
          fields: ['name', 'email', 'phone', 'nationalId', 'address'],
        },
        {
          title: 'Data Orang Tua',
          fields: ['parentName', 'parentPhone', 'parentOccupation', 'parentAddress'],
        },
        {
          title: 'Informasi Tambahan',
          fields: ['heightCm', 'weightKg', 'healthIssues', 'password', 'referralCode'],
        },
      ] satisfies Array<{ title: string; fields: Array<keyof RegisterValues> }>,
    [],
  );
  const totalSteps = steps.length;
  const progressPercent = Math.round(((step + 1) / totalSteps) * 100);
  const showError = (field: keyof RegisterValues) =>
    Boolean(form.formState.errors[field] && (form.formState.touchedFields[field] || form.formState.isSubmitted));
  const numberInputOptions = {
    setValueAs: (value: string) => {
      if (value === '' || value === null || value === undefined) return undefined;
      const numeric = Number(value);
      return Number.isNaN(numeric) ? undefined : numeric;
    },
  };

  useEffect(() => {
    const fields = steps[step]?.fields ?? [];
    form.clearErrors(fields);
  }, [form, step, steps]);

  const handleNext = async () => {
    const fields = steps[step]?.fields ?? [];
    const isValid = await form.trigger(fields, { shouldFocus: true });
    if (isValid) {
      const upcomingFields = steps
        .slice(step + 1)
        .flatMap((item) => item.fields) as (keyof RegisterValues)[];
      if (upcomingFields.length) {
        form.clearErrors(upcomingFields);
      }
      setStep((prev) => Math.min(prev + 1, totalSteps - 1));
    }
  };

  const handleBack = () => {
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const mutation = useMutation({
    mutationFn: (values: RegisterValues) =>
      apiPost<{ email: string; verificationToken: string }>('/auth/register', registerSchema.parse(values)),
    onSuccess: (payload) => {
      toast.success('Registrasi berhasil! Silakan verifikasi email kamu.');
      navigate('/auth/verify', { state: { email: payload.email, verificationToken: payload.verificationToken } });
    },
    onError: () => toast.error('Gagal mendaftar, silakan coba lagi.'),
  });

  return (
    <div className="space-y-6">
      <button type="button" onClick={() => navigate('/')} className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Kembali ke Beranda
      </button>
      <PageHeader
        title="Daftar Member Tactical Education"
        description="Langsung nikmati akses dashboard tryout & materi premium."
      />
      <div className="space-y-4">
        <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest text-slate-400">
            <span>Step {step + 1} dari {totalSteps}</span>
            <span>{steps[step]?.title}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
        <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
          {step === 0 && (
            <>
              <div>
                <Input placeholder="Nama lengkap" {...form.register('name')} />
                {form.formState.errors.name && <p className="mt-1 text-xs text-red-500">{form.formState.errors.name.message}</p>}
              </div>
              <div>
                <Input placeholder="Email" type="email" {...form.register('email')} />
                {form.formState.errors.email && <p className="mt-1 text-xs text-red-500">{form.formState.errors.email.message}</p>}
              </div>
              <div>
                <Input placeholder="Nomor WhatsApp" {...form.register('phone')} />
                {form.formState.errors.phone && <p className="mt-1 text-xs text-red-500">{form.formState.errors.phone.message}</p>}
              </div>
              <div>
                <Input placeholder="Nomor KTP/KK" {...form.register('nationalId')} />
                {form.formState.errors.nationalId && <p className="mt-1 text-xs text-red-500">{form.formState.errors.nationalId.message}</p>}
              </div>
              <div>
                <Textarea placeholder="Alamat domisili" {...form.register('address')} />
                {form.formState.errors.address && <p className="mt-1 text-xs text-red-500">{form.formState.errors.address.message}</p>}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <div>
                <Input placeholder="Nama Ayah/Ibu/Wali" {...form.register('parentName')} />
                {form.formState.errors.parentName && <p className="mt-1 text-xs text-red-500">{form.formState.errors.parentName.message}</p>}
              </div>
              <div>
                <Input placeholder="Nomor Telp/WA Ayah/Ibu/Wali" {...form.register('parentPhone')} />
                {form.formState.errors.parentPhone && <p className="mt-1 text-xs text-red-500">{form.formState.errors.parentPhone.message}</p>}
              </div>
              <div>
                <Input placeholder="Pekerjaan Ayah/Ibu/Wali" {...form.register('parentOccupation')} />
                {form.formState.errors.parentOccupation && <p className="mt-1 text-xs text-red-500">{form.formState.errors.parentOccupation.message}</p>}
              </div>
              <div>
                <Textarea placeholder="Alamat Ayah/Ibu/Wali" {...form.register('parentAddress')} />
                {form.formState.errors.parentAddress && <p className="mt-1 text-xs text-red-500">{form.formState.errors.parentAddress.message}</p>}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Input placeholder="Tinggi badan (cm)" type="number" {...form.register('heightCm', numberInputOptions)} />
                  {showError('heightCm') && (
                    <p className="mt-1 text-xs text-red-500">{form.formState.errors.heightCm?.message}</p>
                  )}
                </div>
                <div>
                  <Input placeholder="Berat badan (kg)" type="number" {...form.register('weightKg', numberInputOptions)} />
                  {showError('weightKg') && (
                    <p className="mt-1 text-xs text-red-500">{form.formState.errors.weightKg?.message}</p>
                  )}
                </div>
              </div>
              <div>
                <Textarea placeholder="Masalah kesehatan (isi Tidak ada jika kosong)" {...form.register('healthIssues')} />
                {showError('healthIssues') && (
                  <p className="mt-1 text-xs text-red-500">{form.formState.errors.healthIssues?.message}</p>
                )}
              </div>
              <div>
                <Input placeholder="Password" type="password" {...form.register('password')} />
                {form.formState.errors.password && <p className="mt-1 text-xs text-red-500">{form.formState.errors.password.message}</p>}
              </div>
              <div>
                <Input placeholder="Kode referral (opsional)" {...form.register('referralCode')} />
              </div>
            </>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button type="button" variant="ghost" onClick={handleBack} disabled={step === 0 || mutation.isPending}>
              Kembali
            </Button>
            {step < totalSteps - 1 ? (
              <Button type="button" onClick={handleNext} disabled={mutation.isPending}>
                Lanjut
              </Button>
            ) : (
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Memproses...' : 'Daftar & Verifikasi'}
              </Button>
            )}
          </div>
        </form>
      </div>
      <p className="text-center text-sm text-slate-500">
        Sudah punya akun?{' '}
        <Link to="/auth/login" className="font-semibold text-brand-600">
          Masuk di sini
        </Link>
      </p>
    </div>
  );
}
