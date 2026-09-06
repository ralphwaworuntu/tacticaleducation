import { Menu } from 'lucide-react';
import { cn } from '@/utils/cn';

type SidebarToggleButtonProps = {
  onClick: () => void;
  className?: string;
  ariaLabel?: string;
};

export function SidebarToggleButton({
  onClick,
  className,
  ariaLabel = 'Buka menu sidebar',
}: SidebarToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={cn(
        'group relative inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-brand-200/90 bg-gradient-to-br from-brand-50 to-brand-100/80 text-brand-700 shadow-sm shadow-brand-600/10 transition-all duration-200 hover:border-brand-300 hover:from-brand-100 hover:to-brand-50 hover:text-brand-800 hover:shadow-md hover:shadow-brand-600/15 active:scale-[0.97]',
        className,
      )}
    >
      <Menu className="relative h-[1.125rem] w-[1.125rem] stroke-[2.5px]" />
    </button>
  );
}
