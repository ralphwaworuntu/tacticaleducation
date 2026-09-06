import { CermatIcon } from '@/components/dashboard/CermatIcon';
import { CERMAT_MODE_LABELS, type CermatMode } from '@/types/cermat';
import { cn } from '@/utils/cn';

const PREVIEW_DATA = {
  IMAGE: {
    baseSet: ['pesawat', 'mobil', 'kapal', 'bus', 'kereta-api'],
    sequence: ['pesawat', 'mobil', 'bus', 'kereta-api'],
    highlightIndex: 2,
  },
  LETTER: {
    baseSet: ['B', 'D', 'F', 'H', 'J'],
    sequence: ['B', 'D', 'H', 'J'],
    highlightIndex: 2,
  },
  NUMBER: {
    baseSet: ['1', '3', '5', '7', '9'],
    sequence: ['1', '3', '7', '9'],
    highlightIndex: 2,
  },
} as const;

const MODE_ACCENT: Record<CermatMode, { badge: string; ring: string; prompt: string; highlight: string }> = {
  IMAGE: {
    badge: 'bg-brand-600',
    ring: 'ring-brand-100',
    prompt: 'text-brand-700',
    highlight: 'border-brand-600 bg-brand-600',
  },
  LETTER: {
    badge: 'bg-violet-600',
    ring: 'ring-violet-100',
    prompt: 'text-violet-700',
    highlight: 'border-violet-600 bg-violet-600',
  },
  NUMBER: {
    badge: 'bg-emerald-600',
    ring: 'ring-emerald-100',
    prompt: 'text-emerald-700',
    highlight: 'border-emerald-600 bg-emerald-600',
  },
};

type CermatModePreviewProps = {
  mode: CermatMode;
  className?: string;
};

export function CermatModePreview({ mode, className }: CermatModePreviewProps) {
  const data = PREVIEW_DATA[mode];
  const accent = MODE_ACCENT[mode];
  const labels = ['A', 'B', 'C', 'D', 'E'];

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50/50 to-white p-3 shadow-[0_8px_30px_rgba(15,23,42,0.06)] ring-1',
        accent.ring,
        className,
      )}
      aria-hidden
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white', accent.badge)}>
          {CERMAT_MODE_LABELS[mode]}
        </span>
        <span className="text-[9px] font-medium uppercase tracking-wider text-slate-400">Contoh Soal</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800/90 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-2 py-1 text-center">
          <p className="text-[8px] font-semibold uppercase tracking-[0.15em] text-slate-500">Kunci Referensi</p>
        </div>
        <div className="grid grid-cols-5 divide-x divide-slate-100">
          {data.baseSet.map((token, index) => (
            <div
              key={`${token}-${index}`}
              className={cn('flex flex-col items-center gap-1 py-2', index % 2 === 0 ? 'bg-white' : 'bg-slate-50/80')}
            >
              {mode === 'IMAGE' ? (
                <div className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-100 bg-white p-0.5">
                  <CermatIcon name={token} strokeWidth={3} className="h-full w-full" />
                </div>
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-xs font-bold text-slate-900 shadow-inner">
                  {token}
                </span>
              )}
              <span className="flex h-4 w-4 items-center justify-center rounded bg-slate-900 text-[8px] font-bold text-white">
                {labels[index]}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2 rounded-xl border border-dashed border-slate-200 bg-white/80 px-2 py-2.5">
        <p className="mb-1.5 text-center text-[8px] leading-snug text-slate-600">
          Pilih yang <span className={cn('font-semibold', accent.prompt)}>tidak muncul</span>
        </p>
        <div className="flex items-center justify-center gap-1.5">
          {data.sequence.map((token, idx) =>
            mode === 'IMAGE' ? (
              <div
                key={`${token}-${idx}`}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-white bg-white p-0.5 shadow-sm"
              >
                <CermatIcon name={token} strokeWidth={3} className="h-full w-full" />
              </div>
            ) : (
              <span
                key={`${token}-${idx}`}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-900"
              >
                {token}
              </span>
            ),
          )}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-5 gap-1">
        {labels.map((label, index) => (
          <span
            key={label}
            className={cn(
              'flex items-center justify-center rounded-lg border py-1 text-[10px] font-bold',
              index === data.highlightIndex
                ? cn('text-white shadow-sm', accent.highlight)
                : 'border-slate-200 bg-white text-slate-700',
            )}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export { MODE_ACCENT as CERMAT_MODE_ACCENT };
