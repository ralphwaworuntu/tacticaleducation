import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, CircleHelp, XCircle } from 'lucide-react';
import { getAssetUrl } from '@/lib/media';
import { Button } from '@/components/ui/button';
import { getGradeBadge, getUserSelectedIds } from '@/lib/examAnswers';
import { cn } from '@/utils/cn';

export type ExamReviewQuestionItem = {
  id: string;
  order: number;
  prompt: string;
  imageUrl?: string | null;
  explanation?: string | null;
  explanationImageUrl?: string | null;
  isCorrect: boolean;
  gradeStatus?: 'correct' | 'incorrect';
  userOptionId?: string | null;
  userOptionIds?: string[];
  options: Array<{ id: string; label: string; imageUrl?: string | null; isCorrect?: boolean }>;
};

function ReviewMedia({ src, alt, compact }: { src?: string | null; alt: string; compact?: boolean }) {
  const url = getAssetUrl(src);
  if (!url) return null;
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      <img
        src={url}
        alt={alt}
        className={cn(
          'mx-auto w-auto max-w-full object-contain',
          compact ? 'max-h-24' : 'max-h-[min(32vh,240px)]',
        )}
        loading="lazy"
      />
    </div>
  );
}

export function ExamReviewSummaryBar({
  score,
  correctCount,
  totalQuestions,
  meta,
  statusLabel,
  passed,
}: {
  score: number;
  correctCount: number;
  totalQuestions: number;
  meta?: string;
  statusLabel: string;
  passed: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <div className="px-4 py-4 sm:px-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Skor</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-brand-700">{Math.round(score)}</p>
          <p className="mt-0.5 text-sm text-slate-500">
            {correctCount}/{totalQuestions} soal benar
          </p>
        </div>
        <div className="px-4 py-4 sm:px-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Ringkasan</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{totalQuestions}</p>
          <p className="mt-0.5 text-sm text-slate-500">{meta ?? 'Total soal'}</p>
        </div>
        <div className="px-4 py-4 sm:px-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Hasil</p>
          <p
            className={cn(
              'mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold',
              passed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800',
            )}
          >
            {passed ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <CircleHelp className="h-4 w-4" aria-hidden />}
            {statusLabel}
          </p>
          <p className="mt-2 text-sm text-slate-500">Pelajari tiap soal lewat navigasi nomor.</p>
        </div>
      </div>
    </div>
  );
}

function ReviewQuestionNavigator({
  questions,
  activeIndex,
  onJump,
}: {
  questions: ExamReviewQuestionItem[];
  activeIndex: number;
  onJump: (index: number) => void;
}) {
  const stats = useMemo(() => {
    const correct = questions.filter((q) => q.isCorrect || q.gradeStatus === 'correct').length;
    return { correct, total: questions.length, wrong: questions.length - correct };
  }, [questions]);

  if (!questions.length) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-900">Daftar soal</p>
      <p className="mt-1 text-xs text-slate-500">
        {stats.correct} benar · {stats.wrong} salah
      </p>

      <div className="mt-3 grid grid-cols-5 gap-1.5">
        {questions.map((question, index) => {
          const ok = getGradeBadge(question).label === 'Benar';
          const active = index === activeIndex;
          return (
            <button
              key={question.id}
              type="button"
              onClick={() => onJump(index)}
              aria-current={active ? 'true' : undefined}
              title={`Soal ${question.order} — ${ok ? 'Benar' : 'Salah'}`}
              className={cn(
                'inline-flex h-9 items-center justify-center rounded-lg border text-sm font-semibold transition',
                active && 'ring-2 ring-brand-500 ring-offset-1',
                active
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : ok
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-400'
                    : 'border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-400',
              )}
            >
              {question.order}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-slate-100 pt-3 text-[10px] font-medium text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-brand-600" /> Sedang dibuka
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Benar
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" /> Salah
        </span>
      </div>
    </div>
  );
}

function ExamReviewQuestionCard({
  question,
  showAnswerSummary = false,
  footer,
}: {
  question: ExamReviewQuestionItem;
  showAnswerSummary?: boolean;
  footer?: ReactNode;
}) {
  const grade = getGradeBadge(question);
  const isCorrect = grade.label === 'Benar';
  const userSelectedIds = getUserSelectedIds(question);
  const userLabels = userSelectedIds
    .map((id) => question.options.find((opt) => opt.id === id)?.label)
    .filter(Boolean);
  const correctLabels = question.options.filter((opt) => opt.isCorrect).map((opt) => opt.label);

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div
        className={cn(
          'flex items-center gap-3 border-b px-4 py-3 sm:px-5',
          isCorrect ? 'border-emerald-100 bg-emerald-50' : 'border-rose-100 bg-rose-50',
        )}
      >
        {isCorrect ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
        ) : (
          <XCircle className="h-5 w-5 shrink-0 text-rose-600" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className={cn(
                'inline-flex h-9 min-w-9 items-center justify-center rounded-xl px-2.5 text-base font-bold tabular-nums text-white shadow-sm sm:h-10 sm:min-w-10 sm:text-lg',
                isCorrect ? 'bg-emerald-600' : 'bg-rose-600',
              )}
            >
              {question.order}
            </span>
            <p className={cn('text-sm font-semibold sm:text-base', isCorrect ? 'text-emerald-800' : 'text-rose-800')}>
              {isCorrect ? 'Jawaban kamu benar' : 'Jawaban kamu belum tepat'}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-4 sm:p-5 lg:p-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Pertanyaan</p>
          <h3 className="mt-1.5 whitespace-pre-wrap break-words text-base font-semibold leading-relaxed text-slate-900 sm:text-lg">
            {question.prompt}
          </h3>
          {question.imageUrl ? (
            <div className="mt-3">
              <ReviewMedia src={question.imageUrl} alt={`Ilustrasi soal ${question.order}`} />
            </div>
          ) : null}
        </div>

        <div>
          <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Pilihan jawaban</p>
          <div className="space-y-2">
            {question.options.map((option, index) => {
              const letter = String.fromCharCode(65 + index);
              const isUserChoice = userSelectedIds.includes(option.id);
              const isKey = Boolean(option.isCorrect);
              return (
                <div
                  key={option.id}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border px-3.5 py-3 text-sm',
                    isKey
                      ? 'border-emerald-300 bg-emerald-50'
                      : isUserChoice
                        ? 'border-rose-300 bg-rose-50'
                        : 'border-slate-200 bg-white',
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                      isKey
                        ? 'bg-emerald-600 text-white'
                        : isUserChoice
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-100 text-slate-600',
                    )}
                  >
                    {letter}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'whitespace-pre-wrap break-words leading-snug',
                        isKey || isUserChoice ? 'font-semibold text-slate-900' : 'font-medium text-slate-600',
                      )}
                    >
                      {option.label}
                    </p>
                    {(isKey || isUserChoice) && (
                      <p
                        className={cn(
                          'mt-1 text-xs font-semibold',
                          isKey ? 'text-emerald-700' : 'text-rose-700',
                        )}
                      >
                        {isKey && isUserChoice
                          ? 'Jawaban benar · pilihan kamu'
                          : isKey
                            ? 'Kunci jawaban'
                            : 'Pilihan kamu'}
                      </p>
                    )}
                    {option.imageUrl ? (
                      <div className="mt-2">
                        <ReviewMedia src={option.imageUrl} alt={`Opsi ${letter}`} compact />
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Pembahasan</p>
          {(showAnswerSummary || !isCorrect) && (
            <div className="mt-2 grid gap-1.5 text-sm text-slate-600 sm:grid-cols-2">
              <p>
                <span className="font-medium text-slate-800">Jawaban kamu:</span>{' '}
                {userLabels.join(', ') || 'Tidak dijawab'}
              </p>
              <p>
                <span className="font-medium text-slate-800">Kunci:</span> {correctLabels.join(', ') || '—'}
              </p>
            </div>
          )}
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700 sm:text-[15px]">
            {question.explanation?.trim() || 'Pembahasan belum tersedia untuk soal ini.'}
          </p>
          {question.explanationImageUrl ? (
            <div className="mt-3">
              <ReviewMedia src={question.explanationImageUrl} alt="Ilustrasi pembahasan" />
            </div>
          ) : null}
        </div>

        {footer ? <div className="border-t border-slate-100 pt-4">{footer}</div> : null}
      </div>
    </article>
  );
}

export function ExamReviewQuestionList({
  questions,
  showAnswerSummary = false,
}: {
  questions: ExamReviewQuestionItem[];
  showAnswerSummary?: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const questionKey = questions.map((q) => q.id).join('|');
  const total = questions.length;
  const safeIndex = total ? Math.min(activeIndex, total - 1) : 0;
  const currentQuestion = questions[safeIndex];
  const isFirst = safeIndex <= 0;
  const isLast = safeIndex >= total - 1;
  const hasNavigatedRef = useRef(false);

  useEffect(() => {
    setActiveIndex(0);
    hasNavigatedRef.current = false;
  }, [questionKey]);

  useEffect(() => {
    if (!hasNavigatedRef.current) return;
    document.getElementById('exam-review-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [safeIndex]);

  const jumpTo = (index: number) => {
    hasNavigatedRef.current = true;
    setActiveIndex(index);
  };

  if (!total || !currentQuestion) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
        Tidak ada soal pembahasan.
      </div>
    );
  }

  const navFooter = (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        className="min-w-0 flex-1 sm:flex-none sm:min-w-[9rem]"
        onClick={() => jumpTo(Math.max(0, safeIndex - 1))}
        disabled={isFirst}
      >
        <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
        <span className="truncate">Sebelumnya</span>
      </Button>

      <p className="min-w-[4.5rem] text-center text-xs font-semibold tabular-nums text-slate-600 sm:min-w-0 sm:flex-1 sm:text-sm">
        {safeIndex + 1} / {total}
      </p>

      <Button
        type="button"
        variant={isLast ? 'muted' : 'primary'}
        className="min-w-0 flex-1 sm:flex-none sm:min-w-[9rem]"
        onClick={() => jumpTo(Math.min(total - 1, safeIndex + 1))}
        disabled={isLast}
      >
        <span className="truncate">Berikutnya</span>
        <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
      </Button>
    </div>
  );

  return (
    <div id="exam-review-panel" className="scroll-mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-5">
      <div className="min-w-0">
        <ExamReviewQuestionCard
          key={currentQuestion.id}
          question={currentQuestion}
          showAnswerSummary={showAnswerSummary}
          footer={navFooter}
        />
      </div>

      <aside className="lg:sticky lg:top-4 lg:self-start">
        <ReviewQuestionNavigator questions={questions} activeIndex={safeIndex} onJump={jumpTo} />
      </aside>
    </div>
  );
}
