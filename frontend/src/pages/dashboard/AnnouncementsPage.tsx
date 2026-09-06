import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { Announcement } from '@/types/dashboard';
import { formatDate } from '@/utils/format';
import { getAssetUrl } from '@/lib/media';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/common/PageHeader';

export function AnnouncementsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['announcements'], queryFn: () => apiGet<Announcement[]>('/dashboard/announcements') });

  if (isLoading || !data) {
    return <Skeleton className="h-96" />;
  }

  return (
    <section className="page-shell">
      <PageHeader title="Pengumuman" />
      <div className="space-y-4">
        {data.map((item) => (
          <article key={item.id} className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <p className="text-xs uppercase tracking-widest text-brand-500">{formatDate(item.publishedAt)}</p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">{item.title}</h2>
            {item.imageUrl && (
              <img src={getAssetUrl(item.imageUrl)} alt={item.title} className="mt-4 w-full rounded-2xl object-cover" loading="lazy" />
            )}
            <p className="mt-2 text-slate-600">{item.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
