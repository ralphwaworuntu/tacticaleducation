import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/utils/cn';
import type { MotionLevel } from '../useMotionLevel';
import '../live-quiz.css';

type Shape = { kind: 'circle' | 'ring' | 'triangle' | 'plus' | 'hex' | 'star'; x: string; y: string; size: number; color: string; dur: number; delay: number; dx: number; dy: number; rot: number };

/** Bentuk dekoratif: statis posisinya, hanya transform yang beranimasi (CSS). Dimatikan di mode lite/reduced. */
const SHAPES: Shape[] = [
  { kind: 'circle', x: '6%', y: '14%', size: 54, color: '#2575FC', dur: 15, delay: 0, dx: 16, dy: -28, rot: 0 },
  { kind: 'ring', x: '84%', y: '80%', size: 72, color: '#FFD166', dur: 18, delay: 1.2, dx: -18, dy: 22, rot: 30 },
  { kind: 'triangle', x: '14%', y: '72%', size: 60, color: '#F36FB6', dur: 17, delay: 2.4, dx: 12, dy: -24, rot: 24 },
  { kind: 'plus', x: '78%', y: '66%', size: 46, color: '#19C6E6', dur: 14, delay: 0.6, dx: -14, dy: -20, rot: 90 },
  { kind: 'hex', x: '56%', y: '84%', size: 58, color: '#8056ED', dur: 19, delay: 3, dx: 10, dy: 26, rot: -20 },
  { kind: 'star', x: '90%', y: '90%', size: 44, color: '#2DD4A7', dur: 16, delay: 1.8, dx: -10, dy: -30, rot: 40 },
  { kind: 'circle', x: '30%', y: '88%', size: 34, color: '#FF9F43', dur: 13, delay: 4, dx: 18, dy: -18, rot: 0 },
  { kind: 'ring', x: '3%', y: '44%', size: 40, color: '#19C6E6', dur: 20, delay: 2, dx: 14, dy: 20, rot: 18 },
];

function ShapeSvg({ shape }: { shape: Shape }) {
  const c = shape.color;
  switch (shape.kind) {
    case 'circle':
      return <circle cx="50" cy="50" r="40" fill={c} />;
    case 'ring':
      return <circle cx="50" cy="50" r="38" fill="none" stroke={c} strokeWidth="12" />;
    case 'triangle':
      return <path d="M50 10 L92 86 L8 86Z" fill={c} strokeLinejoin="round" />;
    case 'plus':
      return <path d="M38 8 H62 V38 H92 V62 H62 V92 H38 V62 H8 V38 H38Z" fill={c} />;
    case 'hex':
      return <path d="M50 6 L88 28 V72 L50 94 L12 72 V28Z" fill="none" stroke={c} strokeWidth="10" strokeLinejoin="round" />;
    case 'star':
      return <path d="M50 6 L61 38 L94 38 L67 58 L78 92 L50 71 L22 92 L33 58 L6 38 L39 38Z" fill={c} />;
  }
}

export function GameStage({
  level,
  className,
  children,
  style,
}: {
  level: MotionLevel;
  className?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const lite = level !== 'full';
  return (
    <div className={cn('lq-root lq-stage', lite && 'lq-lite', className)} style={style}>
      {!lite && (
        <div className="lq-shapes" aria-hidden>
          {SHAPES.map((shape, index) => (
            <svg
              key={index}
              className="lq-shape"
              viewBox="0 0 100 100"
              width={shape.size}
              height={shape.size}
              style={
                {
                  left: shape.x,
                  top: shape.y,
                  '--lq-dur': `${shape.dur}s`,
                  '--lq-delay': `${shape.delay}s`,
                  '--lq-dx': `${shape.dx}px`,
                  '--lq-dy': `${shape.dy}px`,
                  '--lq-rot': `${shape.rot}deg`,
                } as CSSProperties
              }
            >
              <ShapeSvg shape={shape} />
            </svg>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}

/** Logo Tactical Edukasi + judul produk (dipakai di join, lobby, header). */
export function LiveBrand({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <img
        src="/Logo_tactical.png"
        alt="Tactical Edukasi"
        className={cn('rounded-2xl bg-white object-contain shadow-lg', compact ? 'h-10 w-10 p-1' : 'h-16 w-16 p-2')}
      />
      <div className="min-w-0 leading-tight">
        <p className={cn('font-black uppercase tracking-[0.22em] text-amber-300', compact ? 'text-[10px]' : 'text-xs')}>Tactical Edukasi</p>
        <p className={cn('font-black text-white', compact ? 'text-base' : 'text-2xl')}>Live Quiz</p>
      </div>
    </div>
  );
}
