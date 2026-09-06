import { getAssetUrl } from '@/lib/media';
import { cn } from '@/utils/cn';

export type ExamOption = {
  id: string;
  label: string;
  imageUrl?: string | null;
};

type ExamQuestionOptionsProps = {
  questionId: string;
  options: ExamOption[];
  multipleCorrect: boolean;
  selectedIds: string[];
  onSelectSingle: (optionId: string) => void;
  onToggleMulti: (optionId: string) => void;
};

export function ExamQuestionOptions({
  questionId,
  options,
  multipleCorrect,
  selectedIds,
  onSelectSingle,
  onToggleMulti,
}: ExamQuestionOptionsProps) {
  const hasImages = options.some((option) => Boolean(option.imageUrl));

  return (
    <div className={cn('grid gap-2.5', hasImages ? 'sm:grid-cols-2' : 'grid-cols-1')}>
      {options.map((option, index) => {
        const letter = String.fromCharCode(65 + index);
        const active = selectedIds.includes(option.id);
        return (
          <label
            key={option.id}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 text-sm transition',
              active
                ? 'border-brand-500 bg-brand-50 text-brand-900 ring-1 ring-brand-500/30'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
            )}
          >
            <span
              className={cn(
                'mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600',
              )}
              aria-hidden
            >
              {letter}
            </span>
            <input
              type={multipleCorrect ? 'checkbox' : 'radio'}
              name={multipleCorrect ? `${questionId}-${option.id}` : questionId}
              value={option.id}
              checked={active}
              onChange={() => (multipleCorrect ? onToggleMulti(option.id) : onSelectSingle(option.id))}
              className="sr-only"
            />
            <span className="min-w-0 flex-1">
              <span className="whitespace-pre-wrap break-words font-medium leading-relaxed">{option.label}</span>
              {option.imageUrl ? (
                <img
                  src={getAssetUrl(option.imageUrl)}
                  alt={`Opsi ${letter}`}
                  className="mt-2 max-h-28 w-full rounded-lg border border-slate-100 object-contain bg-slate-50"
                  loading="lazy"
                />
              ) : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}
