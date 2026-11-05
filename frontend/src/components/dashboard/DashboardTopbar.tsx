import { LogOut } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { parseNameInitials } from '@/utils/format';
import { Button } from '@/components/ui/button';
import { AccountSettingsModal } from '@/components/dashboard/AccountSettingsModal';
import { SidebarToggleButton } from '@/components/dashboard/SidebarToggleButton';
import { BrandMark } from '@/components/common/BrandMark';
import { dashboardMenu, findNavLabel } from '@/constants/navigation';
import { getAssetUrl } from '@/lib/media';
import { useSidebarStore } from '@/store/sidebar';
import { cn } from '@/utils/cn';

export function DashboardTopbar() {
  const { user, logout } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const sidebarOpen = useSidebarStore((state) => state.isOpen);
  const toggleSidebar = useSidebarStore((state) => state.toggle);
  const toggleMobileSidebar = useSidebarStore((state) => state.toggleMobile);
  const showBrandInTopbar = !sidebarOpen;
  const location = useLocation();
  const pageTitle = findNavLabel(location.pathname, dashboardMenu) ?? 'Dashboard';

  const firstName = useMemo(() => {
    const raw = user?.name?.trim() ?? '';
    if (!raw) return 'Member';
    return raw.split(/\s+/)[0] ?? 'Member';
  }, [user?.name]);

  return (
    <header className="relative sticky top-0 z-20 h-16 border-b border-slate-200">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-white/95 supports-[backdrop-filter]:bg-white/85 supports-[backdrop-filter]:backdrop-blur-sm"
      />
      <div className="relative flex h-full items-center justify-between gap-2 px-3 sm:gap-3 sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <SidebarToggleButton
            onClick={toggleMobileSidebar}
            className="lg:hidden"
            ariaLabel="Buka menu sidebar"
          />
          <SidebarToggleButton
            onClick={toggleSidebar}
            className={cn('hidden', !sidebarOpen && 'lg:inline-flex')}
            ariaLabel="Tampilkan sidebar"
          />

          {/* Mobile: logo ikon saja, ukuran ringkas */}
          <BrandMark
            size="sm"
            variant="icon"
            framed
            className="shrink-0 lg:hidden [&_.brand-logo]:!h-8 [&_div]:!rounded-xl [&_div]:!p-1"
          />

          {showBrandInTopbar ? (
            <BrandMark
              size="sm"
              variant="compact"
              showTagline={false}
              framed
              className="hidden min-w-0 shrink-0 lg:flex"
            />
          ) : null}

          <div className="min-w-0 flex-1">
            <p className="hidden text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-500 sm:block">
              {user?.role === 'ADMIN' ? 'Admin' : 'Member'}
            </p>
            <h1 className="truncate text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
              <span className="sm:hidden">Hai, {firstName}</span>
              <span className="hidden sm:inline">{pageTitle}</span>
            </h1>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <div className="hidden min-w-0 text-right text-sm lg:block">
            <p className="truncate font-semibold text-slate-900">{user?.name}</p>
            <p className="text-xs text-slate-500">{user?.role === 'ADMIN' ? 'Administrator' : 'Member'}</p>
          </div>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-xs font-bold text-slate-600"
            aria-label="Pengaturan akun"
          >
            {user?.avatarUrl ? (
              <img src={getAssetUrl(user.avatarUrl)} alt={user.name} className="h-full w-full object-cover" />
            ) : (
              parseNameInitials(user?.name)
            )}
          </button>
          <Button variant="ghost" size="sm" onClick={logout} className="hidden lg:inline-flex">
            <LogOut className="mr-2 h-4 w-4" /> Keluar
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            className="h-10 w-10 text-slate-600 lg:hidden"
            aria-label="Keluar"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <AccountSettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </header>
  );
}
