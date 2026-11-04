import { cn } from '@/utils/cn';

type LogoSize = 'xs' | 'sm' | 'md' | 'lg';

type BrandLogoProps = {
  className?: string;
  alt?: string;
  priority?: boolean;
  size?: LogoSize;
};

const sizeStyles: Record<LogoSize, { className: string; width: number; height: number }> = {
  xs: {
    className: 'h-9 w-auto',
    width: 36,
    height: 36,
  },
  sm: {
    className: 'h-11 w-auto sm:h-12 lg:h-14',
    width: 56,
    height: 56,
  },
  md: {
    className: 'h-12 w-auto sm:h-14 lg:h-16',
    width: 64,
    height: 64,
  },
  lg: {
    className: 'h-14 w-auto lg:h-16 xl:h-[4.5rem]',
    width: 72,
    height: 72,
  },
};

export function BrandLogo({ className, alt = 'Tactical Education', priority = false, size = 'md' }: BrandLogoProps) {
  const styles = sizeStyles[size];

  return (
    <img
      src="/Logo_tactical.png"
      alt={alt}
      width={styles.width}
      height={styles.height}
      decoding={priority ? 'sync' : 'async'}
      fetchPriority={priority ? 'high' : 'auto'}
      className={cn('brand-logo shrink-0 object-contain', styles.className, className)}
    />
  );
}
