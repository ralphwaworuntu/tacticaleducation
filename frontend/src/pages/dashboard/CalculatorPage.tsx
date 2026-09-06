import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPost } from '@/lib/api';
import type {
  CalculatorComputeResponse,
  CalculatorDetail,
  CalculatorSummary,
  CalculatorTreeNode,
} from '@/types/calculator';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { CalculatorResultModal } from '@/components/dashboard/CalculatorResultModal';
import { PageHeader } from '@/components/common/PageHeader';

type FormValues = Record<string, string>;

export function CalculatorPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [resultPayload, setResultPayload] = useState<CalculatorComputeResponse | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const form = useForm<FormValues>({ defaultValues: {} });

  const treeQuery = useQuery({
    queryKey: ['calculator-tree'],
    queryFn: () => apiGet<CalculatorTreeNode[]>('/calculators'),
  });

  const resolvedCategory = useMemo(() => selectedCategory ?? treeQuery.data?.[0]?.category.slug ?? null, [selectedCategory, treeQuery.data]);

  const currentCategory = useMemo(() => {
    if (!resolvedCategory) return null;
    return treeQuery.data?.find((category) => category.category.slug === resolvedCategory) ?? null;
  }, [resolvedCategory, treeQuery.data]);

  const resolvedSection = useMemo(() => {
    if (!currentCategory || !currentCategory.sections.length) {
      return null;
    }
    if (selectedSection && currentCategory.sections.some((section) => section.slug === selectedSection)) {
      return selectedSection;
    }
    return currentCategory.sections[0]?.slug ?? null;
  }, [currentCategory, selectedSection]);

  const availableCalculators: CalculatorSummary[] = useMemo(() => {
    if (!currentCategory) return [];
    if (resolvedSection) {
      const section = currentCategory.sections.find((item) => item.slug === resolvedSection);
      return section?.calculators ?? [];
    }
    return currentCategory.calculators;
  }, [currentCategory, resolvedSection]);

  const resolvedSlug = useMemo(() => {
    if (selectedSlug && availableCalculators.some((item) => item.slug === selectedSlug)) {
      return selectedSlug;
    }
    return availableCalculators[0]?.slug ?? null;
  }, [availableCalculators, selectedSlug]);

  const detailQuery = useQuery({
    queryKey: ['calculator-detail', resolvedSlug],
    queryFn: () => apiGet<CalculatorDetail>(`/calculators/${resolvedSlug}`),
    enabled: Boolean(resolvedSlug),
  });

  useEffect(() => {
    if (!detailQuery.data) return;
    const defaults = detailQuery.data.config.inputs.reduce<FormValues>((acc, input) => {
      acc[input.key] = '';
      return acc;
    }, {});
    form.reset(defaults);
  }, [detailQuery.data, form]);

  const computeMutation = useMutation({
    mutationFn: (values: Record<string, string | number>) => apiPost<CalculatorComputeResponse>(`/calculators/${resolvedSlug}/compute`, { values }),
    onSuccess: (payload) => {
      setResultPayload(payload);
      setResultOpen(true);
      toast.success('Perhitungan berhasil diselesaikan.');
    },
    onError: () => toast.error('Gagal menghitung nilai, pastikan semua data valid.'),
  });

  const handleCategoryChange = useCallback(
    (slug: string) => {
      setSelectedCategory(slug);
      setSelectedSection(null);
      setSelectedSlug(null);
    },
    [],
  );

  const handleSectionChange = useCallback((slug: string) => {
    setSelectedSection(slug);
    setSelectedSlug(null);
  }, []);

  const handleSelectCalculator = useCallback((slug: string) => {
    setSelectedSlug(slug);
  }, []);

  const onSubmit = form.handleSubmit((values) => {
    if (!detailQuery.data || !resolvedSlug) return;
    const payload = detailQuery.data.config.inputs.reduce<Record<string, string | number>>((acc, input) => {
      const raw = values[input.key];
      if (input.type === 'select') {
        acc[input.key] = raw ?? '';
      } else {
        const parsed = raw ? Number(raw) : 0;
        acc[input.key] = Number.isFinite(parsed) ? parsed : 0;
      }
      return acc;
    }, {});
    computeMutation.mutate(payload);
  });

  const detail = detailQuery.data;

  return (
    <section className="page-shell">
      <PageHeader
        title="Kalkulator"
        description="Kelola seluruh kebutuhan perhitungan nilai POLRI & TNI secara terstruktur."
      />

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">Kategori</p>
          <div className="flex flex-col gap-2">
            {treeQuery.isLoading && <Skeleton className="h-10 w-full rounded-2xl" />}
            {treeQuery.data?.map((node) => (
              <button
                key={node.category.slug}
                type="button"
                onClick={() => handleCategoryChange(node.category.slug)}
                className={`rounded-2xl border px-4 py-2 text-left text-sm font-semibold transition ${node.category.slug === resolvedCategory ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-slate-200 text-slate-600 hover:border-brand-200'}`}
              >
                {node.category.label}
              </button>
            ))}
          </div>
          {currentCategory?.sections.length ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">Sub Kategori</p>
              <div className="flex flex-col gap-2">
                {currentCategory.sections.map((section) => (
                  <button
                    key={section.slug}
                    type="button"
                    onClick={() => handleSectionChange(section.slug)}
                    className={`rounded-2xl border px-3 py-2 text-left text-xs font-semibold ${section.slug === resolvedSection ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-slate-200 text-slate-600 hover:border-brand-200'}`}
                  >
                    {section.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </aside>

        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            {availableCalculators.map((calculator) => (
                <Card key={calculator.slug} className={calculator.slug === resolvedSlug ? 'border-brand-400 shadow-[0_15px_45px_rgba(63,81,181,0.12)]' : ''}>
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Kalkulator</span>
                      {calculator.slug === resolvedSlug && <span className="rounded-full bg-brand-100 px-3 py-1 text-[11px] font-semibold text-brand-600">Dipilih</span>}
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">{calculator.title}</h3>
                  <p className="text-sm text-slate-600 line-clamp-3">{calculator.description}</p>
                    <Button variant={calculator.slug === resolvedSlug ? 'primary' : 'outline'} onClick={() => handleSelectCalculator(calculator.slug)}>
                      {calculator.slug === resolvedSlug ? 'Sedang Aktif' : 'Gunakan Kalkulator'}
                  </Button>
                </CardContent>
              </Card>
            ))}
            {!availableCalculators.length && <p className="text-sm text-slate-500">Belum ada kalkulator pada kategori ini.</p>}
          </div>

          <Card>
            <CardContent className="space-y-6 p-6">
              {!detail && detailQuery.isLoading && (
                <div className="space-y-3">
                  <Skeleton className="h-6 w-1/3" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              )}
              {detail && (
                <form className="space-y-6" onSubmit={onSubmit}>
                  <div>
                    <p className="text-xs uppercase tracking-[0.4em] text-brand-500">Form Input</p>
                    <h2 className="mt-2 text-2xl font-semibold text-slate-900">{detail.title}</h2>
                    <p className="text-sm text-slate-500">{detail.description}</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {detail.config.inputs.map((input) => (
                      <label key={input.key} className="space-y-2">
                        <span className="text-sm font-semibold text-slate-800">
                          {input.label}
                          {input.unit && <span className="text-xs font-normal text-slate-500"> ({input.unit})</span>}
                        </span>
                        {input.type === 'select' ? (
                          <select
                            {...form.register(input.key)}
                            className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-700 focus:border-brand-500 focus:outline-none"
                          >
                            <option value="">Pilih opsi</option>
                            {input.options?.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Input type="number" step="0.01" placeholder={input.placeholder ?? 'Masukkan nilai'} {...form.register(input.key)} />
                        )}
                        {input.helperText && <p className="text-xs text-slate-500">{input.helperText}</p>}
                      </label>
                    ))}
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">Rumus Bobot</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {detail.config.groups.map((group) => (
                        <div key={group.key} className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                          <p className="text-sm font-semibold text-slate-900">{group.label}</p>
                          <p className="text-xs text-slate-500">Bobot {(group.weight * 100).toFixed(0)}%</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="submit" disabled={computeMutation.isPending}>
                      {computeMutation.isPending ? 'Menghitung...' : 'Hitung Sekarang'}
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => detail && form.reset()}>
                      Reset Form
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <CalculatorResultModal open={resultOpen} payload={resultPayload ?? undefined} onClose={() => setResultOpen(false)} />
    </section>
  );
}
