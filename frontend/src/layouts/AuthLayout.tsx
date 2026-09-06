import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-center gap-10 px-4 py-16 lg:flex-row">
        <div className="max-w-md text-center lg:text-left">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-500">Tactical Education</p>
          <h1 className="mt-4 text-4xl font-bold text-slate-900">Dashboard Member & Tryout Center</h1>
          <p className="mt-3 text-slate-600">
            Kelola progres belajar, akses tryout terbaru, dan pantau riwayat transaksi dalam satu aplikasi PWA yang siap
            digunakan di perangkat apa pun.
          </p>
        </div>
        <div className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-8 shadow-xl">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
