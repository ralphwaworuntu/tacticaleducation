import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

type CountdownContentProps = {
  title: string;
  subtitle?: string;
  warning?: string | null;
  onComplete: () => void;
  onCancel: () => void;
  initialSeconds: number;
};

function CountdownContent({ title, subtitle, warning, onComplete, onCancel, initialSeconds }: CountdownContentProps) {
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
    <div className="w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl">
      <p className="text-xs uppercase tracking-[0.4em] text-brand-500">Persiapan Ujian</p>
      <h2 className="mt-2 text-2xl font-semibold text-slate-900">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      <div className="mt-6 text-6xl font-bold text-brand-600">{seconds}</div>
      {showWarning && <p className="mt-4 text-sm font-semibold text-red-500">{warningText}</p>}
      <div className="mt-6 flex justify-center gap-3">
        <Button variant="ghost" onClick={onCancel}>
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
};

export function ExamCountdownModal({ open, title, subtitle, warning, onComplete, onCancel, initialSeconds = 5, resetKey }: ExamCountdownModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4">
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
  );
}
