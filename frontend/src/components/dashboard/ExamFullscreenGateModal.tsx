import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';

type ExamFullscreenGateModalProps = {
  open: boolean;
  eyebrow: string;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ExamFullscreenGateModal({
  open,
  eyebrow,
  title = 'Aktifkan Layar Penuh',
  description = 'Klik tombol di bawah untuk masuk fullscreen. Setelah itu hitung mundur akan dimulai.',
  confirmLabel = 'Aktifkan Layar Penuh',
  cancelLabel = 'Batal',
  loading = false,
  onConfirm,
  onCancel,
}: ExamFullscreenGateModalProps) {
  if (!open || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center px-4"
      style={{
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="exam-fullscreen-gate-title"
    >
      {/* Backdrop: gelap + blur kuat agar teks modal jelas */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl backdrop-saturate-150"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-slate-950/40 via-transparent to-slate-950/50"
      />

      <div className="relative z-10 w-full max-w-md rounded-3xl bg-white p-6 text-center shadow-2xl">
        <p className="text-xs uppercase tracking-[0.4em] text-brand-500">{eyebrow}</p>
        <h2 id="exam-fullscreen-gate-title" className="mt-2 text-2xl font-semibold text-slate-900">
          {title}
        </h2>
        <p className="mt-2 text-sm text-slate-500">{description}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button onClick={onConfirm} disabled={loading} isLoading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
