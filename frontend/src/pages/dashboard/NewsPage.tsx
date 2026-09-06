import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { NewsArticle } from '@/types/dashboard';
import { formatDate } from '@/utils/format';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/PageHeader';

export function NewsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['news'], queryFn: () => apiGet<NewsArticle[]>('/dashboard/news') });
  const [tab, setTab] = useState<'NEWS' | 'INSIGHT'>('NEWS');

  if (isLoading || !data) {
    return <Skeleton className="h-72" />;
  }

  const filtered = data.filter((article) => article.kind === tab);

  return (
    <section className="page-shell">
      <PageHeader
        title="Berita & Insight"
        description="Update terbaru seputar seleksi TNI dan POLRI."
        action={
          <>
            <Button size="sm" variant={tab === 'NEWS' ? 'primary' : 'outline'} onClick={() => setTab('NEWS')}>
              Berita
            </Button>
            <Button size="sm" variant={tab === 'INSIGHT' ? 'primary' : 'outline'} onClick={() => setTab('INSIGHT')}>
              Insight
            </Button>
          </>
        }
      />

      {filtered.length === 0 && <p className="text-sm text-slate-500">Belum ada konten untuk kategori ini.</p>}

      {filtered.map((article) => (
        <article key={article.id} className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <p className="text-xs uppercase tracking-widest text-brand-500">{formatDate(article.published)}</p>
          <div className="mt-2 flex items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-900">{article.title}</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{article.kind}</span>
          </div>
          <p className="mt-2 text-slate-600">{article.excerpt}</p>
          <p className="mt-4 whitespace-pre-line text-sm text-slate-600">{article.content}</p>
        </article>
      ))}
    </section>
  );
}
