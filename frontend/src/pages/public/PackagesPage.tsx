import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiGet } from '@/lib/api';
import type { MembershipPackage } from '@/types/exam';
import { formatCurrency } from '@/utils/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/common/PageHeader';

export function PackagesPage() {
  const { data, isLoading } = useQuery({ queryKey: ['landing-packages'], queryFn: () => apiGet<MembershipPackage[]>('/landing/packages') });

  if (isLoading || !data) {
    return <Skeleton className="h-96" />;
  }

  return (
    <section className="page-shell">
      <PageHeader
        className="mb-8 justify-center text-center [&>div:first-child]:mx-auto"
        eyebrow="Paket Bimbel"
        title="Kelas online & hybrid untuk semua jalur seleksi"
        description="Pilih paket sesuai fokus tes: POLRI dan TNI."
      />
      <div className="grid gap-6 md:grid-cols-3">
        {data.map((pkg) => (
          <Card key={pkg.id} className="relative overflow-hidden">
            <CardHeader title={pkg.name} subtitle={pkg.tagline || pkg.category} />
            <CardContent className="space-y-4">
              <p className="text-3xl font-bold text-slate-900">{formatCurrency(pkg.price)}</p>
              <p className="text-sm text-slate-600">Durasi {pkg.durationDays} hari • {pkg.description}</p>
              <ul className="space-y-2 text-sm text-slate-600">
                {(pkg.features ?? []).map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-brand-500" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button className="w-full" asChild>
                <Link to="/auth/register">Ambil Paket</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
