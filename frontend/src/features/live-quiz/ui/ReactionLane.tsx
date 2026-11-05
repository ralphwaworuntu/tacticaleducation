import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { PlayerAvatar } from '../avatars';
import { REACTION_EMOJI, type ReactionItem } from '../types';

export type ReactionLaneHandle = { push: (items: ReactionItem[]) => void; clear: () => void };

type Active = { id: number; slot: number; emoji: ReactionItem['emoji']; avatarId: string; playerId: string; name: string; count: number };

const MAX_ACTIVE = 4;
const SLOT_STEP = 66;

/**
 * Lajur reaksi di tepi layar host. Aturan:
 *  - maksimal 4 reaksi aktif sekaligus (sisanya digabung bila emoji sama, atau dibuang);
 *  - tiap reaksi hidup 2-3 detik; emoji yang sama digabung menjadi "x N";
 *  - hanya berisi transform/opacity; berada di kolom khusus sehingga tidak menutupi soal/jawaban/timer.
 */
export const ReactionLane = forwardRef<ReactionLaneHandle, { lite?: boolean }>(function ReactionLane({ lite = false }, ref) {
  const [active, setActive] = useState<Active[]>([]);
  const idRef = useRef(0);
  const timers = useRef(new Map<number, number>());
  const lifetimeMs = lite ? 1400 : 2600;

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current.clear();
    },
    [],
  );

  const push = useCallback(
    (items: ReactionItem[]) => {
      if (!items.length) return;
      setActive((current) => {
        let next = current;
        for (const item of items) {
          const same = next.find((a) => a.emoji === item.emoji);
          if (same) {
            next = next.map((a) => (a === same ? { ...a, count: a.count + 1 } : a));
            continue;
          }
          if (next.length >= MAX_ACTIVE) continue;
          const used = new Set(next.map((a) => a.slot));
          let slot = 0;
          while (used.has(slot)) slot += 1;
          idRef.current += 1;
          const id = idRef.current;
          const timer = window.setTimeout(() => {
            timers.current.delete(id);
            setActive((list) => list.filter((a) => a.id !== id));
          }, lifetimeMs);
          timers.current.set(id, timer);
          next = [...next, { id, slot, emoji: item.emoji, avatarId: item.avatarId, playerId: item.playerId, name: item.name, count: 1 }];
        }
        return next;
      });
    },
    [lifetimeMs],
  );

  const clear = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current.clear();
    setActive([]);
  }, []);

  useImperativeHandle(ref, () => ({ push, clear }), [push, clear]);

  return (
    <div className="pointer-events-none relative h-full w-[92px] shrink-0" aria-hidden data-testid="reaction-lane">
      {active.map((reaction) => (
        <div
          key={reaction.id}
          className="lq-reaction absolute left-1/2 -ml-[34px] flex w-[68px] flex-col items-center"
          style={{
            bottom: 14 + reaction.slot * SLOT_STEP,
            ['--lq-reaction-ms' as string]: `${lifetimeMs}ms`,
            ['--lq-sway' as string]: `${(reaction.slot % 2 ? 1 : -1) * 8}px`,
          }}
        >
          <span className="relative flex h-14 w-14 items-center justify-center rounded-full border border-white/25 bg-[#102a43]/80 text-[30px] shadow-lg">
            {REACTION_EMOJI[reaction.emoji]}
            <span className="absolute -bottom-1 -right-1 overflow-hidden rounded-full ring-2 ring-[#102a43]">
              <PlayerAvatar avatarId={reaction.avatarId} seed={reaction.playerId} size={24} />
            </span>
            {reaction.count > 1 && (
              <span className="absolute -left-1 -top-1 rounded-full bg-amber-300 px-1.5 text-xs font-black text-slate-900">×{reaction.count}</span>
            )}
          </span>
          <span className="mt-0.5 max-w-full truncate rounded-full bg-black/35 px-2 text-[10px] font-bold text-white">
            {reaction.count > 1 ? 'beramai-ramai' : reaction.name}
          </span>
        </div>
      ))}
    </div>
  );
});
