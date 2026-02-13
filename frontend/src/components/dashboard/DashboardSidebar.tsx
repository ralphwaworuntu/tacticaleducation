import { NavLink } from 'react-router-dom';
import { dashboardMenu } from '@/constants/navigation';
import { cn } from '@/utils/cn';
import { useAuth } from '@/hooks/useAuth';
import { useExamControlStatus } from '@/hooks/useExamControl';
import { useMembershipStatus } from '@/hooks/useMembershipStatus';

export function DashboardSidebar() {
  const { user } = useAuth();
  const examStatusQuery = useExamControlStatus();
  const membership = useMembershipStatus();
  const examEnabled = examStatusQuery.data?.enabled && examStatusQuery.data?.allowed;
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
    <aside className="hidden w-72 flex-col border-r border-slate-200 bg-white px-4 py-8 lg:flex">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-brand-500 px-3 py-2 text-sm font-semibold text-white">TE</div>
        <div>
          <p className="text-sm font-semibold text-slate-900">Tactical Education</p>
          <p className="text-xs text-slate-500">{user?.role === 'ADMIN' ? 'Admin Panel' : 'Dashboard Member'}</p>
        </div>
      </div>

      <div className="mt-6 space-y-6">
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
          <div key={section.title}>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{section.title}</p>
            <div className="mt-3 space-y-1">
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.exact}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center justify-between rounded-2xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50',
                      isActive && 'bg-brand-50 text-brand-600',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
            {section.title === 'Latihan' && examEnabled && (allowTryout || allowPractice) && (
              <div className="mt-6">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">UJIAN</p>
                <div className="mt-3 space-y-1">
                  {examSection.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center justify-between rounded-2xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50',
                          isActive && 'bg-brand-50 text-brand-600',
                        )
                      }
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            )}
          </div>
          );
        })}
        {showCermatOnly && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Tes Kecermatan</p>
            <div className="mt-3 space-y-1">
              <NavLink
                to="/app/tes-kecermatan"
                className={({ isActive }) =>
                  cn(
                    'flex items-center justify-between rounded-2xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50',
                    isActive && 'bg-brand-50 text-brand-600',
                  )
                }
              >
                Tes Kecermatan
              </NavLink>
              <NavLink
                to="/app/tes-kecermatan/riwayat"
                className={({ isActive }) =>
                  cn(
                    'flex items-center justify-between rounded-2xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50',
                    isActive && 'bg-brand-50 text-brand-600',
                  )
                }
              >
                Riwayat Kecermatan
              </NavLink>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
