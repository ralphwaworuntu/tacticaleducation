import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { Radio, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api';
import { liveQuizApi } from '../api';
import type { QuizListItem, QuizSettings } from '../types';
import { SettingsForm } from './SettingsForm';

type Props = {
  quiz: QuizListItem | null;
  onClose: () => void;
};

export function StartSessionDialog({ quiz, onClose }: Props) {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<{ quizId: string; value: QuizSettings } | null>(null);
  const [frame, setFrame] = useState<{ top: number; maxHeight: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const open = Boolean(quiz);
  const quizId = quiz?.id ?? null;
  if (draft && draft.quizId !== quizId) setDraft(null);

  const defaults = useQuery({ queryKey: ['live-quiz', 'settings'], queryFn: liveQuizApi.getSettings, enabled: open });
  const detail = useQuery({
    queryKey: ['live-quiz', 'quiz', quiz?.id],
    queryFn: () => liveQuizApi.getQuiz(quiz!.id),
    enabled: open,
  });

  const base =
    defaults.data && detail.data ? { ...defaults.data.settings, ...(detail.data.settings ?? {}) } : null;
  const settings = draft && draft.quizId === quizId ? draft.value : base;
  const setSettings = (next: QuizSettings) => {
    if (!quizId) return;
    setDraft({ quizId, value: next });
  };

  useEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    if (!viewport) return;
    const place = () => {
      setFrame({
        top: viewport.offsetTop + viewport.height / 2,
        maxHeight: Math.min(viewport.height * 0.9, viewport.height - 16),
      });
    };
    const frameId = window.requestAnimationFrame(place);
    viewport.addEventListener('resize', place);
    viewport.addEventListener('scroll', place);
    return () => {
      window.cancelAnimationFrame(frameId);
      viewport.removeEventListener('resize', place);
      viewport.removeEventListener('scroll', place);
    };
  }, [open]);

  const start = async () => {
    if (!quiz || !settings) return;
    setSubmitting(true);
    try {
      const session = await liveQuizApi.createSession(quiz.id, settings);
      toast.success(`Sesi dibuat. PIN: ${session.pin}`);
      navigate(`/admin/live-quiz/host/${session.id}`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Gagal membuat sesi.'));
      setSubmitting(false);
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && !submitting) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/60" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[min(90dvh,calc(100svh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-16px))] w-[min(1040px,calc(100vw-48px))] max-w-none -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_24px_48px_-12px_rgba(15,23,42,0.28)] focus:outline-none max-sm:w-[calc(100vw-1rem-env(safe-area-inset-left)-env(safe-area-inset-right))]"
          style={frame ? { top: frame.top, maxHeight: frame.maxHeight } : undefined}
          onInteractOutside={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => {
            if (submitting) event.preventDefault();
          }}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-6 sm:py-6">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-brand-500">Mulai sesi live</p>
              <Dialog.Title className="mt-1 break-words text-[22px] font-bold leading-snug text-[#17243D] sm:text-2xl">
                {quiz?.title}
              </Dialog.Title>
              <Dialog.Description className="mt-1.5 text-[13px] leading-relaxed text-slate-500 sm:text-sm">
                {quiz?.questionCount ?? 0} soal. Atur pengaturan sesi ini; PIN dan kode QR dibuat setelah sesi dibuat.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                aria-label="Tutup"
                disabled={submitting}
              >
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
            {settings ? (
              <SettingsForm value={settings} onChange={setSettings} />
            ) : (
              <p className="py-10 text-center text-sm text-slate-500">Memuat pengaturan…</p>
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-2 border-t border-slate-200 bg-white px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:px-6">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="h-12 w-full whitespace-normal px-5 text-[15px] sm:w-auto sm:whitespace-nowrap"
            >
              Batal
            </Button>
            <Button
              onClick={start}
              isLoading={submitting}
              disabled={!settings}
              className="h-12 w-full whitespace-normal bg-brand-500 px-5 text-[15px] sm:w-auto sm:whitespace-nowrap"
            >
              <Radio className="h-4 w-4 shrink-0" />
              Buat sesi & buka layar tutor
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
