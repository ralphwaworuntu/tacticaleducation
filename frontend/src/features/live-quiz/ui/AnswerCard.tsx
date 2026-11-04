import { Check, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import type { PublicOption } from '../types';
import { OptionContent } from './shared';

/**
 * Tema pilihan jawaban: warna + BENTUK + huruf agar tetap terbedakan tanpa mengandalkan warna
 * (aksesibel untuk buta warna) dan tetap terbaca di proyektor.
 */
export const ANSWER_THEMES = [
  { letter: 'A', top: '#4D8DFF', bottom: '#1F5FD6', shape: 'triangle' },
  { letter: 'B', top: '#3EE0B5', bottom: '#14A883', shape: 'diamond' },
  { letter: 'C', top: '#FFB45E', bottom: '#E77F1E', shape: 'circle' },
  { letter: 'D', top: '#F78AC4', bottom: '#D44C98', shape: 'square' },
  { letter: 'E', top: '#9A77F5', bottom: '#6A3DD6', shape: 'pentagon' },
  { letter: 'F', top: '#43D7EF', bottom: '#0FA3C4', shape: 'hexagon' },
] as const;

export type AnswerTheme = (typeof ANSWER_THEMES)[number];
export const themeFor = (index: number): AnswerTheme => ANSWER_THEMES[index % ANSWER_THEMES.length]!;

export function ShapeIcon({ shape, className }: { shape: AnswerTheme['shape']; className?: string }) {
  const common = { fill: 'currentColor' } as const;
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      {shape === 'triangle' && <path d="M12 3 L22 20 H2Z" {...common} />}
      {shape === 'diamond' && <path d="M12 2 L22 12 L12 22 L2 12Z" {...common} />}
      {shape === 'circle' && <circle cx="12" cy="12" r="9.5" {...common} />}
      {shape === 'square' && <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" {...common} />}
      {shape === 'pentagon' && <path d="M12 2.5 L21.5 9.5 L18 21 H6 L2.5 9.5Z" {...common} />}
      {shape === 'hexagon' && <path d="M7 3 H17 L22 12 L17 21 H7 L2 12Z" {...common} />}
    </svg>
  );
}

export type AnswerState = 'idle' | 'picked' | 'correct' | 'wrong' | 'dim';

export function AnswerCard({
  option,
  index,
  state = 'idle',
  disabled,
  onClick,
  size = 'player',
  hideContent = false,
  trailing,
}: {
  option: PublicOption;
  index: number;
  state?: AnswerState;
  disabled?: boolean;
  onClick?: () => void;
  size?: 'player' | 'host';
  /** Mode proyektor di HP: kartu hanya menampilkan bentuk + huruf. */
  hideContent?: boolean;
  trailing?: ReactNode;
}) {
  const theme = themeFor(index);
  const host = size === 'host';
  const interactive = Boolean(onClick);
  const Tag = interactive ? 'button' : 'div';
  return (
    <Tag
      {...(interactive ? { type: 'button' as const, disabled, onClick, 'aria-pressed': state === 'picked' } : {})}
      className={cn(
        'lq-answer relative flex items-center gap-3 overflow-hidden text-left font-bold text-white',
        host ? 'min-h-[5.5rem] gap-5 rounded-3xl px-6 py-4 text-2xl xl:text-3xl' : 'min-h-[4.5rem] rounded-2xl px-4 py-3 text-lg',
        hideContent && 'min-h-[7rem] flex-col justify-center text-center',
        state === 'picked' && 'lq-answer-picked',
        state === 'dim' && 'opacity-35 saturate-50',
        state === 'wrong' && 'opacity-60',
        state === 'correct' && 'ring-4 ring-emerald-200',
      )}
      style={{ background: `linear-gradient(180deg, ${theme.top} 0%, ${theme.bottom} 100%)` }}
    >
      <span className={cn('flex shrink-0 items-center justify-center rounded-xl bg-black/20', host ? 'h-14 w-14' : 'h-11 w-11')}>
        <ShapeIcon shape={theme.shape} className={host ? 'h-8 w-8' : 'h-6 w-6'} />
      </span>
      {hideContent || (option.label === null && !option.imageUrl) ? (
        <span className={cn('font-black text-white', host ? 'text-4xl' : 'text-3xl')}>{theme.letter}</span>
      ) : (
        <>
          <span className={cn('shrink-0 text-center font-black text-white/70', host ? 'w-8 text-3xl' : 'w-5 text-xl')}>{theme.letter}</span>
          <OptionContent label={option.label} imageUrl={option.imageUrl} />
        </>
      )}
      {state === 'picked' && <Check className="h-6 w-6 shrink-0" aria-label="Dipilih" />}
      {state === 'correct' && (
        <span className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-emerald-950">
          <Check className="h-6 w-6" aria-label="Jawaban benar" />
        </span>
      )}
      {state === 'wrong' && (
        <span className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white">
          <X className="h-6 w-6" aria-label="Jawabanmu salah" />
        </span>
      )}
      {trailing}
    </Tag>
  );
}
