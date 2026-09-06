import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { publicNavLinks } from '@/constants/navigation';
import { Button } from '@/components/ui/button';
import { BrandMark } from '@/components/common/BrandMark';
import { cn } from '@/utils/cn';
import { useAuth } from '@/hooks/useAuth';

export function Navbar() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!open) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-100 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:gap-3 sm:py-3.5">
        <BrandMark href="/" size="md" tagline="Bimbel & Tryout Center" framed />

        <nav className="hidden gap-6 text-sm font-medium text-slate-600 md:flex">
          {publicNavLinks.map((link) => (
            <NavLink
              key={link.href}
              to={link.href}
              className={({ isActive }) =>
                cn(
                  'transition-colors hover:text-brand-600',
                  (isActive || pathname === link.href) && 'font-semibold text-brand-600',
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {isAuthenticated ? (
            <Button variant="outline" asChild>
              <Link to="/app">Buka Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link to="/auth/login">Login</Link>
              </Button>
              <Button asChild>
                <Link to="/auth/register">Daftar</Link>
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          className="relative z-50 rounded-xl p-2 text-slate-600 transition hover:bg-slate-100 md:hidden"
          onClick={() => setOpen((prev) => !prev)}
          aria-label={open ? 'Tutup menu' : 'Buka menu'}
          aria-expanded={open}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Tutup menu"
            className="absolute inset-0 bg-slate-950/40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-x-0 top-0 border-b border-slate-100 bg-white shadow-lg">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3">
              <BrandMark href="/" size="md" tagline="Bimbel & Tryout Center" framed />
              <button
                type="button"
                className="rounded-xl p-2 text-slate-600 transition hover:bg-slate-100"
                onClick={() => setOpen(false)}
                aria-label="Tutup menu"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="border-t border-slate-100 px-4 pb-5 pt-2">
              <nav className="flex flex-col gap-1 py-2 text-sm font-semibold text-slate-800">
                {publicNavLinks.map((link) => (
                  <NavLink
                    key={link.href}
                    to={link.href}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'rounded-xl px-3 py-3 text-slate-800 hover:bg-slate-50',
                        isActive && 'bg-brand-50 text-brand-700',
                      )
                    }
                  >
                    {link.label}
                  </NavLink>
                ))}
              </nav>
              <div className="mt-2 flex flex-col gap-2">
                {isAuthenticated ? (
                  <Button asChild>
                    <Link to="/app" onClick={() => setOpen(false)}>
                      Buka Dashboard
                    </Link>
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" asChild>
                      <Link to="/auth/login" onClick={() => setOpen(false)}>
                        Login
                      </Link>
                    </Button>
                    <Button asChild>
                      <Link to="/auth/register" onClick={() => setOpen(false)}>
                        Daftar
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
