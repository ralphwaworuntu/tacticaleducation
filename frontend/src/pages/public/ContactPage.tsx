import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiPost } from '@/lib/api';
import { useContactConfig } from '@/hooks/useContactConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const contactSchema = z.object({
  name: z.string().min(3, 'Nama minimal 3 karakter'),
  email: z.string().email('Email tidak valid'),
  phone: z.string().optional(),
  message: z.string().min(10, 'Pesan minimal 10 karakter'),
});

type ContactFormValues = z.infer<typeof contactSchema>;

export function ContactPage() {
  const form = useForm<ContactFormValues>({ resolver: zodResolver(contactSchema) });
  const { data: contact } = useContactConfig();
  const mutation = useMutation({
    mutationFn: (values: ContactFormValues) => apiPost('/contact', values),
    onSuccess: () => {
      toast.success('Pesan terkirim, tim kami akan segera menghubungi Anda.');
      form.reset();
    },
    onError: () => toast.error('Gagal mengirim pesan, coba ulangi.'),
  });

  const whatsappNumber = contact?.whatsappConsult ?? contact?.whatsappPrimary ?? '6281234567890';
  const companyAddress = contact?.companyAddress ?? 'Alamat belum diatur';
  const formattedWhatsApp = whatsappNumber.startsWith('+') ? whatsappNumber : `+${whatsappNumber}`;
  const whatsappHref = `https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}`;

  return (
    <section className="grid gap-8 md:grid-cols-2">
      <div>
        <p className="text-sm font-semibold text-brand-500">Hubungi Kami</p>
        <h1 className="mt-3 text-4xl font-bold text-slate-900">Konsultasi sekarang dengan mentor Tactical Education</h1>
        <p className="mt-4 text-slate-600">
          Kirimkan pertanyaan mengenai paket membership, jadwal kelas, atau cara menghubungkan dashboard ke sekolah anda.
        </p>
        <div className="mt-6 space-y-3 text-sm text-slate-600">
          <p>Alamat: {companyAddress}</p>
          <p>
            WhatsApp:{' '}
            <a href={whatsappHref} target="_blank" rel="noreferrer" className="text-brand-600">
              {formattedWhatsApp}
            </a>
          </p>
          <p>Email: {contact?.email ?? 'hallo@tacticaleducation.id'}</p>
        </div>
      </div>
      <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
        <div>
          <Input placeholder="Nama lengkap" {...form.register('name')} />
          {form.formState.errors.name && <p className="mt-1 text-xs text-red-500">{form.formState.errors.name.message}</p>}
        </div>
        <div>
          <Input type="email" placeholder="Email" {...form.register('email')} />
          {form.formState.errors.email && <p className="mt-1 text-xs text-red-500">{form.formState.errors.email.message}</p>}
        </div>
        <div>
          <Input placeholder="Nomor WhatsApp" {...form.register('phone')} />
        </div>
        <div>
          <Textarea placeholder="Ceritakan kebutuhan atau pertanyaan Anda" {...form.register('message')} />
          {form.formState.errors.message && <p className="mt-1 text-xs text-red-500">{form.formState.errors.message.message}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending ? 'Mengirim...' : 'Kirim Pesan'}
        </Button>
      </form>
    </section>
  );
}
