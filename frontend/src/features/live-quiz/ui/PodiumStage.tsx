import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Crown, Medal, SkipForward, Trophy } from 'lucide-react';
import { cn } from '@/utils/cn';
import { PlayerAvatar } from '../avatars';
import type { PodiumRow } from '../types';
import { AnimatedNumber, fireConfetti } from './shared';

export type PodiumEvent = 'lights' | 'podium' | 'avatar' | 'winner' | 'trophy' | 'list';

type Step = { at: number; key: string; kind: PodiumEvent; position?: number };

const BLOCK: Record<number, { height: string; gradient: string; label: string; medal: string }> = {
  0: { height: 'clamp(9rem, 26vh, 15rem)', gradient: 'linear-gradient(180deg,#FFE9A8 0%,#FFD166 45%,#E9A92F 100%)', label: '#4a2f00', medal: '#FFD166' },
  1: { height: 'clamp(6.5rem, 19vh, 11rem)', gradient: 'linear-gradient(180deg,#F6F9FE 0%,#C8D3E6 50%,#9AA9C2 100%)', label: '#1f2d44', medal: '#D6DFEE' },
  2: { height: 'clamp(5rem, 14vh, 8rem)', gradient: 'linear-gradient(180deg,#FFD0A0 0%,#F0A05A 50%,#C9742B 100%)', label: '#4a2500', medal: '#F0A05A' },
};

/**
 * Urutan animasi FINAL CHAMPIONS:
 * lampu panggung -> podium 3 -> avatar 3 -> podium 2 -> avatar 2 -> podium 1 -> avatar 1 (animasi utama)
 * -> piala/medali -> konfeti -> musik kemenangan -> semua juara.
 */
function buildTimeline(count: number): Step[] {
  const steps: Step[] = [{ at: 350, key: 'lights', kind: 'lights' }];
  let t = 1250;
  for (let position = Math.min(count, 3) - 1; position >= 0; position -= 1) {
    steps.push({ at: t, key: `podium-${position}`, kind: 'podium', position });
    t += 850;
    steps.push({ at: t, key: `avatar-${position}`, kind: position === 0 ? 'winner' : 'avatar', position });
    t += position === 0 ? 1500 : 1150;
  }
  steps.push({ at: t, key: 'trophy', kind: 'trophy' });
  t += 1900;
  steps.push({ at: t, key: 'list', kind: 'list' });
  return steps;
}

export function PodiumStage({
  podium,
  rest = [],
  animate,
  fancy,
  onEvent,
  className,
}: {
  podium: PodiumRow[];
  /** Peringkat 4 dst. (ditampilkan sebagai "semua juara" setelah podium selesai). */
  rest?: PodiumRow[];
  animate: boolean;
  /** Efek berat (sinar, konfeti). Dimatikan pada mode lite. */
  fancy: boolean;
  onEvent?: (event: PodiumEvent, position?: number) => void;
  className?: string;
}) {
  const rows = useMemo(() => [...podium].sort((a, b) => a.rank - b.rank).slice(0, 3), [podium]);
  const timeline = useMemo(() => buildTimeline(rows.length), [rows.length]);
  const allKeys = useMemo(() => timeline.map((s) => s.key), [timeline]);
  const [shown, setShown] = useState<Set<string>>(() => new Set(animate ? [] : allKeys));
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!animate) {
      setShown(new Set(allKeys));
      return;
    }
    setShown(new Set());
    const timers = timeline.map((step) =>
      window.setTimeout(() => {
        setShown((prev) => new Set(prev).add(step.key));
        onEventRef.current?.(step.kind, step.position);
        if (step.kind === 'trophy') fireConfetti({ enabled: fancy });
      }, step.at),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [animate, fancy, timeline, allKeys]);

  const has = (key: string) => shown.has(key);
  const finished = has('list');
  const skip = () => {
    setShown(new Set(allKeys));
    onEventRef.current?.('trophy');
  };

  if (!rows.length) return null;
  // Tata letak visual: 2 - 1 - 3 (posisi 1 = juara pertama di tengah).
  const layout = [1, 0, 2].filter((position) => rows[position]);

  return (
    <div className={cn('relative flex w-full flex-1 flex-col items-center justify-end', className)} aria-label="Podium pemenang">
      {/* Lampu panggung */}
      {has('lights') && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {fancy ? (
            <>
              <div className="lq-beam" style={{ left: '12%', ['--lq-beam-from' as string]: '-14deg', ['--lq-beam-to' as string]: '4deg' }} />
              <div className="lq-beam" style={{ left: '39%', animationDelay: '1.2s', ['--lq-beam-from' as string]: '-6deg', ['--lq-beam-to' as string]: '6deg' }} />
              <div className="lq-beam" style={{ left: '66%', animationDelay: '2.2s', ['--lq-beam-from' as string]: '4deg', ['--lq-beam-to' as string]: '-14deg' }} />
            </>
          ) : (
            <div className="absolute inset-x-0 top-0 h-2/3" style={{ background: 'radial-gradient(60% 80% at 50% 0%, rgba(255,233,160,0.35), transparent 70%)' }} />
          )}
        </div>
      )}

      {animate && !finished && (
        <button type="button" onClick={skip} className="lq-btn lq-btn-ghost absolute right-0 top-0 z-10 px-3 py-1.5 text-xs">
          <SkipForward className="h-3.5 w-3.5" /> Lewati animasi
        </button>
      )}

      <div className="relative mx-auto flex w-full max-w-4xl items-end justify-center gap-3 px-2 sm:gap-6">
        {layout.map((position) => {
          const row = rows[position]!;
          const block = BLOCK[position]!;
          const winner = position === 0;
          const avatarSize = winner ? 132 : 92;
          const podiumUp = has(`podium-${position}`);
          const avatarIn = has(`avatar-${position}`);
          const trophy = has('trophy');
          return (
            <div key={row.playerId} className="flex w-1/3 max-w-[17rem] flex-col items-center">
              {/* Avatar + nama */}
              <div className="relative flex min-h-[11rem] w-full flex-col items-center justify-end pb-2 text-center">
                <AnimatePresence>
                  {avatarIn && (
                    <motion.div
                      key="who"
                      initial={animate ? { opacity: 0, y: winner ? -120 : -70, scale: 0.4 } : false}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: 'spring', stiffness: winner ? 170 : 220, damping: winner ? 11 : 14 }}
                      className="relative flex w-full flex-col items-center"
                    >
                      {winner && fancy && (
                        <span className="pointer-events-none absolute -top-8 left-1/2 -z-10 h-64 w-64 -translate-x-1/2 opacity-60" aria-hidden>
                          <svg viewBox="0 0 100 100" className="lq-rays h-full w-full">
                            {Array.from({ length: 12 }, (_, i) => (
                              <path key={i} d="M50 50 L44 0 L56 0Z" fill="#FFE9A8" opacity={0.55} transform={`rotate(${i * 30} 50 50)`} />
                            ))}
                          </svg>
                        </span>
                      )}
                      {winner && (
                        <motion.span
                          initial={animate ? { opacity: 0, y: 10, rotate: -20 } : false}
                          animate={{ opacity: 1, y: 0, rotate: 0 }}
                          transition={{ delay: animate ? 0.35 : 0, type: 'spring', stiffness: 260, damping: 14 }}
                          className="mb-1 text-amber-300 drop-shadow-lg"
                        >
                          <Crown className="h-10 w-10" fill="currentColor" aria-label="Juara 1" />
                        </motion.span>
                      )}
                      <PlayerAvatar avatarId={row.avatarId} seed={row.playerId} size={avatarSize} ring idle={winner} />
                      <p className={cn('mt-2 w-full truncate font-black text-white', winner ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl')}>{row.name}</p>
                      <p className={cn('font-black text-amber-200', winner ? 'text-2xl' : 'text-lg')}>
                        <AnimatedNumber value={row.totalScore} animate={animate} durationMs={1200} />
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Podium */}
              <motion.div
                initial={false}
                animate={{ scaleY: podiumUp ? 1 : 0.02, opacity: podiumUp ? 1 : 0.15 }}
                transition={{ type: 'spring', stiffness: 150, damping: 17 }}
                style={{ height: block.height, background: block.gradient, transformOrigin: '50% 100%' }}
                className="relative flex w-full items-start justify-center rounded-t-3xl shadow-2xl"
              >
                <span className="mt-2 text-5xl font-black sm:text-6xl" style={{ color: block.label }}>
                  {row.rank}
                </span>
                <AnimatePresence>
                  {trophy && (
                    <motion.span
                      initial={animate ? { scale: 0, rotate: -40, opacity: 0 } : false}
                      animate={{ scale: 1, rotate: 0, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 12, delay: position * 0.12 }}
                      className="absolute -bottom-0 left-1/2 mb-3 -translate-x-1/2"
                      style={{ bottom: '0.6rem', color: block.label }}
                    >
                      {winner ? <Trophy className="h-10 w-10" aria-label="Piala" /> : <Medal className="h-8 w-8" aria-label="Medali" />}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          );
        })}
      </div>

      {/* Semua juara */}
      <AnimatePresence>
        {finished && rest.length > 0 && (
          <motion.div
            initial={animate ? { opacity: 0, y: 24 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mt-5 w-full max-w-4xl"
          >
            <p className="mb-2 text-center text-xs font-black uppercase tracking-[0.3em] text-sky-200">Semua juara</p>
            <ol className="grid gap-2 sm:grid-cols-2">
              {rest.map((row) => (
                <li key={row.playerId} className="lq-glass flex items-center gap-3 rounded-2xl px-3 py-2 text-lg font-bold">
                  <span className="w-8 text-center font-black text-amber-300">{row.rank}</span>
                  <PlayerAvatar avatarId={row.avatarId} seed={row.playerId} size={36} />
                  <span className="min-w-0 flex-1 truncate">{row.name}</span>
                  <span className="tabular-nums text-amber-200">{row.totalScore.toLocaleString('id-ID')}</span>
                </li>
              ))}
            </ol>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
