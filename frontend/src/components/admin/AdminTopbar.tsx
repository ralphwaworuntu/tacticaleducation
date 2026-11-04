import { LogOut, LayoutDashboard } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { SidebarToggleButton } from '@/components/dashboard/SidebarToggleButton';
import { BrandMark } from '@/components/common/BrandMark';
import { parseNameInitials } from '@/utils/format';
import { useAdminSidebarStore } from '@/store/adminSidebar';
import { adminMenu, findNavLabel } from '@/constants/navigation';
import { cn } from '@/utils/cn';

export function AdminTopbar() {
  const { user, logout } = useAuth();
  const sidebarOpen = useAdminSidebarStore((state) => state.isOpen);
  const toggleSidebar = useAdminSidebarStore((state) => state.toggle);
  const toggleMobileSidebar = useAdminSidebarStore((state) => state.toggleMobile);
  const showBrandInTopbar = !sidebarOpen;
  const location = useLocation();
  const pageTitle = findNavLabel(location.pathname, adminMenu) ?? 'Admin Panel';

  return (
    <header className="relative z-20 h-16 shrink-0 border-b border-slate-200/80">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-white/90 shadow-sm supports-[backdrop-filter]:bg-white/80 supports-[backdrop-filter]:backdrop-blur-md"
      />
      <div className="relative flex h-full items-center justify-between gap-2 px-3 sm:gap-3 sm:px-6">
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
            <p className="hidden text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-500 sm:block">Admin</p>
            <h1 className="truncate text-base font-semibold tracking-tight text-slate-900 sm:text-lg">{pageTitle}</h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <Button variant="outline" size="sm" className="hidden md:inline-flex" asChild>
            <Link to="/app">
              <LayoutDashboard className="mr-2 h-4 w-4" /> Member Area
            </Link>
          </Button>
          <div className="hidden min-w-0 text-right lg:block">
            <p className="truncate text-sm font-semibold text-slate-900">{user?.name}</p>
            <p className="text-xs text-slate-500">Administrator</p>
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-xs font-bold text-brand-700 ring-1 ring-brand-100 sm:h-10 sm:w-10">
            {parseNameInitials(user?.name)}
          </div>
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
    </header>
  );
}
