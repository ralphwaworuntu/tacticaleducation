import { Button } from '@/components/ui/button';
import type { CalculatorComputeResponse } from '@/types/calculator';

type CalculatorResultModalProps = {
  open: boolean;
  payload?: CalculatorComputeResponse;
  onClose: () => void;
};

const BMI_CATEGORY_LABELS: Record<string, string> = {
  LLA: 'Limit Lebih Atas',
  LA: 'Limit Atas',
  LB: 'Limit Bawah',
  LLB: 'Limit Lebih Bawah',
};

export function CalculatorResultModal({ open, payload, onClose }: CalculatorResultModalProps) {
  if (!open || !payload) return null;
  const { calculator, result } = payload;
  const extras = (result.extras ?? {}) as Record<string, unknown>;
  const bmiValue = typeof extras.bmi === 'number' ? (extras.bmi as number) : null;
  const bmiCategoryRaw = typeof extras.bmiCategory === 'string' ? (extras.bmiCategory as string) : null;
  const bmiCategory = bmiCategoryRaw ? BMI_CATEGORY_LABELS[bmiCategoryRaw] ?? bmiCategoryRaw : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4">
      <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-brand-500">{result.label}</p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">{calculator.title}</h2>
            <p className="text-sm text-slate-500">{calculator.description}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-widest text-slate-500">Total Nilai</p>
            <p className="text-4xl font-bold text-brand-600">{result.total.toFixed(2)}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-4 max-h-[26rem] overflow-y-auto">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Rincian Bobot</p>
            <div className="mt-3 space-y-3">
              {result.breakdown.map((item) => (
                <div key={item.key} className="flex items-center justify-between rounded-2xl bg-white px-4 py-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                    <p className="text-xs text-slate-500">Bobot {(item.weight * 100).toFixed(0)}%</p>
                  </div>
                  <p className="text-lg font-semibold text-slate-900">{item.weightedValue.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4 max-h-[26rem] overflow-y-auto">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Input & Konversi</p>
            <div className="mt-3 space-y-3">
              {result.inputs.map((input) => (
                <div key={input.key} className="rounded-2xl bg-white px-4 py-2">
                  <p className="text-sm font-semibold text-slate-900">{input.label}</p>
                  <p className="text-xs text-slate-500">Nilai awal: {typeof input.value === 'number' ? input.value : input.value ?? '-'}</p>
                  {typeof input.score === 'number' && (
                    <p className="text-xs text-emerald-600">Skor terkonversi: {input.score.toFixed(2)}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {(bmiValue !== null || bmiCategory) && (
          <div className="mt-6 rounded-2xl border border-dashed border-brand-200 bg-brand-50/50 p-4 text-sm text-brand-800">
            {bmiValue !== null && (
              <p>
                BMI: <span className="font-semibold">{bmiValue}</span>
                {bmiCategory && ` (${bmiCategory})`}
              </p>
            )}
            {bmiValue === null && bmiCategory && <p>Kategori BMI: {bmiCategory}</p>}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Tutup
          </Button>
        </div>
      </div>
    </div>
  );
}
