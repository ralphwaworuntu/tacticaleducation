import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/utils/cn';

type Props = {
  title: string;
  children: ReactNode;
  /** Section that contains the current route stays open. */
  active?: boolean;
};

export function CollapsibleNavSection({ title, children, active = false }: Props) {
  const [open, setOpen] = useState(active);

  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left transition-colors duration-150 hover:bg-slate-50"
      >
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{title}</span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 text-slate-400 transition-transform duration-150', open ? 'rotate-0' : '-rotate-90')}
          aria-hidden
        />
      </button>
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-200 ease-out',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="min-h-0 overflow-hidden" inert={!open || undefined} aria-hidden={!open}>
          <div className="space-y-0.5 pb-1 pt-1">{children}</div>
        </div>
      </div>
    </div>
  );
}
