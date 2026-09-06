import { LogOut } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { parseNameInitials } from '@/utils/format';
import { Button } from '@/components/ui/button';
import { AccountSettingsModal } from '@/components/dashboard/AccountSettingsModal';
import { SidebarToggleButton } from '@/components/dashboard/SidebarToggleButton';
import { BrandMark } from '@/components/common/BrandMark';
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

  const firstName = useMemo(() => {
    const raw = user?.name?.trim() ?? '';
    if (!raw) return 'Member';
    return raw.split(/\s+/)[0] ?? 'Member';
  }, [user?.name]);

  return (
    <div className="relative sticky top-0 z-20 border-b border-slate-200">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-white/95 supports-[backdrop-filter]:bg-white/80 supports-[backdrop-filter]:backdrop-blur-sm"
      />
      <div className="relative flex items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-5 sm:py-3.5">
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
            <p className="hidden text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-500 sm:block">
              Dashboard
            </p>
            {/* HP: sapaan singkat agar tidak terpotong */}
            <p className="truncate text-sm font-semibold tracking-tight text-slate-900 sm:hidden">
              Hai, {firstName}
            </p>
            <p className="hidden truncate text-sm font-semibold tracking-tight text-slate-900 sm:block lg:text-[0.95rem]">
              Selamat datang, {user?.name}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <div className="hidden text-right text-sm lg:block">
            <p className="font-semibold text-slate-900">{user?.name}</p>
            <p className="text-xs text-slate-500">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-xs font-bold text-slate-600 sm:h-11 sm:w-11 sm:rounded-2xl sm:text-sm"
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
            className="h-9 w-9 text-slate-600 lg:hidden"
            aria-label="Keluar"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <AccountSettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
