import { Outlet } from 'react-router-dom';
import { Navbar } from '@/components/navigation/Navbar';
import { Footer } from '@/components/navigation/Footer';
import { FloatingWhatsapp } from '@/components/sections/FloatingWhatsapp';

export function PublicLayout() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <Outlet />
      </main>
      <Footer />
      <FloatingWhatsapp />
    </div>
  );
}
