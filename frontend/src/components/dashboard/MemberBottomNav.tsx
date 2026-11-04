import { NavLink } from 'react-router-dom';
import { BookOpen, ClipboardList, FolderOpen, LayoutDashboard, Menu } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useSidebarStore } from '@/store/sidebar';
import { useMembershipStatus } from '@/hooks/useMembershipStatus';

const items = [
  { to: '/app', label: 'Beranda', icon: LayoutDashboard, exact: true, key: 'home' },
  { to: '/app/latihan/tryout', label: 'Tryout', icon: ClipboardList, key: 'tryout' },
  { to: '/app/latihan-soal', label: 'Latihan', icon: BookOpen, key: 'practice' },
  { to: '/app/materi', label: 'Materi', icon: FolderOpen, key: 'materials' },
] as const;

export function MemberBottomNav() {
  const toggleMobile = useSidebarStore((state) => state.toggleMobile);
  const membership = useMembershipStatus();
  const restrict = Boolean(membership.data?.isActive);
  const allowTryout = membership.data?.allowTryout !== false;
  const allowPractice = membership.data?.allowPractice !== false;

  const visible = items.filter((item) => {
    if (!restrict) return true;
    if (item.key === 'tryout') return allowTryout;
    if (item.key === 'practice') return allowPractice;
    return true;
  });

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-16px_rgba(15,23,42,0.25)] backdrop-blur lg:hidden"
      aria-label="Navigasi utama"
    >
      <ul className="flex">
        {visible.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.to} className="min-w-0 flex-1">
              <NavLink
                to={item.to}
                end={'exact' in item ? item.exact : false}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-[52px] flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-semibold',
                    isActive ? 'text-brand-600' : 'text-slate-500',
                  )
                }
              >
                <Icon className="h-5 w-5" aria-hidden />
                {item.label}
              </NavLink>
            </li>
          );
        })}
        <li className="min-w-0 flex-1">
          <button
            type="button"
            onClick={toggleMobile}
            className="flex min-h-[52px] w-full flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-semibold text-slate-500"
          >
            <Menu className="h-5 w-5" aria-hidden />
            Lainnya
          </button>
        </li>
      </ul>
    </nav>
  );
}
