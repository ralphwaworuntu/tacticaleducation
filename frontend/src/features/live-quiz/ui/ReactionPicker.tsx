import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SmilePlus, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { liveAudio } from '../audio';
import { REACTION_EMOJI, REACTION_IDS, REACTION_LABEL, type ReactionId } from '../types';
import type { AckResult } from '../useLiveSession';

const COOLDOWN_MS = 3000;

type Floating = { id: number; emoji: ReactionId; x: number };

const MESSAGES: Record<string, string> = {
  cooldown: 'Tunggu sebentar ya…',
  rate_limited: 'Terlalu cepat, tunggu sebentar.',
  reactions_disabled: 'Reaksi dimatikan tutor.',
  phase_not_allowed: 'Belum bisa kirim reaksi sekarang.',
  answer_required: 'Jawab dulu untuk kirim reaksi.',
  offline: 'Tidak terhubung.',
  timeout: 'Server lambat, coba lagi.',
};

/**
 * Tombol REACT di HP pemain. Server tetap pemegang aturan (fase, cooldown, rate limit); komponen ini
 * hanya memberi umpan balik: cooldown 3 detik, pesan penolakan, dan emoji yang melayang ke atas.
 */
export function ReactionPicker({
  send,
  soundEnabled,
  animate,
  className,
}: {
  send: (emoji: ReactionId) => Promise<AckResult>;
  soundEnabled: boolean;
  animate: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [message, setMessage] = useState<string | null>(null);
  const [floating, setFloating] = useState<Floating[]>([]);
  const idRef = useRef(0);
  const sendingRef = useRef(false);

  const remaining = Math.max(0, cooldownUntil - now);
  const cooling = remaining > 0;

  useEffect(() => {
    if (!cooling) return;
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, [cooling]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 2200);
    return () => window.clearTimeout(timer);
  }, [message]);

  const pick = useCallback(
    async (emoji: ReactionId) => {
      if (sendingRef.current || cooling) return;
      sendingRef.current = true;
      liveAudio.unlock();
      const startedAt = Date.now();
      // Optimistis: cooldown langsung berjalan agar ketukan beruntun tidak menembak server.
      setCooldownUntil(startedAt + COOLDOWN_MS);
      setNow(startedAt);
      const result = await send(emoji);
      sendingRef.current = false;
      if (result.ok) {
        if (soundEnabled) liveAudio.play('reaction');
        idRef.current += 1;
        const id = idRef.current;
        setFloating((list) => [...list.slice(-2), { id, emoji, x: (Math.random() - 0.5) * 60 }]);
        window.setTimeout(() => setFloating((list) => list.filter((f) => f.id !== id)), 1800);
        setOpen(false);
      } else {
        const wait = result.retryAfterMs ?? 0;
        setCooldownUntil(Date.now() + (wait > 0 ? wait : result.code === 'cooldown' ? COOLDOWN_MS : 0));
        setMessage(MESSAGES[result.code ?? ''] ?? 'Reaksi belum terkirim.');
      }
    },
    [cooling, send, soundEnabled],
  );

  return (
    <div className={cn('relative', className)}>
      {/* Emoji melayang (umpan balik lokal) */}
      <div className="pointer-events-none absolute bottom-full right-4 h-0 w-0" aria-hidden>
        {floating.map((item) => (
          <span
            key={item.id}
            className="lq-reaction absolute -ml-5 text-4xl"
            style={{ ['--lq-reaction-ms' as string]: '1800ms', ['--lq-sway' as string]: `${item.x}px`, bottom: 0 }}
          >
            {REACTION_EMOJI[item.emoji]}
          </span>
        ))}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={animate ? { opacity: 0, y: 14, scale: 0.96 } : false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={animate ? { opacity: 0, y: 10 } : { opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="lq-glass mb-2 rounded-3xl bg-[#0b2240]/95 p-3"
            role="group"
            aria-label="Pilih reaksi"
          >
            <div className="grid grid-cols-4 gap-2">
              {REACTION_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  disabled={cooling}
                  onClick={() => void pick(id)}
                  aria-label={`Reaksi ${REACTION_LABEL[id]}`}
                  className="flex h-14 items-center justify-center rounded-2xl bg-white/10 text-3xl transition active:scale-90 disabled:opacity-40"
                >
                  {REACTION_EMOJI[id]}
                </button>
              ))}
            </div>
            <p className="mt-2 h-5 text-center text-xs font-semibold text-sky-100" aria-live="polite">
              {message ?? (cooling ? `Bisa kirim lagi dalam ${Math.ceil(remaining / 1000)} dtk` : 'Pilih satu reaksi')}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="lq-btn lq-btn-electric h-12 w-full gap-2 text-base"
      >
        {open ? <X className="h-5 w-5" /> : <SmilePlus className="h-5 w-5" />}
        {open ? 'Tutup' : cooling ? `REACT · ${Math.ceil(remaining / 1000)}` : 'REACT'}
      </button>
    </div>
  );
}
