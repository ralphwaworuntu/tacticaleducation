import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, apiGet, apiPut } from '@/lib/api';
import type { CalculatorDetail, CalculatorThresholdConfig } from '@/types/calculator';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';

function cloneCalculator(data: CalculatorDetail): CalculatorDetail {
  return JSON.parse(JSON.stringify(data)) as CalculatorDetail;
}

export function AdminCalculatorsPage() {
  const queryClient = useQueryClient();
  const { accessToken } = useAuth();
  const calculatorsQuery = useQuery({
    queryKey: ['admin-calculators'],
    queryFn: () => apiGet<CalculatorDetail[]>('/admin/calculators'),
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftMap, setDraftMap] = useState<Record<string, CalculatorDetail>>({});
  const [isExporting, setIsExporting] = useState(false);

  const resolvedActiveId = useMemo(() => selectedId ?? calculatorsQuery.data?.[0]?.id ?? null, [selectedId, calculatorsQuery.data]);

  const activeCalculator = useMemo(() => {
    if (!resolvedActiveId) return null;
    return calculatorsQuery.data?.find((item) => item.id === resolvedActiveId) ?? null;
  }, [calculatorsQuery.data, resolvedActiveId]);

  const draft = useMemo(() => {
    if (!activeCalculator) return null;
    return draftMap[activeCalculator.id] ?? activeCalculator;
  }, [activeCalculator, draftMap]);

  const handleSelect = useCallback(
    (id: string) => {
      if (!calculatorsQuery.data) return;
      const calculator = calculatorsQuery.data.find((item) => item.id === id);
      if (calculator) {
        setSelectedId(id);
      }
    },
    [calculatorsQuery.data],
  );

  const updateDraft = useCallback(
    (updater: (current: CalculatorDetail) => CalculatorDetail) => {
      if (!activeCalculator) return;
      setDraftMap((prev) => {
        const base = prev[activeCalculator.id] ?? cloneCalculator(activeCalculator);
        const nextDraft = updater(cloneCalculator(base));
        return { ...prev, [activeCalculator.id]: nextDraft };
      });
    },
    [activeCalculator],
  );

  const updateMutation = useMutation({
    mutationFn: () => {
      if (!activeCalculator) throw new Error('Kalkulator tidak tersedia');
      const currentDraft = draftMap[activeCalculator.id] ?? activeCalculator;
      return apiPut<CalculatorDetail>(`/admin/calculators/${activeCalculator.id}`, { config: currentDraft.config });
    },
    onSuccess: (payload) => {
      setDraftMap((prev) => {
        const next = { ...prev };
        delete next[payload.id];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ['admin-calculators'] });
      toast.success('Konfigurasi kalkulator berhasil diperbarui');
    },
    onError: () => toast.error('Gagal menyimpan perubahan kalkulator'),
  });

  const handleGroupWeightChange = (groupKey: string, percent: number) => {
    const normalized = Number.isFinite(percent) ? percent : 0;
    updateDraft((prev) => ({
      ...prev,
      config: {
        ...prev.config,
        groups: prev.config.groups.map((group) =>
          group.key === groupKey ? { ...group, weight: Math.max(0, normalized) / 100 } : group,
        ),
      },
    }));
  };

  const ensureThresholdBlock = (inputKey: string) => {
    updateDraft((prev) => {
      const thresholds = prev.config.thresholds ?? [];
      if (thresholds.find((item) => item.inputKey === inputKey)) {
        return prev;
      }
      return {
        ...prev,
        config: {
          ...prev.config,
          thresholds: [...thresholds, { inputKey, comparison: 'HIGHER_BETTER', rows: [] }],
        },
      };
    });
  };

  const updateThreshold = (inputKey: string, updater: (config: CalculatorThresholdConfig) => CalculatorThresholdConfig) => {
    updateDraft((prev) => {
      const thresholds = prev.config.thresholds ?? [];
      if (!thresholds.find((item) => item.inputKey === inputKey)) {
        return prev;
      }
      return {
        ...prev,
        config: {
          ...prev.config,
          thresholds: thresholds.map((item) => (item.inputKey === inputKey ? updater(item) : item)),
        },
      };
    });
  };

  const weightTotal = useMemo(() => draft?.config.groups.reduce((acc, group) => acc + group.weight, 0) ?? 0, [draft]);

  const handleReset = useCallback(() => {
    if (!activeCalculator) return;
    setDraftMap((prev) => {
      if (!prev[activeCalculator.id]) {
        return prev;
      }
      const next = { ...prev };
      delete next[activeCalculator.id];
      return next;
    });
  }, [activeCalculator]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await api.get('/admin/calculators/export', {
        responseType: 'blob',
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'daftar-kalkulator.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error('Gagal mengunduh CSV kalkulator');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900">Pengaturan Kalkulator</h1>
          <p className="text-sm text-slate-600">Kelola bobot dan tabel konversi untuk seluruh kalkulator anggota.</p>
        </div>
        <Button type="button" variant="outline" onClick={handleExport} disabled={isExporting}>
          {isExporting ? 'Mengunduh...' : 'Download CSV'}
        </Button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">Daftar Kalkulator</p>
          <div className="flex flex-col gap-2">
            {calculatorsQuery.isLoading && <Skeleton className="h-12 w-full rounded-2xl" />}
            {calculatorsQuery.data?.map((calculator) => (
              <button
                key={calculator.id}
                type="button"
                onClick={() => handleSelect(calculator.id)}
                className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${calculator.id === resolvedActiveId ? 'border-brand-500 bg-brand-50 text-brand-600' : 'border-slate-200 text-slate-600 hover:border-brand-200'}`}
              >
                <span className="block text-xs uppercase text-slate-400">{calculator.categoryLabel}</span>
                {calculator.title}
              </button>
            ))}
          </div>
        </aside>

        <div className="space-y-6">
          {!draft && (
            <Card>
              <CardContent className="space-y-3 p-6">
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          )}

          {draft && (
            <Card>
              <CardContent className="space-y-6 p-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-brand-500">Informasi Kalkulator</p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900">{draft.title}</h2>
                  <Textarea value={draft.description} readOnly className="mt-3" />
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">Bobot</p>
                      <p className="text-sm text-slate-500">Total {Math.round(weightTotal * 100)}%</p>
                    </div>
                    {Math.abs(weightTotal - 1) > 0.01 && <span className="text-xs font-semibold text-red-500">Total bobot sebaiknya 100%</span>}
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {draft.config.groups.map((group) => (
                      <div key={group.key} className="rounded-2xl bg-white px-4 py-3 shadow-sm">
                        <p className="text-sm font-semibold text-slate-900">{group.label}</p>
                        <div className="mt-2 flex items-center gap-3">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={(group.weight * 100).toFixed(0)}
                            onChange={(event) => handleGroupWeightChange(group.key, Number(event.target.value))}
                          />
                          <span className="text-xs text-slate-500">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">Tabel Konversi</p>
                    {draft.config.thresholds?.length ? null : (
                      <span className="text-xs text-slate-400">Tidak ada konversi aktif</span>
                    )}
                  </div>
                  <div className="space-y-4">
                    {draft.config.inputs
                      .filter((input) => input.type !== 'select')
                      .map((input) => {
                        const threshold = draft.config.thresholds?.find((item) => item.inputKey === input.key);
                        return (
                          <div key={input.key} className="rounded-2xl border border-slate-100 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{input.label}</p>
                                <p className="text-xs text-slate-500">{threshold ? 'Konversi aktif' : 'Belum ada konversi'} </p>
                              </div>
                              {!threshold && (
                                <Button size="sm" variant="outline" onClick={() => ensureThresholdBlock(input.key)}>
                                  Tambah Tabel Skor
                                </Button>
                              )}
                            </div>
                            {threshold && (
                              <div className="mt-3 space-y-3">
                                <div className="flex flex-wrap items-center gap-3">
                                  <label className="text-xs font-semibold text-slate-500">Arah Penilaian</label>
                                  <select
                                    value={threshold.comparison}
                                    onChange={(event) =>
                                      updateThreshold(input.key, (current) => ({
                                        ...current,
                                        comparison: event.target.value as CalculatorThresholdConfig['comparison'],
                                      }))
                                    }
                                    className="rounded-2xl border border-slate-200 px-3 py-1 text-xs"
                                  >
                                    <option value="HIGHER_BETTER">HIGHER_BETTER</option>
                                    <option value="LOWER_BETTER">LOWER_BETTER</option>
                                  </select>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      updateThreshold(input.key, (current) => ({
                                        ...current,
                                        rows: [...current.rows, { value: 0, score: 0 }],
                                      }))
                                    }
                                  >
                                    + Baris
                                  </Button>
                                </div>
                                <div className="space-y-2">
                                  {threshold.rows.map((row, index) => (
                                    <div key={`${input.key}-${index}`} className="grid grid-cols-[repeat(3,minmax(0,1fr))_auto] gap-2">
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={row.value}
                                        onChange={(event) => {
                                          const parsed = Number(event.target.value);
                                          const safeValue = Number.isFinite(parsed) ? parsed : 0;
                                          updateThreshold(input.key, (current) => ({
                                            ...current,
                                            rows: current.rows.map((item, idx) => (idx === index ? { ...item, value: safeValue } : item)),
                                          }));
                                        }}
                                        placeholder="Nilai"
                                      />
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={row.score}
                                        onChange={(event) => {
                                          const parsed = Number(event.target.value);
                                          const safeScore = Number.isFinite(parsed) ? parsed : 0;
                                          updateThreshold(input.key, (current) => ({
                                            ...current,
                                            rows: current.rows.map((item, idx) => (idx === index ? { ...item, score: safeScore } : item)),
                                          }));
                                        }}
                                        placeholder="Skor"
                                      />
                                      <div className="flex items-center text-xs text-slate-400">Row {index + 1}</div>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() =>
                                          updateThreshold(input.key, (current) => ({
                                            ...current,
                                            rows: current.rows.filter((_, idx) => idx !== index),
                                          }))
                                        }
                                      >
                                        Hapus
                                      </Button>
                                    </div>
                                  ))}
                                  {!threshold.rows.length && <p className="text-xs text-slate-500">Belum ada baris skor</p>}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button type="button" disabled={updateMutation.isPending || !draft} onClick={() => draft && updateMutation.mutate()}>
                    {updateMutation.isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
                  </Button>
                  <Button type="button" variant="ghost" disabled={updateMutation.isPending} onClick={handleReset}>
                    Reset
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
}
