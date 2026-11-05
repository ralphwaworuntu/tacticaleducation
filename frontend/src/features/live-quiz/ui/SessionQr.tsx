import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Maximize2, Minus, Plus, RotateCcw, X } from 'lucide-react';
import { formatPin } from '../format';

const STORAGE_KEY = 'tactical-lq-qr-size';
const MIN_SIZE = 160;
const MAX_SIZE = 600;
const DEFAULT_SIZE = 240;

function readStoredSize() {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY));
    if (!Number.isFinite(value)) return DEFAULT_SIZE;
    return Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(value)));
  } catch {
    return DEFAULT_SIZE;
  }
}

function fitSize(preferred: number, space: number) {
  const room = Math.max(96, Math.floor(space));
  return Math.min(preferred, room, MAX_SIZE);
}

/**
 * QR masuk sesi. Ukuran hanya tampilan: URL dan PIN tidak berubah.
 * SVG + quiet zone 4 modul agar tetap bisa dipindai saat diperbesar.
 */
export function SessionQr({ url, pin, title }: { url: string; pin: string; title: string }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [preferred, setPreferred] = useState(readStoredSize);
  const [frameWidth, setFrameWidth] = useState(DEFAULT_SIZE);
  const [full, setFull] = useState(false);
  const [viewport, setViewport] = useState({ w: 800, h: 600 });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(preferred));
    } catch {
      /* preferensi lokal opsional */
    }
  }, [preferred]);

  useEffect(() => {
    const node = frameRef.current;
    if (!node) return;
    const measure = () => setFrameWidth(node.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!full) return;
    const measure = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    measure();
    window.addEventListener('resize', measure);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFull(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('keydown', onKey);
    };
  }, [full]);

  const setSize = (next: number) => setPreferred(Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(next))));
  const shown = fitSize(preferred, frameWidth - 8);
  const fullSize = fitSize(Math.max(preferred, 420), Math.min(viewport.w - 48, viewport.h - 280));

  return (
    <div className="flex w-full min-w-0 flex-col items-center gap-3">
      <div ref={frameRef} className="flex w-full min-w-0 justify-center overflow-hidden">
        <div className="rounded-3xl bg-white p-3 shadow-2xl">
          <QRCodeSVG value={url} size={shown} level="H" marginSize={4} bgColor="#ffffff" fgColor="#102A43" title="QR masuk Live Quiz" />
        </div>
      </div>

      <div className="flex w-full min-w-0 flex-wrap items-center justify-center gap-2">
        <button type="button" className="lq-qr-ctl" onClick={() => setSize(preferred - 40)} aria-label="Perkecil QR Code">
          <Minus className="h-4 w-4" />
        </button>
        <input
          className="h-2 min-w-[8rem] flex-1 accent-[#17336B]"
          type="range"
          min={MIN_SIZE}
          max={MAX_SIZE}
          step={10}
          value={preferred}
          aria-label="Ukuran QR Code"
          onChange={(event) => setSize(Number(event.target.value))}
        />
        <button type="button" className="lq-qr-ctl" onClick={() => setSize(preferred + 40)} aria-label="Perbesar QR Code">
          <Plus className="h-4 w-4" />
        </button>
        <button type="button" className="lq-qr-ctl px-3 text-xs font-bold" onClick={() => setSize(DEFAULT_SIZE)}>
          <RotateCcw className="h-3.5 w-3.5" />
          Reset Ukuran
        </button>
        <button type="button" className="lq-qr-ctl px-3 text-xs font-bold" onClick={() => setFull(true)}>
          <Maximize2 className="h-3.5 w-3.5" />
          Tampilkan QR Code Layar Penuh
        </button>
      </div>

      {full && (
        <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-4 overflow-y-auto bg-[#081b33] px-4 py-6 text-center text-white">
          <p className="max-w-3xl text-2xl font-black sm:text-4xl">{title}</p>
          <p className="text-sm font-black uppercase tracking-[0.35em] text-sky-200">PIN Game</p>
          <p className="text-5xl font-black tracking-widest text-amber-300 sm:text-7xl">{formatPin(pin)}</p>
          <div className="rounded-3xl bg-white p-4 shadow-2xl">
            <QRCodeSVG value={url} size={fullSize} level="H" marginSize={4} bgColor="#ffffff" fgColor="#102A43" title="QR masuk Live Quiz" />
          </div>
          <p className="max-w-xl text-base font-semibold text-sky-100 sm:text-lg">
            Arahkan kamera HP ke QR, atau buka tautan lalu masukkan PIN {formatPin(pin)}.
          </p>
          <button type="button" className="lq-btn lq-btn-gold h-12 px-6 text-base" onClick={() => setFull(false)}>
            <X className="h-5 w-5" />
            Keluar Layar Penuh
          </button>
        </div>
      )}
    </div>
  );
}
