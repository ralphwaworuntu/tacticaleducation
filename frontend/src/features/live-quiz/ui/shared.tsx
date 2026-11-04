import { Fragment, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import katex from 'katex';
import confetti from 'canvas-confetti';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, ArrowUp, Anchor, Crosshair, Crown, Flag, Hexagon, Medal, Minus, Shield, Star, Volume2, VolumeX, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getAssetUrl } from '@/lib/media';
import { cn } from '@/utils/cn';
import { liveAudio } from '../audio';
import type { LeaderboardEntry, PodiumRow } from '../types';
import 'katex/dist/katex.min.css';

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

/* ------------------------------------------------------------------ */
/* Gaya pilihan jawaban (warna + huruf + ikon agar tidak bergantung warna) */
/* ------------------------------------------------------------------ */

export const OPTION_STYLES: Array<{ bg: string; ring: string; icon: LucideIcon; letter: string }> = [
  { bg: 'bg-blue-600', ring: 'ring-blue-300', icon: Shield, letter: 'A' },
  { bg: 'bg-emerald-600', ring: 'ring-emerald-300', icon: Star, letter: 'B' },
  { bg: 'bg-amber-600', ring: 'ring-amber-300', icon: Crosshair, letter: 'C' },
  { bg: 'bg-rose-600', ring: 'ring-rose-300', icon: Flag, letter: 'D' },
  { bg: 'bg-violet-600', ring: 'ring-violet-300', icon: Zap, letter: 'E' },
  { bg: 'bg-cyan-700', ring: 'ring-cyan-300', icon: Anchor, letter: 'F' },
];

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

export { Hexagon };

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

export function TimerRing({ remainingMs, totalMs, size = 96, className }: { remainingMs: number; totalMs: number; size?: number; className?: string }) {
  const fraction = totalMs > 0 ? Math.min(1, remainingMs / totalMs) : 0;
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const urgent = remainingMs <= 5000;
  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }} role="timer" aria-label={`Sisa waktu ${Math.ceil(remainingMs / 1000)} detik`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.15)" strokeWidth={8} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={urgent ? '#f87171' : '#fbbf24'}
          strokeWidth={8}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          style={{ transition: 'stroke-dashoffset 120ms linear, stroke 200ms' }}
        />
      </svg>
      <span className={cn('absolute inset-0 flex items-center justify-center text-3xl font-black tabular-nums text-white', urgent && 'text-red-300')}>
        {Math.ceil(remainingMs / 1000)}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Angka beranimasi                                                      */
/* ------------------------------------------------------------------ */

export function AnimatedNumber({ value, from = 0, durationMs = 900, animate = true, className }: { value: number; from?: number; durationMs?: number; animate?: boolean; className?: string }) {
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
/* Kontrol suara                                                         */
/* ------------------------------------------------------------------ */

export function useAudioPrefs() {
  return useSyncExternalStore(
    (listener) => liveAudio.subscribe(listener),
    () => `${liveAudio.muted}:${liveAudio.volume}`,
  );
}

export function SoundToggle({ className, showVolume = false }: { className?: string; showVolume?: boolean }) {
  useAudioPrefs();
  const muted = liveAudio.muted;
  return (
    <div className={cn('flex items-center gap-2', className)}>
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
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={liveAudio.volume}
          onChange={(event) => {
            liveAudio.unlock();
            liveAudio.setVolume(Number(event.target.value));
            if (liveAudio.muted) liveAudio.setMuted(false);
          }}
          className="w-24 accent-amber-400"
          aria-label="Volume"
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Delta peringkat & leaderboard                                          */
/* ------------------------------------------------------------------ */

export function RankDelta({ delta }: { delta: number | null | undefined }) {
  if (delta === null || delta === undefined || delta === 0) {
    return <Minus className="h-4 w-4 text-white/40" aria-label="Tidak berubah" />;
  }
  return delta > 0 ? (
    <span className="inline-flex items-center gap-0.5 text-sm font-bold text-emerald-300" aria-label={`Naik ${delta}`}>
      <ArrowUp className="h-4 w-4" />
      {delta}
    </span>
  ) : (
    <span className="inline-flex items-center gap-0.5 text-sm font-bold text-rose-300" aria-label={`Turun ${Math.abs(delta)}`}>
      <ArrowDown className="h-4 w-4" />
      {Math.abs(delta)}
    </span>
  );
}

export function Leaderboard({
  entries,
  animate,
  highlightId,
  large = false,
}: {
  entries: LeaderboardEntry[];
  animate: boolean;
  highlightId?: string | null;
  large?: boolean;
}) {
  // Mulai dari urutan sebelumnya (rank + delta) lalu pindah ke urutan baru agar perubahan posisi terlihat.
  const previousOrder = useMemo(
    () => [...entries].sort((a, b) => (a.rank + (a.delta ?? 0)) - (b.rank + (b.delta ?? 0)) || a.rank - b.rank),
    [entries],
  );
  const [showFinal, setShowFinal] = useState(!animate);
  useEffect(() => {
    if (!animate) {
      setShowFinal(true);
      return;
    }
    setShowFinal(false);
    const timer = window.setTimeout(() => setShowFinal(true), 900);
    return () => window.clearTimeout(timer);
  }, [entries, animate]);

  const ordered = showFinal ? entries : previousOrder;
  return (
    <ol className={cn('mx-auto w-full space-y-2', large ? 'max-w-3xl' : 'max-w-xl')}>
      {ordered.map((entry, index) => {
        const shownRank = showFinal ? entry.rank : (entry.delta !== null ? entry.rank + entry.delta : index + 1);
        return (
          <motion.li
            key={entry.playerId}
            layout={animate}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            className={cn(
              'flex items-center gap-4 rounded-2xl px-5 py-3 text-white shadow-lg',
              large ? 'text-2xl' : 'text-lg',
              entry.playerId === highlightId ? 'bg-amber-500/90 text-slate-900' : 'bg-white/10 backdrop-blur',
            )}
          >
            <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-black', shownRank <= 3 ? 'bg-amber-400 text-slate-900' : 'bg-white/15')}>
              {shownRank}
            </span>
            <span className="min-w-0 flex-1 truncate font-bold">{entry.name}</span>
            <RankDelta delta={showFinal ? entry.delta : null} />
            <span className="w-28 text-right font-black tabular-nums">{entry.totalScore.toLocaleString('id-ID')}</span>
          </motion.li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* Confetti                                                               */
/* ------------------------------------------------------------------ */

export function fireConfetti(options: { enabled: boolean; intensity?: 'big' | 'small' }) {
  if (!options.enabled) return;
  const big = options.intensity !== 'small';
  const colors = ['#fbbf24', '#38bdf8', '#34d399', '#f472b6', '#ffffff'];
  confetti({ particleCount: big ? 140 : 60, spread: 80, origin: { y: 0.65 }, colors });
  if (big) {
    window.setTimeout(() => confetti({ particleCount: 90, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors }), 250);
    window.setTimeout(() => confetti({ particleCount: 90, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors }), 450);
  }
}

/* ------------------------------------------------------------------ */
/* Podium 3 - 2 - 1                                                       */
/* ------------------------------------------------------------------ */

const PODIUM_HEIGHT: Record<number, string> = { 1: 'h-64', 2: 'h-48', 3: 'h-36' };
const PODIUM_COLOR: Record<number, string> = {
  1: 'from-amber-300 to-amber-500',
  2: 'from-slate-200 to-slate-400',
  3: 'from-orange-300 to-orange-500',
};

export function Podium({
  podium,
  animate,
  confettiEnabled,
  onDrumroll,
  onReveal,
}: {
  podium: PodiumRow[];
  animate: boolean;
  confettiEnabled: boolean;
  onDrumroll?: () => void;
  onReveal?: (rank: number) => void;
}) {
  // Urutan pengungkapan: peringkat terendah dulu (3 -> 2 -> 1).
  const revealOrder = useMemo(() => [...podium].sort((a, b) => b.rank - a.rank), [podium]);
  const [revealed, setRevealed] = useState(animate ? 0 : revealOrder.length);
  const callbacks = useRef({ onDrumroll, onReveal });
  callbacks.current = { onDrumroll, onReveal };

  useEffect(() => {
    if (!animate) {
      setRevealed(revealOrder.length);
      return;
    }
    setRevealed(0);
    callbacks.current.onDrumroll?.();
    const timers: number[] = [];
    revealOrder.forEach((row, index) => {
      timers.push(
        window.setTimeout(() => {
          setRevealed(index + 1);
          callbacks.current.onReveal?.(row.rank);
          if (row.rank === 1) fireConfetti({ enabled: confettiEnabled });
        }, 1800 + index * 2200),
      );
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate, revealOrder.length]);

  // Tata letak visual: 2 - 1 - 3
  const slots = [2, 1, 3].map((rank) => podium.find((p) => p.rank === rank)).filter(Boolean) as PodiumRow[];
  const isRevealed = (row: PodiumRow) => revealOrder.findIndex((r) => r.playerId === row.playerId) < revealed;

  if (!podium.length) return null;
  return (
    <div className="mx-auto flex w-full max-w-4xl items-end justify-center gap-3 px-2 sm:gap-6" aria-label="Podium pemenang">
      {slots.map((row) => (
        <div key={row.playerId} className="flex w-1/3 max-w-[16rem] flex-col items-center">
          <AnimatePresence>
            {isRevealed(row) && (
              <motion.div
                initial={animate ? { opacity: 0, y: 40, scale: 0.8 } : false}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 220, damping: 18 }}
                className="mb-3 w-full text-center text-white"
              >
                {row.rank === 1 ? <Crown className="mx-auto mb-1 h-10 w-10 text-amber-300" /> : <Medal className={cn('mx-auto mb-1 h-8 w-8', row.rank === 2 ? 'text-slate-200' : 'text-orange-300')} />}
                <p className="truncate text-lg font-black sm:text-2xl">{row.name}</p>
                <p className="text-base font-bold text-amber-200 sm:text-xl">
                  <AnimatedNumber value={row.totalScore} animate={animate} durationMs={1200} />
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          <motion.div
            initial={false}
            animate={{ opacity: isRevealed(row) ? 1 : 0.25 }}
            className={cn('flex w-full items-start justify-center rounded-t-2xl bg-gradient-to-b pt-3 text-5xl font-black text-slate-900 shadow-2xl', PODIUM_HEIGHT[row.rank] ?? 'h-32', PODIUM_COLOR[row.rank] ?? 'from-slate-300 to-slate-500')}
          >
            {row.rank}
          </motion.div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Latar & kerangka layar                                                 */
/* ------------------------------------------------------------------ */

export const liveBackground: CSSProperties = {
  background:
    'radial-gradient(1200px 600px at 15% -10%, rgba(56,189,248,0.18), transparent 60%), radial-gradient(900px 500px at 100% 0%, rgba(251,191,36,0.14), transparent 55%), linear-gradient(160deg, #0b1a45 0%, #0f255c 55%, #081133 100%)',
};

export function ReconnectBanner({ show, text = 'Menghubungkan ulang…' }: { show: boolean; text?: string }) {
  if (!show) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-50 bg-amber-400 px-4 py-2 text-center text-sm font-bold text-slate-900">
      {text}
    </div>
  );
}

export function CenterCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('mx-auto w-full max-w-md rounded-3xl bg-white/10 p-8 text-center text-white shadow-2xl backdrop-blur', className)}>
      {children}
    </div>
  );
}
