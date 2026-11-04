import { Fragment, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import katex from 'katex';
import confetti from 'canvas-confetti';
import { ArrowDown, ArrowUp, Minus, Music2, Volume2, VolumeX, Wifi } from 'lucide-react';
import { getAssetUrl } from '@/lib/media';
import { cn } from '@/utils/cn';
import { liveAudio } from '../audio';
import 'katex/dist/katex.min.css';
import '../live-quiz.css';

/* ------------------------------------------------------------------ */
/* Teks soal: teks biasa + rumus KaTeX ($...$ / $$...$$)                */
/* ------------------------------------------------------------------ */

type Segment = { kind: 'text' | 'math' | 'block'; value: string };

export function splitMath(input: string): Segment[] {
  const segments: Segment[] = [];
  const pattern = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(input)) !== null) {
    if (match.index > last) segments.push({ kind: 'text', value: input.slice(last, match.index) });
    if (match[1] !== undefined) segments.push({ kind: 'block', value: match[1] });
    else segments.push({ kind: 'math', value: match[2] ?? '' });
    last = match.index + match[0].length;
  }
  if (last < input.length) segments.push({ kind: 'text', value: input.slice(last) });
  return segments;
}

/**
 * Teks soal ditampilkan sebagai teks murni (React meng-escape); hanya keluaran KaTeX
 * (trust: false) yang disisipkan sebagai HTML sehingga tidak ada celah XSS dari isi soal.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  const parts = useMemo(() => splitMath(text), [text]);
  return (
    <span className={cn('whitespace-pre-wrap break-words', className)}>
      {parts.map((part, index) => {
        if (part.kind === 'text') return <Fragment key={index}>{part.value}</Fragment>;
        const html = katex.renderToString(part.value, {
          throwOnError: false,
          displayMode: part.kind === 'block',
          trust: false,
          output: 'htmlAndMathml',
        });
        return (
          <span
            key={index}
            className={part.kind === 'block' ? 'my-2 block overflow-x-auto' : undefined}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </span>
  );
}

export function OptionContent({ label, imageUrl, className }: { label: string | null; imageUrl: string | null; className?: string }) {
  return (
    <span className={cn('flex min-w-0 flex-1 flex-col gap-2 text-left', className)}>
      {imageUrl && (
        <img src={getAssetUrl(imageUrl)} alt="" className="max-h-32 w-auto max-w-full rounded-lg bg-white/10 object-contain" />
      )}
      {label ? <RichText text={label} /> : null}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Waktu berbasis jam server                                            */
/* ------------------------------------------------------------------ */

/** Sisa ms hingga deadline (jam server), diperbarui ~10x/detik. */
export function useRemainingMs(deadlineAt: number | null | undefined, getNow: () => number, active = true) {
  const compute = () => (deadlineAt ? Math.max(0, deadlineAt - getNow()) : 0);
  const [remaining, setRemaining] = useState(compute);
  const getNowRef = useRef(getNow);
  getNowRef.current = getNow;
  useEffect(() => {
    if (!active || !deadlineAt) {
      setRemaining(0);
      return;
    }
    const update = () => setRemaining(Math.max(0, deadlineAt - getNowRef.current()));
    update();
    const timer = window.setInterval(update, 100);
    return () => window.clearInterval(timer);
  }, [deadlineAt, active]);
  return remaining;
}

/** Timer lingkaran: emas -> oranye -> merah, berdenyut saat <= 5 detik. */
export function TimerRing({
  remainingMs,
  totalMs,
  size = 96,
  className,
  pulse = true,
}: {
  remainingMs: number;
  totalMs: number;
  size?: number;
  className?: string;
  pulse?: boolean;
}) {
  const fraction = totalMs > 0 ? Math.min(1, remainingMs / totalMs) : 0;
  const stroke = Math.max(6, size / 11);
  const radius = (size - stroke - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const urgent = remainingMs <= 5000;
  const warn = remainingMs <= 10000;
  const color = urgent ? '#EF476F' : warn ? '#FF9F43' : '#FFD166';
  return (
    <div
      className={cn('relative shrink-0', urgent && pulse && 'lq-pulse', className)}
      style={{ width: size, height: size }}
      role="timer"
      aria-label={`Sisa waktu ${Math.ceil(remainingMs / 1000)} detik`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.16)" strokeWidth={stroke} fill="rgba(8,27,51,0.55)" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          style={{ transition: 'stroke-dashoffset 120ms linear, stroke 200ms' }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-black tabular-nums text-white"
        style={{ fontSize: size * 0.36, color: urgent ? '#FFB3C4' : '#fff' }}
      >
        {Math.ceil(remainingMs / 1000)}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Angka beranimasi                                                      */
/* ------------------------------------------------------------------ */

export function AnimatedNumber({
  value,
  from = 0,
  durationMs = 900,
  animate = true,
  className,
}: {
  value: number;
  from?: number;
  durationMs?: number;
  animate?: boolean;
  className?: string;
}) {
  const [display, setDisplay] = useState(animate ? from : value);
  useEffect(() => {
    if (!animate) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, from, durationMs, animate]);
  return <span className={cn('tabular-nums', className)}>{display.toLocaleString('id-ID')}</span>;
}

/* ------------------------------------------------------------------ */
/* Kontrol suara (musik & efek terpisah)                                  */
/* ------------------------------------------------------------------ */

export function useAudioPrefs() {
  return useSyncExternalStore(
    (listener) => liveAudio.subscribe(listener),
    () => liveAudio.getSnapshot(),
  );
}

export function SoundToggle({ className, showVolume = false }: { className?: string; showVolume?: boolean }) {
  useAudioPrefs();
  const [open, setOpen] = useState(false);
  const muted = liveAudio.muted;
  return (
    <div className={cn('relative flex items-center gap-2', className)}>
      <button
        type="button"
        onClick={() => {
          liveAudio.unlock();
          liveAudio.setMuted(!muted);
        }}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        aria-label={muted ? 'Nyalakan suara' : 'Matikan suara'}
        aria-pressed={!muted}
      >
        {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      </button>
      {showVolume && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Atur volume musik dan efek"
            aria-expanded={open}
          >
            <Music2 className="h-5 w-5" />
          </button>
          {open && (
            <div className="lq-glass absolute right-0 top-12 z-40 w-56 space-y-3 rounded-2xl bg-[#081b33]/95 p-4 text-sm text-white">
              <label className="block">
                <span className="mb-1 flex justify-between font-semibold">
                  Musik <span className="tabular-nums text-white/70">{Math.round(liveAudio.musicVolume * 100)}%</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={liveAudio.musicVolume}
                  onChange={(event) => {
                    liveAudio.unlock();
                    liveAudio.setMusicVolume(Number(event.target.value));
                    if (liveAudio.muted) liveAudio.setMuted(false);
                  }}
                  className="w-full accent-amber-300"
                  aria-label="Volume musik"
                />
              </label>
              <label className="block">
                <span className="mb-1 flex justify-between font-semibold">
                  Efek suara <span className="tabular-nums text-white/70">{Math.round(liveAudio.sfxVolume * 100)}%</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={liveAudio.sfxVolume}
                  onChange={(event) => {
                    liveAudio.unlock();
                    liveAudio.setSfxVolume(Number(event.target.value));
                    if (liveAudio.muted) liveAudio.setMuted(false);
                  }}
                  onPointerUp={() => liveAudio.play('select')}
                  className="w-full accent-amber-300"
                  aria-label="Volume efek suara"
                />
              </label>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Browser memblokir audio sebelum ada interaksi; tombol ini membukanya dengan satu ketukan. */
export function AudioUnlockHint({ enabled = true, className }: { enabled?: boolean; className?: string }) {
  useAudioPrefs();
  if (!enabled || liveAudio.isUnlocked || liveAudio.muted) return null;
  return (
    <button
      type="button"
      onClick={() => liveAudio.unlock()}
      className={cn('lq-btn lq-btn-gold px-4 py-2 text-sm', className)}
    >
      <Volume2 className="h-4 w-4" /> Ketuk untuk aktifkan suara
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Delta peringkat                                                        */
/* ------------------------------------------------------------------ */

export function RankDelta({ delta }: { delta: number | null | undefined }) {
  if (delta === null || delta === undefined || delta === 0) {
    return <Minus className="h-4 w-4 text-white/40" aria-label="Tidak berubah" />;
  }
  return delta > 0 ? (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-400/20 px-1.5 text-sm font-bold text-emerald-300" aria-label={`Naik ${delta}`}>
      <ArrowUp className="h-4 w-4" />
      {delta}
    </span>
  ) : (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-400/20 px-1.5 text-sm font-bold text-rose-300" aria-label={`Turun ${Math.abs(delta)}`}>
      <ArrowDown className="h-4 w-4" />
      {Math.abs(delta)}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Confetti                                                               */
/* ------------------------------------------------------------------ */

const CONFETTI_COLORS = ['#FFD166', '#2575FC', '#2DD4A7', '#F36FB6', '#8056ED', '#19C6E6', '#FFFFFF'];

export function fireConfetti(options: { enabled: boolean; intensity?: 'big' | 'small' }) {
  if (!options.enabled) return;
  const big = options.intensity !== 'small';
  const colors = CONFETTI_COLORS;
  confetti({ particleCount: big ? 140 : 60, spread: 80, origin: { y: 0.65 }, colors, disableForReducedMotion: true });
  if (big) {
    window.setTimeout(() => confetti({ particleCount: 90, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors, disableForReducedMotion: true }), 250);
    window.setTimeout(() => confetti({ particleCount: 90, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors, disableForReducedMotion: true }), 450);
  }
}

/* ------------------------------------------------------------------ */
/* Kerangka layar                                                         */
/* ------------------------------------------------------------------ */

export function ReconnectBanner({ show, text = 'Menghubungkan ulang…' }: { show: boolean; text?: string }) {
  if (!show) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-gradient-to-r from-amber-300 to-orange-400 px-4 py-2 text-center text-sm font-black text-slate-900"
    >
      <Wifi className="h-4 w-4 animate-pulse" /> {text}
    </div>
  );
}

export function CenterCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('lq-glass mx-auto w-full max-w-md rounded-[2rem] p-8 text-center text-white', className)}>{children}</div>
  );
}
