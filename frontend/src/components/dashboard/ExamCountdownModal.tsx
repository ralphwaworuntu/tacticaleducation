import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';

type CountdownContentProps = {
  title: string;
  subtitle?: string;
  warning?: string | null;
  onComplete: () => void;
  onCancel: () => void;
  initialSeconds: number;
};

function CountdownContent({
  title,
  subtitle,
  warning,
  onComplete,
  onCancel,
  initialSeconds,
}: CountdownContentProps) {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (seconds !== 0) return;
    const timer = window.setTimeout(() => {
      onComplete();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [onComplete, seconds]);

  const showWarning = warning !== null;
  const warningText = warning ?? 'Ujian akan diblokir jika Anda meninggalkan halaman ini sebelum selesai.';

  return (
    <div className="w-full max-w-lg text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-brand-300">Persiapan</p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h2>
      {subtitle ? <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-slate-300">{subtitle}</p> : null}
      <div className="mx-auto mt-10 flex h-40 w-40 items-center justify-center rounded-full bg-white text-7xl font-bold tabular-nums text-brand-700 shadow-[0_20px_60px_rgba(0,0,0,0.45)] ring-8 ring-white/15 sm:h-44 sm:w-44 sm:text-8xl">
        {seconds}
      </div>
      <p className="mt-5 text-sm font-medium text-slate-400">Dimulai otomatis setelah hitungan selesai</p>
      {showWarning ? (
        <p className="mx-auto mt-6 max-w-md rounded-2xl border border-red-400/30 bg-red-500/15 px-4 py-3 text-sm font-semibold text-red-200">
          {warningText}
        </p>
      ) : null}
      <div className="mt-8 flex justify-center">
        <Button
          variant="ghost"
          className="text-slate-300 hover:bg-white/10 hover:text-white"
          onClick={onCancel}
        >
          Batalkan
        </Button>
      </div>
    </div>
  );
}

type ExamCountdownModalProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  initialSeconds?: number;
  warning?: string | null;
  onComplete: () => void;
  onCancel: () => void;
  resetKey?: number;
  /** Kept for compatibility; countdown is always solid/opaque. */
  variant?: 'default' | 'focus';
};

export function ExamCountdownModal({
  open,
  title,
  subtitle,
  warning,
  onComplete,
  onCancel,
  initialSeconds = 5,
  resetKey,
}: ExamCountdownModalProps) {
  if (!open || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[9999] flex h-[100dvh] w-screen items-center justify-center bg-slate-950 px-4',
      )}
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(37,99,235,0.28),_transparent_58%)]"
      />
      <div className="relative">
        <CountdownContent
          key={resetKey}
          title={title}
          subtitle={subtitle}
          warning={warning}
          onComplete={onComplete}
          onCancel={onCancel}
          initialSeconds={initialSeconds}
        />
      </div>
    </div>,
    document.body,
  );
}
