import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { Material } from '@/types/exam';
import { formatDate } from '@/utils/format';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useMembershipStatus } from '@/hooks/useMembershipStatus';
import { MembershipRequired } from '@/components/dashboard/MembershipRequired';

export function MaterialsPage() {
  const [category, setCategory] = useState<string>('');
  const [type, setType] = useState<'PDF' | 'VIDEO' | 'LINK' | ''>('');
  const membership = useMembershipStatus();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['materials', category, type],
    queryFn: () => apiGet<Material[]>('/materials', { params: { category: category || undefined, type: type || undefined } }),
    enabled: Boolean(membership.data?.isActive),
  });

  const uniqueCategories = Array.from(new Set((data ?? []).map((item) => item.category))).filter(Boolean);
  const typeFilters: Array<typeof type> = ['', 'PDF', 'VIDEO', 'LINK'];

  if (membership.isLoading) {
    return <Skeleton className="h-72" />;
  }

  if (!membership.data?.isActive) {
    return <MembershipRequired status={membership.data} />;
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <label className="text-xs font-semibold uppercase text-slate-500">Kategori</label>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant={category === '' ? 'primary' : 'outline'} size="sm" onClick={() => setCategory('')}>
              Semua
            </Button>
            {uniqueCategories.map((cat) => (
              <Button key={cat} variant={category === cat ? 'primary' : 'outline'} size="sm" onClick={() => setCategory(cat)}>
                {cat}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase text-slate-500">Tipe</label>
          <div className="mt-2 flex gap-2">
            {typeFilters.map((filter) => (
              <Button key={filter || 'ALL'} variant={type === filter ? 'primary' : 'outline'} size="sm" onClick={() => setType(filter)}>
                {filter || 'Semua'}
              </Button>
            ))}
          </div>
        </div>
        <Button variant="ghost" onClick={() => refetch()}>
          Muat ulang
        </Button>
      </div>

      {isLoading && <Skeleton className="h-72" />}

      {!isLoading && data && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.map((material) => (
              <Card key={material.id} className="h-full rounded-3xl border border-slate-100 shadow-sm">
                <CardHeader className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[11px] uppercase tracking-widest">
                      {material.category}
                    </Badge>
                    <span className="text-xs text-slate-400">{formatDate(material.createdAt)}</span>
                  </div>
                  <CardTitle className="text-lg text-slate-900">{material.title}</CardTitle>
                  <p className="text-sm text-slate-600">{material.description}</p>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">
                    <span>Tipe Materi</span>
                    <span>{material.type}</span>
                  </div>
                  <Button asChild variant="outline">
                    <a href={material.fileUrl} target="_blank" rel="noreferrer">
                      Akses Materi
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          {data.length === 0 && (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
              Belum ada materi yang bisa ditampilkan. Hubungi admin jika Anda merasa ini adalah kesalahan.
            </div>
          )}
        </>
      )}
    </section>
  );
}
