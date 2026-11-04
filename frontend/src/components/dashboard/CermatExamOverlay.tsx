import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { CermatIcon } from '@/components/dashboard/CermatIcon';
import { BrandMark } from '@/components/common/BrandMark';
import { CERMAT_MODE_LABELS, type CermatMode } from '@/types/cermat';
import { cn } from '@/utils/cn';

type CermatExamOverlayProps = {
  mode: CermatMode;
  sessionIndex: number;
  totalSessions: number;
  currentIndex: number;
  totalQuestions: number;
  timeLeft: number;
  baseSet: string[];
  sequence: string[];
  questionOrder: number;
  answers: Record<number, string | null>;
  submitPending: boolean;
  modeLabels: Record<CermatMode, { reference: string; prompt: string; button: string }>;
  onAnswer: (value?: string | null) => void;
};

function formatTimer(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function optionGridClass(count: number) {
  return count >= 6 ? 'grid-cols-6' : 'grid-cols-5';
}

function StatPill({ label, value, urgent }: { label: string; value: string; urgent?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-xl border px-2 py-2 text-center sm:px-3 sm:py-2.5 lg:px-4 lg:py-3',
        urgent ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white',
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs lg:text-sm">{label}</p>
      <p
        className={cn(
          'mt-0.5 text-lg font-bold tabular-nums sm:text-xl lg:text-2xl xl:text-3xl',
          urgent ? 'text-red-600' : 'text-slate-900',
        )}
      >
        {value}
      </p>
    </div>
  );
}

function CermatImageBrandHeader({ sessionIndex, totalSessions }: { sessionIndex: number; totalSessions: number }) {
  return (
    <header className="shrink-0 border-b border-brand-100/80 bg-gradient-to-r from-white via-brand-50/30 to-white shadow-sm">
      <div className="mx-auto max-w-2xl px-4 py-3 sm:max-w-3xl sm:px-6 sm:py-3.5 lg:max-w-5xl xl:max-w-6xl">
        <div className="flex items-center justify-between gap-3 sm:gap-4">
          <BrandMark size="md" variant="full" className="min-w-0 flex-1" />

          <div className="shrink-0 text-right">
            <span className="inline-flex items-center rounded-full bg-brand-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white shadow-sm sm:px-3 sm:text-xs">
              {CERMAT_MODE_LABELS.IMAGE}
            </span>
            <p className="mt-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 sm:text-xs">
              Tes Kecermatan
            </p>
            <p className="text-xs font-bold tabular-nums text-brand-800 sm:text-sm">
              Sesi {sessionIndex}/{totalSessions}
            </p>
          </div>
        </div>
      </div>
      <div className="h-0.5 bg-gradient-to-r from-transparent via-brand-500/70 to-transparent" aria-hidden />
    </header>
  );
}

function ImageExamContent({
  currentIndex,
  timeLeft,
  answeredCount,
  baseSet,
  sequence,
  questionOrder,
  answers,
  submitPending,
  onAnswer,
}: {
  currentIndex: number;
  timeLeft: number;
  answeredCount: number;
  baseSet: string[];
  sequence: string[];
  questionOrder: number;
  answers: Record<number, string | null>;
  submitPending: boolean;
  onAnswer: (value?: string | null) => void;
}) {
  const timerUrgent = timeLeft <= 10;
  const optionCount = baseSet.length;
  const wide = optionCount >= 6;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 sm:gap-5 lg:max-w-5xl lg:flex-1 lg:justify-between lg:gap-3 xl:max-w-6xl">
      <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
        <StatPill label="Kolom" value={String(currentIndex + 1)} />
        <StatPill label="Durasi" value={formatTimer(timeLeft)} urgent={timerUrgent} />
        <StatPill label="Terjawab" value={String(answeredCount)} />
      </div>

      <section className="overflow-hidden rounded-2xl border-2 border-slate-800 bg-white shadow-sm lg:rounded-3xl">
        <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-center lg:py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 lg:text-xs">Kunci Referensi</p>
        </div>
        <div className={cn('grid divide-x divide-slate-200', optionGridClass(optionCount))}>
          {baseSet.map((token, index) => {
            const label = String.fromCharCode(65 + index);
            return (
              <div
                key={token}
                className={cn(
                  'flex flex-col items-center gap-2 px-0.5 py-4 sm:gap-2.5 sm:py-5 lg:gap-3 lg:py-6',
                  index % 2 === 0 ? 'bg-white' : 'bg-slate-50/80',
                )}
              >
                <div
                  className={cn(
                    'flex aspect-square items-center justify-center rounded-xl border border-slate-100 bg-white p-1 shadow-sm',
                    wide
                      ? 'h-12 w-12 sm:h-16 sm:w-16 lg:h-24 lg:w-24 xl:h-28 xl:w-28'
                      : 'h-16 w-16 sm:h-20 sm:w-20 lg:h-28 lg:w-28 xl:h-32 xl:w-32',
                  )}
                >
                  <CermatIcon name={token} strokeWidth={3.5} className="h-full w-full" />
                </div>
                <span
                  className={cn(
                    'flex items-center justify-center rounded-md bg-slate-900 font-bold text-white',
                    wide
                      ? 'h-6 w-6 text-[10px] sm:h-7 sm:w-7 sm:text-xs lg:h-8 lg:w-8 lg:text-sm'
                      : 'h-7 w-7 text-xs sm:h-8 sm:w-8 sm:text-sm lg:h-9 lg:w-9 lg:text-base xl:h-10 xl:w-10',
                  )}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/40 px-3 py-5 sm:px-5 sm:py-6 lg:rounded-3xl lg:px-8 lg:py-7">
        <p className="mb-4 text-center text-xs font-medium text-slate-600 sm:mb-5 sm:text-sm lg:mb-6 lg:text-base">
          Pilih huruf gambar yang <span className="font-semibold text-brand-700">tidak muncul</span>
        </p>
        <div
          className={cn(
            'flex items-center justify-center',
            wide ? 'gap-1.5 sm:gap-3 lg:gap-6 xl:gap-8' : 'gap-3 sm:gap-6 lg:gap-10 xl:gap-12',
          )}
        >
          {sequence.map((token, idx) => (
            <div
              key={`${token}-${idx}`}
              className={cn(
                'flex aspect-square shrink-0 items-center justify-center rounded-2xl border-2 border-white bg-white shadow-md',
                wide
                  ? 'h-12 w-12 p-1 sm:h-[4.5rem] sm:w-[4.5rem] lg:h-28 lg:w-28 lg:p-1.5 xl:h-32 xl:w-32'
                  : 'h-[4.25rem] w-[4.25rem] p-1.5 sm:h-24 sm:w-24 lg:h-32 lg:w-32 xl:h-36 xl:w-36',
              )}
            >
              <CermatIcon name={token} strokeWidth={3.5} className="h-full w-full" />
            </div>
          ))}
        </div>
      </section>

      <section className={cn('grid gap-1.5 sm:gap-2.5 lg:gap-3', optionGridClass(optionCount))}>
        {baseSet.map((option, index) => {
          const label = String.fromCharCode(65 + index);
          const selected = answers[questionOrder] === option;
          return (
            <button
              key={option}
              type="button"
              disabled={submitPending}
              onClick={() => onAnswer(option)}
              className={cn(
                'rounded-xl border-2 font-bold transition lg:rounded-2xl',
                wide
                  ? 'py-2.5 text-base sm:py-3.5 sm:text-lg lg:py-4 lg:text-2xl xl:py-5 xl:text-3xl'
                  : 'py-3 text-lg sm:py-4 sm:text-xl lg:py-5 lg:text-2xl xl:py-6 xl:text-3xl',
                selected
                  ? 'border-brand-600 bg-brand-600 text-white shadow-md'
                  : 'border-slate-300 bg-white text-slate-900 hover:border-brand-300 hover:bg-brand-50/50',
              )}
            >
              {label}
            </button>
          );
        })}
      </section>

      <div className="flex justify-end pb-2 lg:pb-0">
        <Button variant="ghost" size="sm" onClick={() => onAnswer(null)} disabled={submitPending}>
          Lewati soal
        </Button>
      </div>
    </div>
  );
}

function TextExamContent({
  mode,
  modeLabels,
  baseSet,
  sequence,
  questionOrder,
  answers,
  submitPending,
  onAnswer,
}: {
  mode: Exclude<CermatMode, 'IMAGE'>;
  modeLabels: CermatExamOverlayProps['modeLabels'];
  baseSet: string[];
  sequence: string[];
  questionOrder: number;
  answers: Record<number, string | null>;
  submitPending: boolean;
  onAnswer: (value?: string | null) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 sm:space-y-5">
      <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">{modeLabels[mode].reference}</p>
        <div className="mt-3 grid grid-cols-5 gap-1.5 sm:mt-4 sm:gap-3">
          {baseSet.map((token, index) => {
            const label = String.fromCharCode(65 + index);
            return (
              <div key={token} className="flex flex-col items-center gap-1 sm:gap-2">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-xl font-semibold text-slate-900 shadow-inner sm:h-14 sm:w-14 sm:text-3xl">
                  {token}
                </span>
                <span className="text-xs font-semibold text-slate-500">{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Deret Soal Aktif</p>
        <div className="mt-3 flex items-center justify-between gap-1.5 sm:mt-4 sm:gap-3">
          {sequence.map((token, idx) => (
            <span
              key={`${token}-${idx}`}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-lg font-bold text-slate-900 sm:h-14 sm:w-14 sm:text-2xl"
            >
              {token}
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">{modeLabels[mode].prompt}</p>
      </div>

      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {baseSet.map((option, index) => {
          const label = String.fromCharCode(65 + index);
          const selected = answers[questionOrder] === option;
          return (
            <button
              key={option}
              type="button"
              disabled={submitPending}
              onClick={() => onAnswer(option)}
              className={cn(
                'rounded-xl border py-3 text-base font-semibold transition sm:py-3.5 sm:text-lg',
                selected
                  ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-inner'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex justify-end pb-2">
        <Button variant="ghost" size="sm" onClick={() => onAnswer(null)} disabled={submitPending}>
          Lewati soal
        </Button>
      </div>
    </div>
  );
}

export function CermatExamOverlay({
  mode,
  sessionIndex,
  totalSessions,
  currentIndex,
  totalQuestions,
  timeLeft,
  baseSet,
  sequence,
  questionOrder,
  answers,
  submitPending,
  modeLabels,
  onAnswer,
}: CermatExamOverlayProps) {
  if (typeof document === 'undefined') {
    return null;
  }

  const isImage = mode === 'IMAGE';
  const answeredCount = Object.values(answers).filter(Boolean).length;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[9999] flex h-[100dvh] w-screen flex-col overflow-hidden',
        isImage ? 'bg-slate-50' : 'bg-slate-900',
      )}
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {isImage ? (
        <CermatImageBrandHeader sessionIndex={sessionIndex} totalSessions={totalSessions} />
      ) : (
        <header className="shrink-0 border-b border-white/10 bg-slate-900 px-4 py-3 text-white sm:px-6 lg:py-3.5">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 sm:max-w-3xl lg:max-w-5xl xl:max-w-6xl">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] sm:text-xs text-white/60">Tes Kecermatan</p>
              <h2 className="truncate text-base font-semibold sm:text-lg lg:text-xl">
                Sesi {sessionIndex}/{totalSessions} · Soal {currentIndex + 1}/{totalQuestions}
              </h2>
            </div>
            <div className="shrink-0 rounded-2xl bg-white/10 px-3 py-2 text-center sm:px-4">
              <p className="text-[10px] uppercase text-white/70">Sisa Waktu</p>
              <p className="text-xl font-bold tabular-nums sm:text-2xl">{timeLeft}s</p>
            </div>
          </div>
        </header>
      )}

      <main
        className={cn(
          'flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-6 sm:py-5',
          isImage && 'lg:flex lg:flex-col lg:overflow-hidden lg:py-4',
          !isImage && 'text-white',
        )}
      >
        {!isImage && (
          <div className="mx-auto mb-4 flex max-w-3xl items-center justify-center gap-3 sm:mb-6">
            <BrandMark size="sm" variant="icon" framed />
            <p className="text-sm font-semibold tracking-tight text-white sm:text-base">Tactical Education</p>
          </div>
        )}

        <div className={cn(!isImage && 'mx-auto max-w-3xl rounded-3xl bg-white/95 p-4 text-slate-900 shadow-xl sm:p-6')}>
          {isImage ? (
            <ImageExamContent
              currentIndex={currentIndex}
              timeLeft={timeLeft}
              answeredCount={answeredCount}
              baseSet={baseSet}
              sequence={sequence}
              questionOrder={questionOrder}
              answers={answers}
              submitPending={submitPending}
              onAnswer={onAnswer}
            />
          ) : (
            <TextExamContent
              mode={mode}
              modeLabels={modeLabels}
              baseSet={baseSet}
              sequence={sequence}
              questionOrder={questionOrder}
              answers={answers}
              submitPending={submitPending}
              onAnswer={onAnswer}
            />
          )}
        </div>
      </main>
    </div>,
    document.body,
  );
}
