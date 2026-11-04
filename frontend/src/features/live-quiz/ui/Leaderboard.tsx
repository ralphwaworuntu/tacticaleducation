import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Crown } from 'lucide-react';
import { cn } from '@/utils/cn';
import { PlayerAvatar } from '../avatars';
import type { LeaderboardEntry } from '../types';
import { RankDelta } from './shared';

const RANK_STYLE: Record<number, { bar: string; badge: string; text: string }> = {
  1: { bar: 'linear-gradient(90deg, rgba(255,209,102,0.34), rgba(255,209,102,0.08))', badge: 'linear-gradient(180deg,#FFE08A,#F5B83D)', text: '#3a2500' },
  2: { bar: 'linear-gradient(90deg, rgba(210,222,240,0.28), rgba(210,222,240,0.07))', badge: 'linear-gradient(180deg,#F1F5FB,#B8C4D8)', text: '#1d2a3d' },
  3: { bar: 'linear-gradient(90deg, rgba(255,159,67,0.30), rgba(255,159,67,0.07))', badge: 'linear-gradient(180deg,#FFC48A,#E58A32)', text: '#3a1c00' },
};

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
  const avatarSize = large ? 56 : 42;
  return (
    <ol className={cn('mx-auto w-full space-y-2', large ? 'max-w-4xl' : 'max-w-xl', className)}>
      {ordered.map((entry, index) => {
        const shownRank = showFinal ? entry.rank : entry.delta !== null ? entry.rank + entry.delta : index + 1;
        const mine = entry.playerId === highlightId;
        const style = RANK_STYLE[shownRank];
        return (
          <motion.li
            key={entry.playerId}
            layout={animate}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            className={cn(
              'relative flex items-center gap-3 overflow-hidden rounded-2xl border px-3 py-2 text-white sm:gap-4 sm:px-4',
              large ? 'text-2xl' : 'text-base sm:text-lg',
              mine ? 'border-amber-300 shadow-[0_0_0_2px_rgba(255,209,102,0.7)]' : 'border-white/10',
            )}
            style={{ background: mine ? 'linear-gradient(90deg, rgba(255,209,102,0.42), rgba(255,209,102,0.14))' : (style?.bar ?? 'rgba(255,255,255,0.08)') }}
          >
            <span
              className={cn('flex shrink-0 items-center justify-center rounded-full font-black', large ? 'h-12 w-12 text-2xl' : 'h-9 w-9 text-lg')}
              style={style ? { background: style.badge, color: style.text } : { background: 'rgba(255,255,255,0.14)' }}
            >
              {shownRank === 1 ? <Crown className={large ? 'h-6 w-6' : 'h-5 w-5'} aria-label="Peringkat 1" /> : shownRank}
            </span>
            <PlayerAvatar avatarId={entry.avatarId} seed={entry.playerId} size={avatarSize} ring={shownRank === 1} />
            <span className="min-w-0 flex-1 truncate font-extrabold">{entry.name}</span>
            <RankDelta delta={showFinal ? entry.delta : null} />
            <span className={cn('text-right font-black tabular-nums text-amber-200', large ? 'w-36' : 'w-24')}>
              {entry.totalScore.toLocaleString('id-ID')}
            </span>
          </motion.li>
        );
      })}
    </ol>
  );
}
