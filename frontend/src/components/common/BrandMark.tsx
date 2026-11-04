import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '@/components/common/BrandLogo';
import { cn } from '@/utils/cn';

type BrandMarkSize = 'sm' | 'md' | 'lg';

type BrandMarkProps = {
  size?: BrandMarkSize;
  variant?: 'full' | 'compact' | 'icon';
  tagline?: string;
  showTagline?: boolean;
  framed?: boolean;
  href?: string;
  className?: string;
  trailing?: ReactNode;
};

const nameStyles: Record<BrandMarkSize, string> = {
  sm: 'text-[11px] font-extrabold uppercase leading-tight tracking-[0.04em] text-brand-500 sm:text-xs',
  md: 'text-xs font-extrabold uppercase leading-tight tracking-[0.04em] text-brand-500 sm:text-sm',
  lg: 'text-sm font-extrabold uppercase leading-tight tracking-[0.04em] text-brand-500 sm:text-base',
};

const taglineStyles: Record<BrandMarkSize, string> = {
  sm: 'text-[10px] font-medium text-slate-500',
  md: 'text-[11px] font-medium text-slate-500 sm:text-xs',
  lg: 'text-xs font-medium text-slate-500',
};

export function BrandMark({
  size = 'md',
  variant = 'full',
  tagline = 'Bimbingan Belajar Profesional',
  showTagline = true,
  framed = true,
  href,
  className,
  trailing,
}: BrandMarkProps) {
  const logoSize = variant === 'compact' || variant === 'icon' ? 'xs' : size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : 'md';

  const content = (
    <div className={cn('flex min-w-0 items-center gap-2.5 sm:gap-3', className)}>
      <div
        className={cn(
          'flex shrink-0 items-center justify-center',
          framed &&
            'rounded-xl border border-brand-100/80 bg-white p-1 shadow-[0_2px_12px_rgba(23,51,107,0.08)] sm:rounded-2xl sm:p-1.5',
        )}
      >
        <BrandLogo size={logoSize} priority={variant !== 'icon'} />
      </div>

      {variant !== 'icon' && (
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={cn('max-w-full', nameStyles[size], variant === 'compact' ? 'leading-[1.15]' : 'whitespace-normal break-words')}>
              {variant === 'compact' ? (
                <>
                  <span className="block">TACTICAL</span>
                  <span className="block">EDUKASI</span>
                </>
              ) : (
                'TACTICAL EDUKASI'
              )}
            </p>
            {trailing}
          </div>
          {showTagline && variant === 'full' && (
            <p className={cn('mt-0.5 truncate', taglineStyles[size])}>{tagline}</p>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link to={href} className="inline-flex min-w-0 transition-opacity hover:opacity-90">
        {content}
      </Link>
    );
  }

  return content;
}
