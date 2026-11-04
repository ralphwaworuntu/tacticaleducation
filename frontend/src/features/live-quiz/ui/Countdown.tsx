import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/utils/cn';

/** Hitung mundur 3-2-1: angka besar dengan cincin gelombang. Mode lite hanya menampilkan angka. */
export function GameCountdown({
  seconds,
  label = 'Bersiap…',
  animate,
  fancy,
  compact = false,
}: {
  seconds: number;
  label?: string;
  animate: boolean;
  fancy: boolean;
  compact?: boolean;
}) {
  const size = compact ? 'h-44 w-44 text-[7rem]' : 'h-72 w-72 text-[11rem] xl:h-80 xl:w-80 xl:text-[13rem]';
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-white">
      <p className={cn('mb-6 font-black uppercase tracking-[0.3em] text-sky-100', compact ? 'text-base' : 'text-2xl')}>{label}</p>
      <div className={cn('relative flex items-center justify-center', size)} aria-live="assertive" aria-atomic>
        <AnimatePresence mode="popLayout">
          <motion.div
            key={seconds}
            initial={animate ? { scale: 0.3, opacity: 0, rotate: -12 } : false}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={animate ? { scale: 1.6, opacity: 0 } : { opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 16 }}
            className="absolute inset-0 flex items-center justify-center rounded-full font-black leading-none text-[#2b1a00] shadow-2xl"
            style={{ background: 'radial-gradient(circle at 35% 30%, #FFF0B8, #FFD166 55%, #F0A92F)' }}
          >
            {seconds}
          </motion.div>
        </AnimatePresence>
        {animate && fancy && (
          <AnimatePresence>
            <motion.span
              key={`ring-${seconds}`}
              initial={{ scale: 1, opacity: 0.7 }}
              animate={{ scale: 1.9, opacity: 0 }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
              className="pointer-events-none absolute inset-0 rounded-full border-4 border-amber-200"
              aria-hidden
            />
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
