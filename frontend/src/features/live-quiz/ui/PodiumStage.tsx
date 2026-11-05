import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Crown, Medal, SkipForward, Trophy } from 'lucide-react';
import { cn } from '@/utils/cn';
import { PlayerAvatar } from '../avatars';
import type { PodiumRow } from '../types';
import { AnimatedNumber, fireConfetti } from './shared';

export type PodiumEvent = 'lights' | 'podium' | 'avatar' | 'winner' | 'trophy' | 'list';

type Step = { at: number; key: string; kind: PodiumEvent; position?: number };

const BLOCK: Record<number, { height: string; gradient: string; label: string; medal: string; width: string; avatar: number }> = {
  0: {
    height: 'clamp(14rem, 38vh, 24rem)',
    gradient: 'linear-gradient(180deg,#FFE9A8 0%,#FFD166 42%,#E9A92F 100%)',
    label: '#4a2f00',
    medal: '#FFD166',
    width: 'w-[36%] max-w-[20rem]',
    avatar: 128,
  },
  1: {
    height: 'clamp(10.5rem, 29vh, 18rem)',
    gradient: 'linear-gradient(180deg,#F6F9FE 0%,#C8D3E6 50%,#9AA9C2 100%)',
    label: '#1f2d44',
    medal: '#D6DFEE',
    width: 'w-[30%] max-w-[16.5rem]',
    avatar: 108,
  },
  2: {
    height: 'clamp(8.75rem, 24vh, 15rem)',
    gradient: 'linear-gradient(180deg,#FFD0A0 0%,#F0A05A 50%,#C9742B 100%)',
    label: '#4a2500',
    medal: '#F0A05A',
    width: 'w-[30%] max-w-[16.5rem]',
    avatar: 100,
  },
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
  animate,
  fancy,
  onEvent,
  className,
}: {
  podium: PodiumRow[];
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
    <div className={cn('relative flex w-full min-h-0 flex-1 flex-col items-center justify-end', className)} aria-label="Podium pemenang">
      {/* Lampu panggung */}
      {has('lights') && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {fancy ? (
            <>
              <div className="lq-beam lq-beam-soft" style={{ left: '18%', ['--lq-beam-from' as string]: '-8deg', ['--lq-beam-to' as string]: '3deg' }} />
              <div className="lq-beam" style={{ left: '42%', animationDelay: '1.2s', ['--lq-beam-from' as string]: '-4deg', ['--lq-beam-to' as string]: '4deg' }} />
              <div className="lq-beam lq-beam-soft" style={{ left: '66%', animationDelay: '2.2s', ['--lq-beam-from' as string]: '3deg', ['--lq-beam-to' as string]: '-8deg' }} />
            </>
          ) : (
            <div className="absolute inset-x-0 top-0 h-1/2" style={{ background: 'radial-gradient(42% 70% at 50% 0%, rgba(255,233,160,0.22), transparent 72%)' }} />
          )}
        </div>
      )}

      {animate && !finished && (
        <button type="button" onClick={skip} className="lq-btn lq-btn-ghost absolute right-0 top-0 z-10 px-3 py-1.5 text-xs">
          <SkipForward className="h-3.5 w-3.5" /> Lewati animasi
        </button>
      )}

      <div className="relative mx-auto flex w-[min(92vw,70rem)] items-end justify-center gap-4 px-2 sm:gap-6">
        {layout.map((position) => {
          const row = rows[position]!;
          const block = BLOCK[position]!;
          const winner = position === 0;
          const avatarSize = block.avatar;
          const podiumUp = has(`podium-${position}`);
          const avatarIn = has(`avatar-${position}`);
          const trophy = has('trophy');
          return (
            <div key={row.playerId} className={cn('flex flex-col items-center', block.width)}>
              {/* Avatar + nama */}
              <div className="relative flex min-h-[clamp(11rem,24vh,17rem)] w-full flex-col items-center justify-end pb-2 text-center">
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
                        <span className="pointer-events-none absolute -top-6 left-1/2 -z-10 h-52 w-52 -translate-x-1/2 opacity-45" aria-hidden>
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
                          <Crown className="h-12 w-12 sm:h-14 sm:w-14" fill="currentColor" aria-label="Juara 1" />
                        </motion.span>
                      )}
                      <PlayerAvatar
                        avatarId={row.avatarId}
                        seed={row.playerId}
                        size={avatarSize}
                        ring
                        idle={winner}
                        className={winner ? 'lq-rank-gold' : undefined}
                      />
                      <p className={cn('mt-2 w-full truncate px-1 font-black text-white drop-shadow', winner ? 'text-[clamp(1.35rem,2.4vw,2.15rem)]' : 'text-[clamp(1.15rem,2vw,1.75rem)]')}>
                        {row.name}
                      </p>
                      <p className={cn('font-black tabular-nums text-amber-200', winner ? 'text-[clamp(1.2rem,2.1vw,1.75rem)]' : 'text-[clamp(1.05rem,1.8vw,1.5rem)]')}>
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
                className={cn(
                  'relative flex w-full items-start justify-center rounded-t-3xl shadow-2xl',
                  winner && 'lq-rank-gold',
                )}
              >
                <span className="mt-2 text-5xl font-black sm:text-6xl xl:text-7xl" style={{ color: block.label }}>
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
                      {winner ? <Trophy className="h-12 w-12" aria-label="Piala" /> : <Medal className="h-10 w-10" aria-label="Medali" />}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
