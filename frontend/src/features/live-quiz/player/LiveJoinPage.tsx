import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, LogIn } from 'lucide-react';
import { apiGet, apiPost, getApiErrorMessage } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { liveAudio } from '../audio';
import { liveBackground } from '../ui/shared';
import { playerStorage } from './storage';

type JoinResult = {
  sessionId: string;
  playerId: string;
  playerToken: string;
  displayName: string;
  rejoined: boolean;
};

type PinInfo = { title: string; joinable: boolean; reason: string | null };

export function LiveJoinPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const [pin, setPin] = useState((params.get('pin') ?? '').replace(/\D/g, '').slice(0, 6));
  const [name, setName] = useState('');
  const [info, setInfo] = useState<PinInfo | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const last = params.get('pin') ? null : playerStorage.loadLast();

  // Akun yang sedang login: nama terisi otomatis (tetap bisa diubah) dan skor tercatat ke akun.
  useEffect(() => {
    if (user?.name && !name) setName(user.name.slice(0, 20));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.name]);

  // Cek PIN begitu 6 digit terisi supaya salah ketik langsung terlihat.
  useEffect(() => {
    setInfo(null);
    setPinError(null);
    if (pin.length !== 6) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      apiGet<PinInfo>(`/live/pin/${pin}`)
        .then((data) => {
          if (!cancelled) setInfo(data);
        })
        .catch((e) => {
          if (!cancelled) setPinError(getApiErrorMessage(e, 'PIN tidak ditemukan.'));
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [pin]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    liveAudio.unlock();
    setError(null);
    if (pin.length !== 6) return setError('PIN harus 6 digit.');
    if (!name.trim()) return setError('Nama wajib diisi.');
    setSubmitting(true);
    try {
      const stored = playerStorage.loadLast();
      const result = await apiPost<JoinResult, Record<string, unknown>>('/live/join', {
        pin,
        name: name.trim(),
        ...(stored && stored.pin === pin ? { rejoinToken: stored.playerToken } : {}),
      });
      playerStorage.save({
        sessionId: result.sessionId,
        playerId: result.playerId,
        playerToken: result.playerToken,
        name: result.displayName,
        pin,
      });
      liveAudio.play('join');
      navigate(`/live/play/${result.sessionId}`, { replace: true });
    } catch (e) {
      setError(getApiErrorMessage(e, 'Gagal bergabung. Coba lagi.'));
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-5 py-10" style={liveBackground}>
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center text-white">
          <img src="/Logo_tactical.png" alt="Tactical Education" className="mb-3 h-16 w-16 rounded-2xl bg-white/90 object-contain p-2" />
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-amber-300">Tactical Live Quiz</p>
          <h1 className="mt-1 text-2xl font-black">Gabung Kuis</h1>
        </div>

        {last && (
          <button
            type="button"
            onClick={() => navigate(`/live/play/${last.sessionId}`)}
            className="mb-4 flex w-full items-center justify-between gap-3 rounded-2xl bg-amber-400/20 px-4 py-3 text-left text-white ring-1 ring-amber-300/50"
          >
            <span className="min-w-0">
              <span className="block text-xs text-amber-200">Lanjutkan sesi sebelumnya</span>
              <span className="block truncate font-bold">{last.name}</span>
            </span>
            <LogIn className="h-5 w-5 shrink-0 text-amber-200" />
          </button>
        )}

        <form onSubmit={submit} className="space-y-4 rounded-3xl bg-white p-6 shadow-2xl">
          <div>
            <label htmlFor="live-pin" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              PIN Game
            </label>
            <input
              id="live-pin"
              inputMode="numeric"
              autoComplete="off"
              pattern="\d{6}"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              className="h-14 w-full rounded-2xl border border-slate-200 text-center text-3xl font-black tracking-[0.4em] text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {info && (
              <p className={`mt-2 text-sm ${info.joinable ? 'text-emerald-600' : 'text-red-600'}`}>
                {info.title}
                {!info.joinable && info.reason ? ` — ${info.reason}` : ''}
              </p>
            )}
            {pinError && <p className="mt-2 text-sm text-red-600">{pinError}</p>}
          </div>
          <div>
            <label htmlFor="live-name" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Nama kamu
            </label>
            <input
              id="live-name"
              autoComplete="nickname"
              maxLength={20}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama panggilan"
              className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              {user ? `Login sebagai ${user.name}. Hasil tercatat di akunmu.` : 'Tanpa login pun bisa. Maksimal 20 karakter.'}
            </p>
          </div>
          {error && (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting || pin.length !== 6 || !name.trim() || info?.joinable === false}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-brand-500 to-brand-700 text-lg font-bold text-white shadow-lg transition active:scale-[0.98] disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
            Masuk
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-sky-100/80">
          <Link to="/" className="underline underline-offset-2">
            Kembali ke beranda
          </Link>
        </p>
      </div>
    </div>
  );
}
