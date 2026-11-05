import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/utils/cn';
import '../live-quiz.css';

type Props = {
  src: string;
  alt?: string;
  className?: string;
  /** Tutor dapat membuka gambar lebih besar. Tidak menjeda timer atau sesi. */
  enlarge?: boolean;
};

export function QuizImage({ src, alt = '', className, enlarge = false }: Props) {
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(src);
  if (seen !== src) {
    setSeen(src);
    setFailed(false);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!src) return null;
  if (failed) return <span className="text-xs font-semibold opacity-80">Gambar tidak dapat dimuat</span>;

  const image = (
    <img src={src} alt={alt} decoding="async" className={cn('lq-fit-image', className)} onError={() => setFailed(true)} />
  );

  return (
    <>
      {enlarge ? (
        <button type="button" className="lq-image-button" onClick={() => setOpen(true)} aria-label="Perbesar gambar">
          {image}
        </button>
      ) : (
        image
      )}
      {open &&
        createPortal(
          <div className="lq-lightbox" role="dialog" aria-modal="true" aria-label="Gambar diperbesar" onClick={() => setOpen(false)}>
            <button type="button" className="lq-lightbox-close" aria-label="Tutup gambar" onClick={() => setOpen(false)}>
              <X className="h-5 w-5" />
              Tutup
            </button>
            <img src={src} alt={alt} className="lq-lightbox-image" decoding="async" onClick={(event) => event.stopPropagation()} />
          </div>,
          document.body,
        )}
    </>
  );
}
