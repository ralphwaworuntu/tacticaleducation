import { cn } from '@/utils/cn';

type BadgeVariant = 'brand' | 'outline' | 'success' | 'info' | 'warning' | 'danger';

type BadgeProps = {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
};

export function Badge({ children, variant = 'brand', className }: BadgeProps) {
  const variants: Record<BadgeVariant, string> = {
    brand: 'bg-brand-50 text-brand-600 border border-brand-100',
    outline: 'border border-slate-200 text-slate-600 bg-white',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
    info: 'border border-[#c9ddfc] bg-[#e8f1fe] text-[#1d4fbf]',
    warning: 'border border-amber-100 bg-[#fbf3e4] text-amber-800',
    danger: 'border border-red-100 bg-red-50 text-red-700',
  };

  return (
    <span
      className={cn('inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold', variants[variant], className)}
    >
      {children}
    </span>
  );
}
