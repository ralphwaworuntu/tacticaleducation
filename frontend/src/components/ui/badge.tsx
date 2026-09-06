import { cn } from '@/utils/cn';

type BadgeVariant = 'brand' | 'outline' | 'success';

type BadgeProps = {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
};

export function Badge({ children, variant = 'brand', className }: BadgeProps) {
  const variants: Record<BadgeVariant, string> = {
    brand: 'bg-brand-50 text-brand-600 border border-brand-100',
    outline: 'border border-slate-200 text-slate-600 bg-white',
    success: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
  };

  return (
    <span
      className={cn('inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold', variants[variant], className)}
    >
      {children}
    </span>
  );
}
