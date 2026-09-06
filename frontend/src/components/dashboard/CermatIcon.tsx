import { cn } from '@/utils/cn';
import { isCermatImageIcon } from '@/constants/cermatIcons';
import { CERMAT_CUSTOM_SVGS } from '@/components/dashboard/cermatIconsCustom';

type CermatIconProps = {
  name: string;
  className?: string;
  strokeWidth?: number;
};

export function CermatIcon({ name, className = 'h-12 w-12', strokeWidth: _strokeWidth = 2 }: CermatIconProps) {
  if (isCermatImageIcon(name)) {
    const CustomIcon = CERMAT_CUSTOM_SVGS[name];
    if (CustomIcon) {
      return <CustomIcon className={cn('h-full w-full text-slate-900', className)} />;
    }

    return (
      <img
        src={`/cermat-icons/${name}.png`}
        alt=""
        draggable={false}
        className={cn('h-full w-full object-contain object-center', className)}
      />
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded border border-slate-300 bg-slate-50 text-[10px] font-semibold uppercase text-slate-500',
        className,
      )}
    >
      {name.slice(0, 2)}
    </span>
  );
}

export function isCermatIconKey(value: string): boolean {
  return isCermatImageIcon(value);
}
