import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import type { FAQ } from '@/types/dashboard';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/utils/cn';
import { PageHeader } from '@/components/common/PageHeader';

export function FAQPage() {
  const { data, isLoading } = useQuery({ queryKey: ['faq'], queryFn: () => apiGet<FAQ[]>('/dashboard/faq') });
  const [openId, setOpenId] = useState<string | null>(null);

  if (isLoading || !data) {
    return <Skeleton className="h-72" />;
  }

  return (
    <section className="page-shell">
      <PageHeader
        title="FAQ"
        description="Pertanyaan yang paling sering ditanyakan oleh member Tactical Education."
      />
      <div className="space-y-3">
        {data.map((item) => (
          <div key={item.id} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            <button
              className="flex w-full items-center justify-between text-left"
              onClick={() => setOpenId((prev) => (prev === item.id ? null : item.id))}
            >
              <span className="text-sm font-semibold text-slate-900">{item.question}</span>
              <span className="text-brand-500">{openId === item.id ? '-' : '+'}</span>
            </button>
            <p className={cn('mt-3 text-sm text-slate-600 transition-all', openId === item.id ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden')}>
              {item.answer}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
