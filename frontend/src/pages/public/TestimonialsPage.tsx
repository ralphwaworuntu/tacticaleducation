import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';

type TestimonialsResponse = Array<{ id: string; name: string; message: string; role?: string }>;

export function TestimonialsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['testimonials'], queryFn: () => apiGet<TestimonialsResponse>('/landing/testimonials') });

  if (isLoading || !data) {
    return <Skeleton className="h-96" />;
  }

  return (
    <section>
      <h1 className="text-4xl font-bold text-slate-900">Testimoni dari Para Alumni Tactical Education</h1>
      <p className="mt-2 text-slate-600">Kumpulan cerita lolos AKPOL, SIPSS, AKMIL, hingga Bintara.</p>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {data.map((item) => (
          <div key={item.id} className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-600">“{item.message}”</p>
            <div className="mt-4">
              <p className="text-sm font-semibold text-slate-900">{item.name}</p>
              {item.role && <p className="text-xs text-slate-500">{item.role}</p>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
