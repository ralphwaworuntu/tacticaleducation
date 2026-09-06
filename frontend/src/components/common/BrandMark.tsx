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
  sm: 'text-sm font-bold leading-tight tracking-tight text-slate-900',
  md: 'text-sm font-bold leading-tight tracking-tight text-slate-900 sm:text-base',
  lg: 'text-base font-bold leading-tight tracking-tight text-slate-900 sm:text-lg',
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
  const logoSize = size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : 'md';

  const content = (
    <div className={cn('flex min-w-0 items-center gap-2.5 sm:gap-3', className)}>
      <div
        className={cn(
          'flex shrink-0 items-center justify-center',
          framed &&
            'rounded-2xl border border-brand-100/80 bg-white p-1.5 shadow-[0_2px_12px_rgba(30,58,138,0.08)] sm:p-2',
        )}
      >
        <BrandLogo size={logoSize} priority={variant !== 'icon'} />
      </div>

      {variant !== 'icon' && (
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={cn('truncate', nameStyles[size])}>Tactical Education</p>
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
