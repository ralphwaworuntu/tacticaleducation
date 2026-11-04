import { NavLink } from 'react-router-dom';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  BookOpen,
  Calculator,
  ClipboardList,
  FolderOpen,
  LayoutDashboard,
  Mail,
  Megaphone,
  Package,
  ShieldCheck,
  Trophy,
  UserCog,
  Users,
  LayoutTemplate,
  BadgeCheck,
  FileText,
  Eye,
  Radio,
  ListChecks,
  History,
  Settings2,
} from 'lucide-react';
import { adminMenu } from '@/constants/navigation';
import { BrandMark } from '@/components/common/BrandMark';
import { SidebarToggleButton } from '@/components/dashboard/SidebarToggleButton';
import { cn } from '@/utils/cn';
import { useAuth } from '@/hooks/useAuth';
import { useAdminSidebarStore } from '@/store/adminSidebar';

const menuIcons: Record<string, LucideIcon> = {
  '/admin': LayoutDashboard,
  '/admin/landing': LayoutTemplate,
  '/admin/announcements': Megaphone,
  '/admin/reporting': BarChart3,
  '/admin/ranking': Trophy,
  '/admin/contacts': Mail,
  '/admin/exam-control': ShieldCheck,
  '/admin/live-quiz': Radio,
  '/admin/live-quiz/kuis': ListChecks,
  '/admin/live-quiz/riwayat': History,
  '/admin/live-quiz/pengaturan': Settings2,
  '/admin/tryouts': ClipboardList,
  '/admin/word-converter': FileText,
  '/admin/practice': BookOpen,
  '/admin/kecermatan': Eye,
  '/admin/materials': FolderOpen,
  '/admin/calculators': Calculator,
  '/admin/commerce': Package,
  '/admin/activation': BadgeCheck,
  '/admin/monitoring': Users,
  '/admin/users': UserCog,
};

type AdminSidebarNavLinkProps = {
  to: string;
  label: string;
  end?: boolean;
  onNavigate?: () => void;
};

function AdminSidebarNavLink({ to, label, end, onNavigate }: AdminSidebarNavLinkProps) {
  const Icon = menuIcons[to] ?? LayoutDashboard;

  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium transition-all',
          isActive
            ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
              isActive
                ? 'bg-white/15 text-white'
                : 'bg-slate-100 text-slate-500 group-hover:bg-brand-50 group-hover:text-brand-600',
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
          <span className="truncate">{label}</span>
        </>
      )}
    </NavLink>
  );
}

function AdminSidebarSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

type AdminSidebarPanelProps = {
  onNavigate?: () => void;
  showDesktopToggle?: boolean;
  onToggleDesktop?: () => void;
  onToggleMobile?: () => void;
  showMobileToggle?: boolean;
};

function AdminSidebarPanel({
  onNavigate,
  showDesktopToggle = false,
  onToggleDesktop,
  onToggleMobile,
  showMobileToggle = false,
}: AdminSidebarPanelProps) {
  const { user } = useAuth();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-slate-100 px-3 py-3.5 sm:px-4">
        <div className="flex items-center gap-2">
          <BrandMark
            size="sm"
            variant="compact"
            showTagline={false}
            framed
            className="min-w-0 flex-1"
          />
          {showDesktopToggle && onToggleDesktop ? (
            <SidebarToggleButton
              onClick={onToggleDesktop}
              className="hidden shrink-0 lg:inline-flex"
              ariaLabel="Sembunyikan sidebar"
            />
          ) : null}
          {showMobileToggle && onToggleMobile ? (
            <SidebarToggleButton
              onClick={onToggleMobile}
              className="shrink-0 lg:hidden"
              ariaLabel="Tutup menu"
            />
          ) : null}
        </div>
        <span className="mt-2.5 inline-flex rounded-full bg-slate-900 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          {user?.name ?? 'Administrator'}
        </span>
      </div>

      <nav className="sidebar-nav min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-3 py-4">
        {adminMenu.map((section) => (
          <AdminSidebarSection key={section.title} title={section.title}>
            {section.items.map((item) => (
              <AdminSidebarNavLink key={item.to} to={item.to} label={item.label} end={item.exact} onNavigate={onNavigate} />
            ))}
          </AdminSidebarSection>
        ))}
      </nav>

      <div className="shrink-0 border-t border-slate-100 px-4 py-4">
        <div className="rounded-xl bg-slate-50 px-3 py-2.5">
          <p className="truncate text-xs font-semibold text-slate-800">{user?.name ?? 'Administrator'}</p>
          <p className="truncate text-[11px] text-slate-500">{user?.email}</p>
        </div>
      </div>
    </div>
  );
}

export function AdminSidebar() {
  const isOpen = useAdminSidebarStore((state) => state.isOpen);
  const isMobileOpen = useAdminSidebarStore((state) => state.isMobileOpen);
  const toggle = useAdminSidebarStore((state) => state.toggle);
  const toggleMobile = useAdminSidebarStore((state) => state.toggleMobile);
  const setMobileOpen = useAdminSidebarStore((state) => state.setMobileOpen);

  useEffect(() => {
    if (!isMobileOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isMobileOpen]);

  return (
    <>
      <aside
        className={cn(
          'relative z-10 hidden h-full shrink-0 flex-col border-r border-slate-200/80 bg-white/95 shadow-[4px_0_24px_-12px_rgba(15,23,42,0.12)] backdrop-blur-sm transition-[width] duration-300 ease-in-out lg:flex',
          isOpen ? 'w-[17.5rem]' : 'w-0 overflow-hidden border-r-0 shadow-none',
        )}
      >
        <div className="flex h-full min-h-0 min-w-[17.5rem] flex-col">
          <AdminSidebarPanel showDesktopToggle onToggleDesktop={toggle} />
        </div>
      </aside>

      {isMobileOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            <button
              type="button"
              aria-label="Tutup menu"
              className="fixed inset-0 z-[60] bg-slate-900/50 touch-none lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <aside
              className="fixed inset-y-0 left-0 z-[70] flex h-[100dvh] max-h-[100dvh] w-[min(18rem,92vw)] flex-col overflow-hidden border-r border-slate-200 bg-white shadow-xl lg:hidden"
              style={{
                paddingTop: 'env(safe-area-inset-top)',
                paddingBottom: 'env(safe-area-inset-bottom)',
              }}
            >
              <AdminSidebarPanel
                showMobileToggle
                onToggleMobile={toggleMobile}
                onNavigate={() => setMobileOpen(false)}
              />
            </aside>
          </>,
          document.body,
        )}
    </>
  );
}
