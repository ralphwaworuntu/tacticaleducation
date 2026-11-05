import { cn } from '@/utils/cn';

type CardProps = {
  children: React.ReactNode;
  className?: string;
};

export function Card({ children, className }: CardProps) {
  return (
    <div className={cn('rounded-[14px] border border-slate-200/80 bg-white shadow-sm transition-shadow duration-150 hover:shadow-md', className)}>
      {children}
    </div>
  );
}

type CardHeaderProps = {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
};

export function CardHeader({ children, className, title, subtitle }: CardHeaderProps) {
  return (
    <div className={cn('border-b border-slate-100 px-6 py-4', className)}>
      {title && <p className="text-lg font-semibold text-slate-900">{title}</p>}
      {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: CardProps) {
  return <h3 className={cn('text-lg font-semibold text-slate-900', className)}>{children}</h3>;
}

export function CardDescription({ children, className }: CardProps) {
  return <p className={cn('text-sm text-slate-600', className)}>{children}</p>;
}

export function CardContent({ children, className }: CardProps) {
  return <div className={cn('px-6 py-4', className)}>{children}</div>;
}
