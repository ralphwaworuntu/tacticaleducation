import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Crown } from 'lucide-react';
import { cn } from '@/utils/cn';
import { PlayerAvatar } from '../avatars';
import type { LeaderboardEntry } from '../types';
import { AnimatedNumber, RankDelta } from './shared';

const RANK_STYLE: Record<number, { bar: string; badge: string; text: string }> = {
  1: { bar: 'linear-gradient(90deg, rgba(255,209,102,0.42), rgba(255,209,102,0.10))', badge: 'linear-gradient(180deg,#FFE08A,#F5B83D)', text: '#3a2500' },
  2: { bar: 'linear-gradient(90deg, rgba(210,222,240,0.32), rgba(210,222,240,0.08))', badge: 'linear-gradient(180deg,#F1F5FB,#B8C4D8)', text: '#1d2a3d' },
  3: { bar: 'linear-gradient(90deg, rgba(255,159,67,0.34), rgba(255,159,67,0.08))', badge: 'linear-gradient(180deg,#FFC48A,#E58A32)', text: '#3a1c00' },
};

function scaleFor(count: number, large: boolean) {
  if (!large) return { avatar: 42, pad: 'gap-3 px-3 py-2 sm:gap-4 sm:px-4', rank: 'h-9 w-9 text-lg', name: 'text-base sm:text-lg', score: 'w-24 text-lg', crown: 'h-5 w-5' };
  if (count <= 2) return { avatar: 96, pad: 'gap-5 px-6 py-5 sm:px-8', rank: 'h-16 w-16 text-4xl', name: 'text-3xl xl:text-5xl', score: 'w-44 text-4xl xl:text-5xl', crown: 'h-9 w-9' };
  if (count <= 5) return { avatar: 80, pad: 'gap-4 px-5 py-4 sm:px-7', rank: 'h-14 w-14 text-3xl', name: 'text-2xl xl:text-4xl', score: 'w-40 text-3xl xl:text-4xl', crown: 'h-8 w-8' };
  if (count <= 10) return { avatar: 64, pad: 'gap-4 px-4 py-3 sm:px-5', rank: 'h-12 w-12 text-2xl', name: 'text-xl xl:text-3xl', score: 'w-36 text-2xl xl:text-3xl', crown: 'h-7 w-7' };
  if (count <= 20) return { avatar: 52, pad: 'gap-3 px-4 py-2.5', rank: 'h-11 w-11 text-xl', name: 'text-lg xl:text-2xl', score: 'w-32 text-xl xl:text-2xl', crown: 'h-6 w-6' };
  return { avatar: 44, pad: 'gap-3 px-3 py-2', rank: 'h-10 w-10 text-lg', name: 'text-base xl:text-xl', score: 'w-28 text-lg xl:text-xl', crown: 'h-5 w-5' };
}

/** TACTICAL LEADERBOARD: baris animasi spring dengan avatar, delta peringkat, dan skor yang menghitung naik. */
export function Leaderboard({
  entries,
  animate,
  highlightId,
  large = false,
  className,
}: {
  entries: LeaderboardEntry[];
  animate: boolean;
  highlightId?: string | null;
  large?: boolean;
  className?: string;
}) {
  // Mulai dari urutan sebelumnya (rank + delta) lalu pindah ke urutan baru agar perubahan posisi terlihat.
  const previousOrder = useMemo(
    () => [...entries].sort((a, b) => a.rank + (a.delta ?? 0) - (b.rank + (b.delta ?? 0)) || a.rank - b.rank),
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
  const scale = scaleFor(entries.length, large);
  const few = large && entries.length <= 5;

  return (
    <ol
      className={cn(
        'mx-auto flex w-full min-h-0 flex-col',
        large ? 'max-w-[min(92%,80rem)]' : 'max-w-xl',
        few ? 'flex-1 justify-evenly gap-[clamp(0.5rem,1.4vh,1.25rem)]' : 'space-y-2 overflow-y-auto pr-1',
        className,
      )}
    >
      {ordered.map((entry, index) => {
        const shownRank = showFinal ? entry.rank : entry.delta !== null ? entry.rank + entry.delta : index + 1;
        const mine = entry.playerId === highlightId;
        const style = RANK_STYLE[shownRank];
        const gold = shownRank === 1;
        return (
          <motion.li
            key={entry.playerId}
            layout={animate}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            className={cn(
              'relative flex items-center overflow-hidden rounded-[1.35rem] border text-white',
              scale.pad,
              mine ? 'border-amber-300 shadow-[0_0_0_2px_rgba(255,209,102,0.7)]' : 'border-white/10',
              gold && 'lq-rank-gold',
            )}
            style={{
              background: mine
                ? 'linear-gradient(90deg, rgba(255,209,102,0.48), rgba(255,209,102,0.16))'
                : (style?.bar ?? 'rgba(255,255,255,0.08)'),
            }}
          >
            <span
              className={cn('flex shrink-0 items-center justify-center rounded-full font-black', scale.rank)}
              style={style ? { background: style.badge, color: style.text } : { background: 'rgba(255,255,255,0.14)' }}
            >
              {gold ? <Crown className={scale.crown} aria-label="Peringkat 1" /> : shownRank}
            </span>
            <PlayerAvatar
              avatarId={entry.avatarId}
              src={entry.avatarUrl}
              seed={entry.playerId}
              size={scale.avatar}
              ring={gold}
            />
            <span className={cn('min-w-0 flex-1 truncate font-extrabold', scale.name)}>{entry.name}</span>
            <RankDelta delta={showFinal ? entry.delta : null} />
            <span className={cn('text-right font-black tabular-nums text-amber-200', scale.score)}>
              {large && animate && showFinal ? (
                <AnimatedNumber value={entry.totalScore} animate durationMs={900} />
              ) : (
                entry.totalScore.toLocaleString('id-ID')
              )}
            </span>
          </motion.li>
        );
      })}
    </ol>
  );
}
