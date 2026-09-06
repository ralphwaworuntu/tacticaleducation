import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';

type QuestionNavigatorProps = {
  questions: Array<{ id: string }>;
  answers: Record<string, string[]>;
  activeIndex: number;
  onJump: (index: number) => void;
};

export function QuestionNavigator({ questions, answers, activeIndex, onJump }: QuestionNavigatorProps) {
  if (!questions.length) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">Navigasi Soal</p>
        <span className="text-xs tabular-nums text-slate-500">{questions.length} nomor</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-medium text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-brand-600" /> Aktif
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Terjawab
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border border-slate-300 bg-white" /> Kosong
        </span>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-1.5">
        {questions.map((question, index) => {
          const answered = (answers[question.id]?.length ?? 0) > 0;
          const active = index === activeIndex;
          return (
            <Button
              key={question.id}
              type="button"
              variant="ghost"
              className={cn(
                'h-9 rounded-lg border p-0 text-sm font-semibold transition-colors',
                active
                  ? 'border-brand-600 bg-brand-600 text-white hover:bg-brand-700 hover:text-white'
                  : answered
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50',
              )}
              onClick={() => onJump(index)}
              aria-current={active ? 'true' : undefined}
              aria-label={`Soal ${index + 1}${answered ? ', terjawab' : ''}`}
            >
              {index + 1}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
