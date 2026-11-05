import { Check } from 'lucide-react';
import { cn } from '@/utils/cn';
import { AVATARS, PlayerAvatar, resolveAvatar } from '../avatars';

/** Grid pilih karakter (radio group). Dipakai saat join dan saat ganti karakter di lobby. */
export function AvatarPicker({
  value,
  onChange,
  disabled = false,
  className,
}: {
  value: string | null;
  onChange: (avatarId: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const selected = value ? resolveAvatar(value) : null;
  return (
    <div className={className}>
      <div role="radiogroup" aria-label="Pilih karakter" className="grid grid-cols-4 gap-2.5">
        {AVATARS.map((avatar) => {
          const active = avatar.id === selected?.id;
          return (
            <button
              key={avatar.id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={avatar.name}
              disabled={disabled}
              onClick={() => onChange(avatar.id)}
              className={cn(
                'relative flex aspect-square items-center justify-center rounded-2xl border-2 bg-slate-100/80 p-1 transition-transform duration-150 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] disabled:opacity-50',
                active ? 'z-10 scale-110 border-amber-400 bg-amber-50 shadow-lg' : 'border-transparent hover:scale-105 active:scale-95',
              )}
            >
              <PlayerAvatar avatarId={avatar.id} size={56} className="!h-full !w-full" />
              {active && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-slate-900 shadow">
                  <Check className="h-3.5 w-3.5" strokeWidth={3.5} />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-3 h-6 text-center text-sm font-bold text-slate-600" aria-live="polite">
        {selected ? `Karakter: ${selected.name}` : 'Ketuk satu karakter'}
      </p>
    </div>
  );
}
