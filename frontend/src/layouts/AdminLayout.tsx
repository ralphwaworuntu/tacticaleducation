import { Outlet } from 'react-router-dom';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminTopbar } from '@/components/admin/AdminTopbar';

export function AdminLayout() {
  return (
    <div className="relative flex h-[100dvh] overflow-hidden bg-[#F4F7FB]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(23,51,107,0.06),_transparent_55%),linear-gradient(180deg,#F4F7FB_0%,#eef3f9_100%)]"
      />
      <AdminSidebar />
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <AdminTopbar />
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 sm:px-6 lg:px-8">
          <div className="mx-auto w-full min-w-0 max-w-[1500px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
