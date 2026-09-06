import { LogOut, LayoutDashboard } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { SidebarToggleButton } from '@/components/dashboard/SidebarToggleButton';
import { BrandMark } from '@/components/common/BrandMark';
import { parseNameInitials } from '@/utils/format';
import { useAdminSidebarStore } from '@/store/adminSidebar';
import { cn } from '@/utils/cn';

export function AdminTopbar() {
  const { user, logout } = useAuth();
  const sidebarOpen = useAdminSidebarStore((state) => state.isOpen);
  const toggleSidebar = useAdminSidebarStore((state) => state.toggle);
  const toggleMobileSidebar = useAdminSidebarStore((state) => state.toggleMobile);
  const showBrandInTopbar = !sidebarOpen;

  return (
    <div className="relative z-20 shrink-0 border-b border-slate-200/80">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-white/90 shadow-sm supports-[backdrop-filter]:bg-white/75 supports-[backdrop-filter]:backdrop-blur-md"
      />
      <div className="relative flex items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3.5">
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
            <p className="hidden text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-500 sm:block">
              Admin Panel
            </p>
            <h1 className="truncate text-sm font-semibold tracking-tight text-slate-900 sm:hidden">Admin</h1>
            <h1 className="hidden truncate text-sm font-semibold tracking-tight text-slate-900 sm:block sm:text-base">
              Mengelola Tactical Education
            </h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <Button variant="outline" size="sm" className="hidden md:inline-flex" asChild>
            <Link to="/app">
              <LayoutDashboard className="mr-2 h-4 w-4" /> Member Area
            </Link>
          </Button>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-slate-100 text-xs font-bold text-brand-700 ring-1 ring-brand-100 sm:h-11 sm:w-11 sm:rounded-2xl sm:text-sm">
            {parseNameInitials(user?.name)}
          </div>
          <Button variant="ghost" size="sm" onClick={logout} className="hidden lg:inline-flex">
            <LogOut className="mr-2 h-4 w-4" /> Keluar
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={logout}
            className="h-9 w-9 text-slate-600 lg:hidden"
            aria-label="Keluar"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
