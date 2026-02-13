import { LogOut, Menu } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { parseNameInitials } from '@/utils/format';
import { Button } from '@/components/ui/button';
import { dashboardMenu } from '@/constants/navigation';
import { useExamControlStatus } from '@/hooks/useExamControl';
import { AccountSettingsModal } from '@/components/dashboard/AccountSettingsModal';
import { getAssetUrl } from '@/lib/media';
import { useMembershipStatus } from '@/hooks/useMembershipStatus';

export function DashboardTopbar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const examStatus = useExamControlStatus();
  const membership = useMembershipStatus();
  const examEnabled = Boolean(examStatus.data?.enabled && examStatus.data?.allowed);
  const restrictFeatures = Boolean(membership.data?.isActive);
  const allowTryout = membership.data?.allowTryout !== false;
  const allowPractice = membership.data?.allowPractice !== false;
  const allowCermat = membership.data?.allowCermat !== false;
  const showCermatOnly = restrictFeatures && allowCermat && !allowTryout && !allowPractice;
  const examSection = [
    { label: 'Tryout', to: '/app/ujian/tryout' },
    { label: 'Riwayat Tryout', to: '/app/ujian/tryout/riwayat' },
    { label: 'Ujian Soal', to: '/app/ujian/soal' },
    { label: 'Riwayat Ujian', to: '/app/ujian/soal/riwayat' },
  ];

  return (
    <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3">
          <img src="/Logo_tactical.png" alt="Tactical Education" className="h-10 w-10 rounded-2xl object-cover" />
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-brand-500">Dashboard</p>
            <p className="text-lg font-semibold text-slate-900">Selamat datang, {user?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right text-sm lg:block">
            <p className="font-semibold text-slate-900">{user?.name}</p>
            <p className="text-xs text-slate-500">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-sm font-bold text-slate-600"
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
          <button className="lg:hidden" onClick={() => setOpen((prev) => !prev)}>
            <Menu className="h-6 w-6" />
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-slate-200 bg-white px-4 py-4 lg:hidden">
          {dashboardMenu.map((section) => {
            let items = section.items;
            if (section.title === 'Latihan' && showCermatOnly) {
              return null;
            }
            if (restrictFeatures && section.title === 'Latihan') {
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
            return (
            <div key={section.title} className="mb-4">
              <p className="text-xs font-bold uppercase text-slate-500">{section.title}</p>
              <div className="mt-2 flex flex-col gap-2">
                {items.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className="rounded-2xl border border-slate-100 px-3 py-2 text-sm font-semibold text-slate-700"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
              {section.title === 'Latihan' && examEnabled && (allowTryout || allowPractice) && (
                <div className="mt-4">
                  <p className="text-xs font-bold uppercase text-slate-500">UJIAN</p>
                  <div className="mt-2 flex flex-col gap-2">
                    {examSection.map((item) => (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => setOpen(false)}
                        className="rounded-2xl border border-slate-100 px-3 py-2 text-sm font-semibold text-slate-700"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
            );
          })}
          {showCermatOnly && (
            <div className="mb-4">
              <p className="text-xs font-bold uppercase text-slate-500">Tes Kecermatan</p>
              <div className="mt-2 flex flex-col gap-2">
                <Link
                  to="/app/tes-kecermatan"
                  onClick={() => setOpen(false)}
                  className="rounded-2xl border border-slate-100 px-3 py-2 text-sm font-semibold text-slate-700"
                >
                  Tes Kecermatan
                </Link>
                <Link
                  to="/app/tes-kecermatan/riwayat"
                  onClick={() => setOpen(false)}
                  className="rounded-2xl border border-slate-100 px-3 py-2 text-sm font-semibold text-slate-700"
                >
                  Riwayat Kecermatan
                </Link>
              </div>
            </div>
          )}
          <Button variant="outline" className="w-full" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" /> Keluar
          </Button>
        </div>
      )}
      <AccountSettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
