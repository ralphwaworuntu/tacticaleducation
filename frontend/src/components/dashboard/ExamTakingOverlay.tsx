import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Clock3, MoreHorizontal } from 'lucide-react';
import { BrandMark } from '@/components/common/BrandMark';
import { Button } from '@/components/ui/button';
import { QuestionNavigator } from '@/components/dashboard/QuestionNavigator';
import { cn } from '@/utils/cn';

type ExamTakingOverlayProps = {
  open: boolean;
  eyebrow: string;
  title: string;
  subtitle?: string;
  timeLeftLabel?: string | null;
  questions: Array<{ id: string }>;
  answers: Record<string, string[]>;
  activeIndex: number;
  onJump: (index: number) => void;
  onPrev: () => void;
  onNext: () => void;
  /** Opens finish confirmation — never submits immediately. */
  onFinish: () => void;
  onCancel: () => void;
  submitPending?: boolean;
  /** e.g. "Akhiri Tryout" / "Akhiri Latihan" */
  finishLabel?: string;
  cancelLabel?: string;
  children: ReactNode;
};

export function ExamTakingOverlay({
  open,
  eyebrow,
  title,
  subtitle,
  timeLeftLabel,
  questions,
  answers,
  activeIndex,
  onJump,
  onPrev,
  onNext,
  onFinish,
  onCancel,
  submitPending = false,
  finishLabel = 'Akhiri sesi',
  cancelLabel = 'Batalkan',
  children,
}: ExamTakingOverlayProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const total = questions.length;
  const current = Math.min(activeIndex + 1, total);
  const isFirst = activeIndex <= 0;
  const isLast = activeIndex >= total - 1;
  const answeredCount = useMemo(
    () => questions.filter((q) => (answers[q.id]?.length ?? 0) > 0).length,
    [answers, questions],
  );

  useEffect(() => {
    if (!open) {
      setMenuOpen(false);
      return undefined;
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex max-w-[100vw] flex-col bg-slate-100 text-slate-900">
      <header className="relative z-20 shrink-0 border-b border-slate-200 bg-white shadow-sm">
        {/* Mobile: brand row + session row — biar logo & nama proporsional */}
        <div className="mx-auto w-full max-w-7xl px-3 py-2.5 sm:hidden">
          <div className="flex items-center gap-2.5">
            <BrandMark
              size="sm"
              variant="compact"
              showTagline={false}
              framed
              className="min-w-0 flex-1 [&_p]:text-[13px]"
            />
            <div className="flex shrink-0 items-center gap-1.5">
              {timeLeftLabel ? (
                <div
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-bold tabular-nums text-white shadow-sm"
                  aria-live="polite"
                >
                  <Clock3 className="h-3.5 w-3.5 opacity-90" aria-hidden />
                  <span>{timeLeftLabel}</span>
                </div>
              ) : null}
              <div className="relative">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 border-slate-200"
                  aria-label="Menu sesi"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((v) => !v)}
                >
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
                {menuOpen ? (
                  <>
                    <button
                      type="button"
                      className="fixed inset-0 z-10 cursor-default"
                      aria-label="Tutup menu"
                      onClick={() => setMenuOpen(false)}
                    />
                    <div className="absolute right-0 top-full z-20 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                      <button
                        type="button"
                        className="block w-full px-4 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                        disabled={submitPending}
                        onClick={() => {
                          setMenuOpen(false);
                          onFinish();
                        }}
                      >
                        {finishLabel}
                      </button>
                      <button
                        type="button"
                        className="block w-full px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                        onClick={() => {
                          setMenuOpen(false);
                          onCancel();
                        }}
                      >
                        {cancelLabel}
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>
          <div className="mt-2 flex items-end justify-between gap-2 border-t border-slate-100 pt-2">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-600">{eyebrow}</p>
              <h2 className="truncate text-sm font-semibold leading-snug text-slate-900">{title}</h2>
            </div>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="shrink-0 px-3"
              onClick={onFinish}
              disabled={submitPending}
              isLoading={submitPending}
            >
              Akhiri
            </Button>
          </div>
        </div>

        {/* Desktop / tablet — toolbar ringkas, brand & sesi terpisah jelas */}
        <div className="mx-auto hidden w-full max-w-7xl items-center gap-4 px-5 py-3 sm:flex lg:px-6">
          <div className="flex shrink-0 items-center gap-3">
            <BrandMark size="sm" variant="icon" framed className="shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold leading-none tracking-tight text-slate-900">Tactical Education</p>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">Bimbel & Tryout</p>
            </div>
          </div>

          <div className="h-10 w-px shrink-0 bg-slate-200" aria-hidden="true" />

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-600">{eyebrow}</p>
            <div className="mt-0.5 flex min-w-0 items-baseline gap-2">
              <h2 className="truncate text-base font-semibold leading-snug text-slate-900 lg:text-[1.05rem]">
                {title}
              </h2>
              {subtitle ? (
                <span className="hidden truncate text-sm text-slate-400 xl:inline" title={subtitle}>
                  {subtitle}
                </span>
              ) : null}
            </div>
            {subtitle ? (
              <p className="mt-0.5 truncate text-xs text-slate-500 xl:hidden" title={subtitle}>
                {subtitle}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            {timeLeftLabel ? (
              <div
                className={cn(
                  'inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-bold tabular-nums',
                  'bg-brand-600 text-white shadow-sm',
                )}
                aria-live="polite"
              >
                <Clock3 className="h-4 w-4 opacity-90" aria-hidden />
                <span className="text-white/80">Sisa</span>
                <span>{timeLeftLabel}</span>
              </div>
            ) : null}

            <Button
              type="button"
              variant="destructive"
              className="px-4"
              onClick={onFinish}
              disabled={submitPending}
              isLoading={submitPending}
            >
              {finishLabel}
            </Button>

            <div className="relative">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="border-slate-200"
                aria-label="Menu sesi"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
              >
                <MoreHorizontal className="h-5 w-5" />
              </Button>
              {menuOpen ? (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-10 cursor-default"
                    aria-label="Tutup menu"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full z-20 mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                    <button
                      type="button"
                      className="block w-full px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                      onClick={() => {
                        setMenuOpen(false);
                        onCancel();
                      }}
                    >
                      {cancelLabel}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto grid w-full max-w-7xl gap-4 px-3 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-5 lg:py-5">
          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 lg:p-7">
            {children}

            <div className="mt-6 flex items-center gap-2 border-t border-slate-100 pt-4">
              <Button
                type="button"
                variant="outline"
                className="min-w-0 flex-1 sm:flex-none sm:min-w-[9.5rem]"
                onClick={onPrev}
                disabled={isFirst}
              >
                <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
                <span className="truncate">Sebelumnya</span>
              </Button>

              <div className="hidden min-w-0 flex-1 text-center sm:block">
                <p className="text-sm font-semibold tabular-nums text-slate-800">
                  Soal {current} dari {total || '—'}
                </p>
                <p className="text-xs text-slate-500">Atau pilih nomor di navigasi</p>
              </div>
              <p className="min-w-[4.5rem] text-center text-xs font-semibold tabular-nums text-slate-700 sm:hidden">
                {current}/{total || '—'}
              </p>

              <Button
                type="button"
                variant={isLast ? 'muted' : 'primary'}
                className="min-w-0 flex-1 sm:flex-none sm:min-w-[9.5rem]"
                onClick={onNext}
                disabled={isLast}
              >
                <span className="truncate">Berikutnya</span>
                <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
              </Button>
            </div>
          </section>

          <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
            <QuestionNavigator
              questions={questions}
              answers={answers}
              activeIndex={activeIndex}
              onJump={onJump}
            />
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Terjawab</span>
                <span className="font-semibold tabular-nums text-slate-900">
                  {answeredCount}/{total}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-brand-500 transition-all"
                  style={{ width: total ? `${(answeredCount / total) * 100}%` : '0%' }}
                />
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
                Selesai mengerjakan? Gunakan tombol{' '}
                <span className="font-semibold text-slate-700">{finishLabel}</span> di atas (di samping waktu).
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>,
    document.body,
  );
}

type ExamQuestionPanelProps = {
  index: number;
  prompt: string;
  imageUrl?: string | null;
  multipleCorrect?: boolean;
  children: ReactNode;
};

export function ExamQuestionPanel({
  index,
  prompt,
  imageUrl,
  multipleCorrect,
  children,
}: ExamQuestionPanelProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 sm:gap-4">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white shadow-sm sm:h-10 sm:w-10 sm:text-base">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Pertanyaan</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-base font-semibold leading-relaxed text-slate-900 sm:text-lg">
            {prompt}
          </p>
          {multipleCorrect ? (
            <p className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-xs font-medium text-brand-800">
              Multi-jawaban: pilih semua yang benar. Jawaban dihitung benar hanya jika seluruh pilihan tepat.
            </p>
          ) : null}
        </div>
      </div>

      {imageUrl ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          <img
            src={imageUrl}
            alt="Ilustrasi soal"
            className="mx-auto max-h-[min(42vh,360px)] w-auto max-w-full object-contain"
            loading="lazy"
          />
        </div>
      ) : null}

      <div>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Pilihan jawaban</p>
        {children}
      </div>
    </div>
  );
}
