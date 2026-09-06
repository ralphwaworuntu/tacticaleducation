import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiGet } from '@/lib/api';
import { formatDate } from '@/utils/format';
import { Skeleton } from '@/components/ui/skeleton';
import { useMembershipStatus } from '@/hooks/useMembershipStatus';
import { MembershipRequired } from '@/components/dashboard/MembershipRequired';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/PageHeader';

type TryoutHistoryItem = {
  id: string;
  score: number;
  createdAt: string;
  tryout: { name: string; sessionOrder?: number | null; subCategory: { name: string; category: { name: string } } };
};

export function TryoutHistoryPage() {
  const membership = useMembershipStatus();
  const { data, isLoading } = useQuery({
    queryKey: ['tryout-history'],
    queryFn: () => apiGet<TryoutHistoryItem[]>('/exams/tryouts-history'),
    enabled: Boolean(membership.data?.isActive),
  });

  if (membership.isLoading) {
    return <Skeleton className="h-72" />;
  }

  if (!membership.data?.isActive) {
    return <MembershipRequired status={membership.data} />;
  }

  if (membership.data?.allowTryout === false) {
    return (
      <section className="rounded-3xl border border-brand-200 bg-brand-50 p-6 text-sm text-brand-800">
        Paket membership kamu tidak mencakup akses latihan tryout. Hubungi admin untuk upgrade paket.
      </section>
    );
  }

  if (isLoading || !data) {
    return <Skeleton className="h-72" />;
  }

  return (
    <section className="page-shell">
      <PageHeader eyebrow="Tryout" title="Riwayat Tryout" />
      <div className="overflow-x-auto rounded-3xl border border-slate-100 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Judul</th>
              <th className="px-4 py-3">Kategori</th>
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">Skor</th>
              <th className="px-4 py-3">Pembahasan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {data.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 font-semibold text-slate-900">
                  {item.tryout.name}
                  {item.tryout.sessionOrder ? (
                    <span className="ml-2 rounded-full bg-brand-100 px-2 py-1 text-[10px] font-semibold text-brand-700">
                      Sesi {item.tryout.sessionOrder}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-slate-600">{item.tryout.subCategory.category.name}</td>
                <td className="px-4 py-3 text-slate-600">{formatDate(item.createdAt)}</td>
                <td className="px-4 py-3 font-bold text-brand-500">{Math.round(item.score)}</td>
                <td className="px-4 py-3">
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/app/latihan/tryout/review/${item.id}`}>Lihat</Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
