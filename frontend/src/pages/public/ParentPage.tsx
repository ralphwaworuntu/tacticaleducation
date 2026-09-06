import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getAssetUrl } from '@/lib/media';
import { PageHeader } from '@/components/common/PageHeader';

type ParentProgress = {
  member: { name: string; avatarUrl?: string | null; joinedAt: string };
  membership?: { packageName?: string | null; activatedAt?: string | null; expiresAt?: string | null } | null;
  tryouts: Array<{ score: number | null; createdAt: string; tryout: { name: string } }>;
  practices: Array<{ score: number | null; createdAt: string; set: { title: string } }>;
  cermat: Array<{ correctCount: number; totalQuestions: number; createdAt: string }>;
};

export function ParentPage() {
  const [code, setCode] = useState('');
  const [data, setData] = useState<ParentProgress | null>(null);
  const mutation = useMutation({
    mutationFn: () => apiGet<ParentProgress>(`/landing/parent/${code}`),
    onSuccess: (payload) => setData(payload),
    onError: () => toast.error('Kode akses tidak ditemukan. Coba periksa kembali.'),
  });

  return (
    <section className="page-shell py-6">
      <div className="grid gap-8 lg:grid-cols-[1.1fr,0.9fr]">
        <div>
          <PageHeader
            eyebrow="Area Orang Tua"
            title="Pantau perkembangan anak secara real-time"
            description="Masukkan kode akses member untuk melihat ringkasan tryout, latihan soal, dan tes kecermatan."
          />
          <div className="mt-6 flex flex-wrap gap-3">
            <Input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Kode akses member"
              className="max-w-sm"
            />
            <Button onClick={() => mutation.mutate()} disabled={!code || mutation.isPending}>
              {mutation.isPending ? 'Memuat...' : 'Lihat Progress'}
            </Button>
          </div>
          {mutation.isPending && <Skeleton className="mt-6 h-40" />}
          {data && (
            <div className="mt-8 space-y-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 overflow-hidden rounded-2xl bg-slate-100">
                      {data.member.avatarUrl ? (
                        <img src={getAssetUrl(data.member.avatarUrl)} alt={data.member.name} className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div>
                      <p className="text-xl font-semibold text-slate-900">{data.member.name}</p>
                      <p className="text-sm text-slate-500">Bergabung {new Date(data.member.joinedAt).toLocaleDateString('id-ID')}</p>
                      <p className="text-sm text-slate-500">
                        Paket: {data.membership?.packageName ?? 'Belum aktif'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs uppercase text-slate-500">Tryout Terakhir</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">
                      {data.tryouts[0] ? `${data.tryouts[0].score ?? 0}%` : '-'}
                    </p>
                    <p className="text-xs text-slate-500">{data.tryouts[0]?.tryout.name ?? 'Belum ada'}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs uppercase text-slate-500">Latihan Terakhir</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">
                      {data.practices[0] ? `${data.practices[0].score ?? 0}%` : '-'}
                    </p>
                    <p className="text-xs text-slate-500">{data.practices[0]?.set.title ?? 'Belum ada'}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs uppercase text-slate-500">Tes Kecermatan</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">
                      {data.cermat[0] ? `${data.cermat[0].correctCount}/${data.cermat[0].totalQuestions}` : '-'}
                    </p>
                    <p className="text-xs text-slate-500">{data.cermat[0] ? 'Sesi terakhir' : 'Belum ada'}</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
        <div className="rounded-[32px] border border-slate-100 bg-slate-50 p-6">
          <h2 className="text-xl font-semibold text-slate-900">Tips untuk orang tua</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            <li>Periksa progres minimal 1x seminggu untuk menjaga konsistensi belajar.</li>
            <li>Dukung anak saat hasil latihan turun, fokus pada pembahasan dan materi.</li>
            <li>Gunakan hasil tryout untuk merancang jadwal belajar bersama mentor.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
