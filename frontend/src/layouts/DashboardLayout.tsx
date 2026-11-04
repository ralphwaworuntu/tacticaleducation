import { Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { getAssetUrl } from '@/lib/media';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { DashboardTopbar } from '@/components/dashboard/DashboardTopbar';
import { MemberBottomNav } from '@/components/dashboard/MemberBottomNav';
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
    <div className="min-h-screen overflow-x-hidden bg-[#F4F7FB] lg:flex" style={backgroundStyle}>
      <DashboardSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopbar />
        <WelcomeModal />
        <main className="flex-1 overflow-x-hidden px-4 py-5 pb-24 sm:px-6 lg:px-8 lg:pb-8">
          <div className="mx-auto w-full min-w-0 max-w-[1400px]">
            <Outlet />
          </div>
        </main>
      </div>
      <MemberBottomNav />
    </div>
  );
}
