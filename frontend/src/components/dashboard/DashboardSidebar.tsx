import { NavLink, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  Calculator,
  ClipboardList,
  CreditCard,
  Eye,
  FileText,
  FolderOpen,
  GraduationCap,
  HelpCircle,
  History,
  LayoutDashboard,
  Megaphone,
  Newspaper,
  Package,
  Receipt,
  ScanLine,
  Users,
} from 'lucide-react';
import { dashboardMenu, sectionContainsPath } from '@/constants/navigation';
import { BrandMark } from '@/components/common/BrandMark';
import { CollapsibleNavSection } from '@/components/navigation/CollapsibleNavSection';
import { SidebarToggleButton } from '@/components/dashboard/SidebarToggleButton';
import { cn } from '@/utils/cn';
import { useAuth } from '@/hooks/useAuth';
import { useExamControlStatus } from '@/hooks/useExamControl';
import { useMembershipStatus } from '@/hooks/useMembershipStatus';
import { useSidebarStore } from '@/store/sidebar';

const menuIcons: Record<string, LucideIcon> = {
  '/app': LayoutDashboard,
  '/app/pengumuman': Megaphone,
  '/app/faq': HelpCircle,
  '/app/berita': Newspaper,
  '/app/kalkulator': Calculator,
  '/app/latihan/tryout': ClipboardList,
  '/app/latihan-soal': BookOpen,
  '/app/tes-kecermatan': Eye,
  '/app/latihan/tryout/riwayat': History,
  '/app/latihan-soal/riwayat': FileText,
  '/app/tes-kecermatan/riwayat': ScanLine,
  '/app/materi': FolderOpen,
  '/app/paket-membership': Package,
  '/app/konfirmasi-pembayaran': CreditCard,
  '/app/riwayat-transaksi': Receipt,
  '/app/afiliasi': Users,
  '/app/ujian/tryout': GraduationCap,
  '/app/ujian/tryout/riwayat': History,
  '/app/ujian/soal': BookOpen,
  '/app/ujian/soal/riwayat': FileText,
};

type SidebarNavLinkProps = {
  to: string;
  label: string;
  end?: boolean;
  onNavigate?: () => void;
};

function SidebarNavLink({ to, label, end, onNavigate }: SidebarNavLinkProps) {
  const Icon = menuIcons[to] ?? LayoutDashboard;

  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
          isActive
            ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/25'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
              isActive ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-brand-50 group-hover:text-brand-600',
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

type DashboardSidebarPanelProps = {
  onNavigate?: () => void;
  showDesktopToggle?: boolean;
  onToggleDesktop?: () => void;
  onToggleMobile?: () => void;
  showMobileToggle?: boolean;
};

export function DashboardSidebarPanel({
  onNavigate,
  showDesktopToggle = false,
  onToggleDesktop,
  onToggleMobile,
  showMobileToggle = false,
}: DashboardSidebarPanelProps) {
  const { user } = useAuth();
  const location = useLocation();
  const examStatusQuery = useExamControlStatus();
  const membership = useMembershipStatus();
  const examEnabled = examStatusQuery.data?.enabled && examStatusQuery.data?.allowed;
  const restrictFeatures = Boolean(membership.data?.isActive);
  const allowTryout = membership.data?.allowTryout !== false;
  const allowPractice = membership.data?.allowPractice !== false;
  const allowCermat = membership.data?.allowCermat !== false;
  const showCermatOnly = restrictFeatures && allowCermat && !allowTryout && !allowPractice;
  const isPremium = membership.data?.isPremium === true;

  const examSection = [
    { label: 'Tryout', to: '/app/ujian/tryout' },
    { label: 'Riwayat Tryout', to: '/app/ujian/tryout/riwayat' },
    { label: 'Ujian Soal', to: '/app/ujian/soal' },
    { label: 'Riwayat Ujian', to: '/app/ujian/soal/riwayat' },
  ];

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
        <span
          className={cn(
            'mt-2.5 inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
            isPremium ? 'bg-amber-100 text-amber-800' : 'bg-brand-100 text-brand-700',
          )}
        >
          {user?.role === 'ADMIN' ? 'Admin' : isPremium ? 'Premium' : 'Member'}
        </span>
      </div>

      <nav className="sidebar-nav min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3 py-3">
        {dashboardMenu.map((section) => {
          let items = section.items;
          if (section.title === 'Pembelajaran' && showCermatOnly) {
            return null;
          }
          if (restrictFeatures && section.title === 'Pembelajaran') {
            items = items.filter((item) => {
              if (item.label.includes('Tryout')) return allowTryout;
              if (item.label.includes('Latihan Soal')) return allowPractice;
              if (item.label.includes('Tes Kecermatan')) return allowCermat;
              return true;
            });
          }
          if (restrictFeatures && section.title === 'Riwayat') {
            items = items.filter((item) => {
              if (item.label.includes('Tryout')) return allowTryout;
              if (item.label.includes('Latihan')) return allowPractice;
              if (item.label.includes('Kecermatan')) return allowCermat;
              return true;
            });
          }
          if (items.length === 0) {
            return null;
          }

          const active =
            sectionContainsPath(section, location.pathname) ||
            (section.title === 'Pembelajaran' && location.pathname.startsWith('/app/ujian'));

          return (
            <CollapsibleNavSection key={section.title} title={section.title} active={active}>
              {items.map((item) => (
                <SidebarNavLink key={item.to} to={item.to} label={item.label} end={item.exact} onNavigate={onNavigate} />
              ))}
              {section.title === 'Pembelajaran' && examEnabled && (allowTryout || allowPractice) && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <p className="mb-1 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Ujian</p>
                  <div className="space-y-0.5">
                    {examSection.map((item) => (
                      <SidebarNavLink key={item.to} to={item.to} label={item.label} onNavigate={onNavigate} />
                    ))}
                  </div>
                </div>
              )}
            </CollapsibleNavSection>
          );
        })}

        {showCermatOnly && (
          <CollapsibleNavSection title="Tes Kecermatan" active={location.pathname.includes('kecermatan')}>
            <SidebarNavLink to="/app/tes-kecermatan" label="Tes Kecermatan" onNavigate={onNavigate} />
            <SidebarNavLink to="/app/tes-kecermatan/riwayat" label="Riwayat Kecermatan" onNavigate={onNavigate} />
          </CollapsibleNavSection>
        )}
      </nav>

      <div className="shrink-0 border-t border-slate-100 px-4 py-4">
        <div className="rounded-xl bg-slate-50 px-3 py-2.5">
          <p className="truncate text-xs font-semibold text-slate-800">{user?.name}</p>
          <p className="truncate text-[11px] text-slate-500">{user?.email}</p>
        </div>
      </div>
    </div>
  );
}

export function DashboardSidebar() {
  const isOpen = useSidebarStore((state) => state.isOpen);
  const isMobileOpen = useSidebarStore((state) => state.isMobileOpen);
  const toggle = useSidebarStore((state) => state.toggle);
  const toggleMobile = useSidebarStore((state) => state.toggleMobile);
  const setMobileOpen = useSidebarStore((state) => state.setMobileOpen);

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
          'sticky top-0 hidden h-[100dvh] shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-300 ease-in-out lg:flex',
          isOpen ? 'w-64' : 'w-0 overflow-hidden border-r-0',
        )}
      >
        <div className="flex h-full min-h-0 min-w-64 flex-col">
          <DashboardSidebarPanel showDesktopToggle onToggleDesktop={toggle} />
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
              <DashboardSidebarPanel
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
