import * as Dialog from '@radix-ui/react-dialog';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { api, apiGet, apiPatch, apiPost } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import type { AuthUser } from '@/store/auth';

const profileSchema = z.object({
  name: z.string().min(3),
  phone: z.string().min(9),
  nationalId: z.string().min(6),
  address: z.string().min(5),
  heightCm: z.coerce.number().int().positive(),
  weightKg: z.coerce.number().int().positive(),
  parentName: z.string().min(3),
  parentPhone: z.string().min(9),
  parentOccupation: z.string().min(2),
  parentAddress: z.string().min(5),
  healthIssues: z.string().min(3),
});

type ProfileValues = z.input<typeof profileSchema>;

const passwordSchema = z
  .object({
    currentPassword: z.string().min(8, 'Minimal 8 karakter'),
    newPassword: z.string().min(8, 'Minimal 8 karakter'),
    confirmPassword: z.string().min(8, 'Minimal 8 karakter'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'Konfirmasi password tidak cocok',
    path: ['confirmPassword'],
  });

type PasswordValues = z.input<typeof passwordSchema>;

type ProfileResponse = {
  profile: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    avatarUrl?: string | null;
    nationalId?: string | null;
    address?: string | null;
    heightCm?: number | null;
    weightKg?: number | null;
    parentName?: string | null;
    parentPhone?: string | null;
    parentOccupation?: string | null;
    parentAddress?: string | null;
    healthIssues?: string | null;
  };
};

type AccountSettingsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AccountSettingsModal({ open, onOpenChange }: AccountSettingsModalProps) {
  const { updateUser, setSession } = useAuth();
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: '',
      phone: '',
      nationalId: '',
      address: '',
      heightCm: 0,
      weightKg: 0,
      parentName: '',
      parentPhone: '',
      parentOccupation: '',
      parentAddress: '',
      healthIssues: '',
    },
  });
  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const profileQuery = useQuery({
    queryKey: ['member-profile'],
    queryFn: () => apiGet<ProfileResponse>('/auth/me'),
    enabled: open,
  });

  useEffect(() => {
    if (!profileQuery.data) return;
    const profile = profileQuery.data.profile;
    form.reset({
      name: profile.name ?? '',
      phone: profile.phone ?? '',
      nationalId: profile.nationalId ?? '',
      address: profile.address ?? '',
      heightCm: profile.heightCm ?? 0,
      weightKg: profile.weightKg ?? 0,
      parentName: profile.parentName ?? '',
      parentPhone: profile.parentPhone ?? '',
      parentOccupation: profile.parentOccupation ?? '',
      parentAddress: profile.parentAddress ?? '',
      healthIssues: profile.healthIssues ?? '',
    });
  }, [form, profileQuery.data]);

  const updateMutation = useMutation({
    mutationFn: (values: ProfileValues) => apiPatch('/auth/me', profileSchema.parse(values)),
    onSuccess: () => {
      toast.success('Profil berhasil diperbarui');
      updateUser({ name: form.getValues('name'), phone: form.getValues('phone') });
      onOpenChange(false);
    },
    onError: () => toast.error('Gagal memperbarui profil'),
  });

  const passwordMutation = useMutation({
    mutationFn: (values: PasswordValues) =>
      apiPost<{ user: AuthUser; accessToken: string; refreshToken: string }>('/auth/password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }),
    onSuccess: (payload) => {
      setSession(payload);
      passwordForm.reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Password berhasil diperbarui');
    },
    onError: () => toast.error('Gagal memperbarui password'),
  });

  const avatarMutation = useMutation({
    mutationFn: (file: File) => {
      const data = new FormData();
      data.append('avatar', file);
      return api.post('/auth/avatar', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: (payload) => {
      updateUser({ avatarUrl: payload.data.data.avatarUrl });
      toast.success('Foto profil diperbarui');
    },
    onError: () => toast.error('Gagal mengunggah foto profil'),
  });

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[min(96vw,720px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
          <Dialog.Title className="text-2xl font-semibold text-slate-900">Pengaturan Akun</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-slate-500">
            Lengkapi data pribadi dan orang tua sesuai kebutuhan pendaftaran.
          </Dialog.Description>

          <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">Foto Profil</p>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="mt-2 block text-sm"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  avatarMutation.mutate(file);
                }
              }}
            />
          </div>

          <form className="mt-6 space-y-4" onSubmit={form.handleSubmit((values) => updateMutation.mutate(values))}>
            <div>
              <label htmlFor="account-name" className="mb-1 block text-sm font-medium text-slate-700">
                Nama lengkap
              </label>
              <Input id="account-name" placeholder="Nama lengkap" {...form.register('name')} />
            </div>
            <div>
              <label htmlFor="account-phone" className="mb-1 block text-sm font-medium text-slate-700">
                Nomor WhatsApp
              </label>
              <Input id="account-phone" placeholder="Nomor WhatsApp" {...form.register('phone')} />
            </div>
            <div>
              <label htmlFor="account-national-id" className="mb-1 block text-sm font-medium text-slate-700">
                Nomor KTP/KK
              </label>
              <Input id="account-national-id" placeholder="Nomor KTP/KK" {...form.register('nationalId')} />
            </div>
            <div>
              <label htmlFor="account-address" className="mb-1 block text-sm font-medium text-slate-700">
                Alamat domisili
              </label>
              <Textarea id="account-address" placeholder="Alamat domisili" {...form.register('address')} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="account-height" className="mb-1 block text-sm font-medium text-slate-700">
                  Tinggi badan (cm)
                </label>
                <Input
                  id="account-height"
                  placeholder="Tinggi badan (cm)"
                  type="number"
                  {...form.register('heightCm', { valueAsNumber: true })}
                />
              </div>
              <div>
                <label htmlFor="account-weight" className="mb-1 block text-sm font-medium text-slate-700">
                  Berat badan (kg)
                </label>
                <Input
                  id="account-weight"
                  placeholder="Berat badan (kg)"
                  type="number"
                  {...form.register('weightKg', { valueAsNumber: true })}
                />
              </div>
            </div>
            <div>
              <label htmlFor="account-parent-name" className="mb-1 block text-sm font-medium text-slate-700">
                Nama Ayah/Ibu/Wali
              </label>
              <Input id="account-parent-name" placeholder="Nama Ayah/Ibu/Wali" {...form.register('parentName')} />
            </div>
            <div>
              <label htmlFor="account-parent-phone" className="mb-1 block text-sm font-medium text-slate-700">
                Nomor Telp/WA Ayah/Ibu/Wali
              </label>
              <Input
                id="account-parent-phone"
                placeholder="Nomor Telp/WA Ayah/Ibu/Wali"
                {...form.register('parentPhone')}
              />
            </div>
            <div>
              <label htmlFor="account-parent-occupation" className="mb-1 block text-sm font-medium text-slate-700">
                Pekerjaan Ayah/Ibu/Wali
              </label>
              <Input
                id="account-parent-occupation"
                placeholder="Pekerjaan Ayah/Ibu/Wali"
                {...form.register('parentOccupation')}
              />
            </div>
            <div>
              <label htmlFor="account-parent-address" className="mb-1 block text-sm font-medium text-slate-700">
                Alamat Ayah/Ibu/Wali
              </label>
              <Textarea id="account-parent-address" placeholder="Alamat Ayah/Ibu/Wali" {...form.register('parentAddress')} />
            </div>
            <div>
              <label htmlFor="account-health-issues" className="mb-1 block text-sm font-medium text-slate-700">
                Masalah kesehatan
              </label>
              <Textarea
                id="account-health-issues"
                placeholder="Masalah kesehatan (isi Tidak ada jika kosong)"
                {...form.register('healthIssues')}
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
              </Button>
            </div>
          </form>

          <div className="mt-8 border-t border-slate-100 pt-6">
            <h3 className="text-lg font-semibold text-slate-900">Ubah Password</h3>
            <p className="mt-1 text-sm text-slate-500">Gunakan password baru minimal 8 karakter.</p>
            <form
              className="mt-4 space-y-4"
              onSubmit={passwordForm.handleSubmit((values) => passwordMutation.mutate(values))}
            >
              <div>
                <label htmlFor="account-current-password" className="mb-1 block text-sm font-medium text-slate-700">
                  Password lama
                </label>
                <Input
                  id="account-current-password"
                  type="password"
                  placeholder="Password lama"
                  {...passwordForm.register('currentPassword')}
                />
                {passwordForm.formState.errors.currentPassword && (
                  <p className="mt-1 text-xs text-red-500">{passwordForm.formState.errors.currentPassword.message}</p>
                )}
              </div>
              <div>
                <label htmlFor="account-new-password" className="mb-1 block text-sm font-medium text-slate-700">
                  Password baru
                </label>
                <Input
                  id="account-new-password"
                  type="password"
                  placeholder="Password baru"
                  {...passwordForm.register('newPassword')}
                />
                {passwordForm.formState.errors.newPassword && (
                  <p className="mt-1 text-xs text-red-500">{passwordForm.formState.errors.newPassword.message}</p>
                )}
              </div>
              <div>
                <label htmlFor="account-confirm-password" className="mb-1 block text-sm font-medium text-slate-700">
                  Konfirmasi password baru
                </label>
                <Input
                  id="account-confirm-password"
                  type="password"
                  placeholder="Ulangi password baru"
                  {...passwordForm.register('confirmPassword')}
                />
                {passwordForm.formState.errors.confirmPassword && (
                  <p className="mt-1 text-xs text-red-500">{passwordForm.formState.errors.confirmPassword.message}</p>
                )}
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={passwordMutation.isPending}>
                  {passwordMutation.isPending ? 'Menyimpan...' : 'Simpan Password'}
                </Button>
              </div>
            </form>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
