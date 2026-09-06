import { startTransition, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiPost } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import type { AuthUser } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/common/PageHeader';

const verifySchema = z.object({
  token: z.string().min(6, 'Token minimal 6 karakter'),
});

type VerifyValues = z.infer<typeof verifySchema>;

type LocationState = {
  email?: string;
  verificationToken?: string;
};

export function VerifyEmailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const state = (location.state as LocationState) || {};
  const [email, setEmail] = useState(state.email ?? '');
  const form = useForm<VerifyValues>({ resolver: zodResolver(verifySchema), defaultValues: { token: state.verificationToken ?? '' } });

  useEffect(() => {
    if (state.verificationToken) {
      form.setValue('token', state.verificationToken);
    }
    if (state.email) {
      startTransition(() => setEmail(state.email as string));
    }
  }, [state.verificationToken, state.email, form]);

  const verifyMutation = useMutation({
    mutationFn: (values: VerifyValues) =>
      apiPost<{ user: AuthUser; accessToken: string; refreshToken: string }>('/auth/verify-email', values),
    onSuccess: (payload) => {
      setSession(payload);
      toast.success('Email berhasil diverifikasi. Selamat datang!');
      const target = payload.user.role === 'ADMIN' ? '/admin' : '/app';
      navigate(target, { replace: true });
    },
    onError: () => toast.error('Token verifikasi tidak valid.'),
  });

  const resendMutation = useMutation({
    mutationFn: () => apiPost<{ verificationToken: string }>('/auth/resend-verification', { email }),
    onSuccess: (payload) => {
      toast.success('Token baru dikirim.');
      form.setValue('token', payload.verificationToken);
    },
    onError: () => toast.error('Gagal mengirim ulang token'),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verifikasi Email"
        description={`Masukkan token verifikasi yang kami kirim ke email ${email || 'anda'}.`}
      />

      <form className="space-y-4" onSubmit={form.handleSubmit((values) => verifyMutation.mutate(values))}>
        <div>
          <Input placeholder="Token verifikasi" {...form.register('token')} />
          {form.formState.errors.token && <p className="mt-1 text-xs text-red-500">{form.formState.errors.token.message}</p>}
        </div>
        <Button type="submit" className="w-full" isLoading={verifyMutation.isPending}>
          Verifikasi & Masuk
        </Button>
      </form>

      <div className="rounded-2xl bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-900">Belum menerima email?</p>
        <p className="mt-1 text-xs text-slate-500">Pastikan email benar lalu kirim ulang token.</p>
        <Input
          className="mt-3"
          type="email"
          placeholder="Email terdaftar"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <Button
          variant="outline"
          className="mt-3 w-full"
          onClick={() => resendMutation.mutate()}
          disabled={!email}
          isLoading={resendMutation.isPending}
        >
          Kirim Ulang Token
        </Button>
      </div>
    </div>
  );
}
