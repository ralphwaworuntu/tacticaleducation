import { Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { getAssetUrl } from '@/lib/media';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { DashboardTopbar } from '@/components/dashboard/DashboardTopbar';
import { WelcomeModal } from '@/components/dashboard/WelcomeModal';

type MemberBackgroundConfig = {
  enabled: boolean;
  imageUrl?: string | null;
};

export function DashboardLayout() {
  const { data: background } = useQuery({
    queryKey: ['member-background'],
    queryFn: () => apiGet<MemberBackgroundConfig>('/dashboard/member-background'),
  });
  const backgroundUrl = background?.enabled && background.imageUrl ? getAssetUrl(background.imageUrl) : '';
  const backgroundStyle = backgroundUrl
    ? {
        backgroundImage: `url('${backgroundUrl}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
      }
    : undefined;

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 lg:flex" style={backgroundStyle}>
      <DashboardSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopbar />
        <WelcomeModal />
        <main className="flex-1 overflow-x-hidden px-4 py-6">
          <div className="mx-auto w-full max-w-6xl min-w-0">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
