import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Loader2, LogIn, Rocket } from 'lucide-react';
import { apiGet, apiPost, getApiErrorMessage } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { liveAudio } from '../audio';
import { AVATARS, PlayerAvatar } from '../avatars';
import { useMotionLevel } from '../useMotionLevel';
import { AvatarPicker } from '../ui/AvatarPicker';
import { GameStage, LiveBrand } from '../ui/GameStage';
import { avatarPreference, playerStorage } from './storage';

type JoinResult = {
  sessionId: string;
  playerId: string;
  playerToken: string;
  displayName: string;
  avatarId?: string;
  rejoined: boolean;
};

type PinInfo = { title: string; joinable: boolean; reason: string | null };

/**
 * Alur gabung: (QR / PIN) -> isi nama -> PILIH KARAKTER -> JOIN THE GAME -> lobby.
 * Tautan QR sudah membawa PIN, jadi pemain biasanya hanya mengisi nama lalu memilih karakter.
 */
export function LiveJoinPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const { animate, level } = useMotionLevel(true);
  const [step, setStep] = useState<1 | 2>(1);
  const [pin, setPin] = useState((params.get('pin') ?? '').replace(/\D/g, '').slice(0, 6));
  const [name, setName] = useState('');
  const [avatarId, setAvatarId] = useState<string>(() => {
    const saved = avatarPreference.load();
    return saved && AVATARS.some((a) => a.id === saved) ? saved : AVATARS[Math.floor(Math.random() * AVATARS.length)]!.id;
  });
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

  const step1Ready = pin.length === 6 && name.trim().length > 0 && info?.joinable !== false;
  const chosen = useMemo(() => AVATARS.find((a) => a.id === avatarId) ?? null, [avatarId]);

  const goNext = (event: FormEvent) => {
    event.preventDefault();
    liveAudio.unlock();
    setError(null);
    if (pin.length !== 6) return setError('PIN harus 6 digit.');
    if (!name.trim()) return setError('Nama wajib diisi.');
    if (!step1Ready) return;
    setStep(2);
  };

  const join = async () => {
    if (submitting) return;
    liveAudio.unlock();
    setError(null);
    setSubmitting(true);
    try {
      const stored = playerStorage.loadLast();
      const result = await apiPost<JoinResult, Record<string, unknown>>('/live/join', {
        pin,
        name: name.trim(),
        avatarId,
        ...(stored && stored.pin === pin ? { rejoinToken: stored.playerToken } : {}),
      });
      playerStorage.save({
        sessionId: result.sessionId,
        playerId: result.playerId,
        playerToken: result.playerToken,
        name: result.displayName,
        ...(result.avatarId ? { avatarId: result.avatarId } : {}),
        pin,
      });
      avatarPreference.save(avatarId);
      liveAudio.play('join');
      navigate(`/live/play/${result.sessionId}`, { replace: true });
    } catch (e) {
      const message = getApiErrorMessage(e, 'Gagal bergabung. Coba lagi.');
      setError(message);
      // Nama bentrok / PIN salah: kembali ke langkah 1 supaya bisa diperbaiki.
      if (/nama|pin|sesi/i.test(message)) setStep(1);
      setSubmitting(false);
    }
  };

  const slide = { initial: animate ? { opacity: 0, x: 24 } : false, animate: { opacity: 1, x: 0 }, exit: animate ? { opacity: 0, x: -24 } : { opacity: 0 }, transition: { duration: 0.22 } } as const;

  return (
    <GameStage level={level} className="flex min-h-[100dvh] flex-col items-center justify-center px-5 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-5 flex flex-col items-center text-center">
          <LiveBrand />
          <p className="mt-3 text-sm font-semibold text-sky-100">
            {step === 1 ? 'Masukkan PIN dan namamu' : 'Pilih karakter jagoanmu'}
          </p>
          <div className="mt-3 flex items-center gap-2" aria-label={`Langkah ${step} dari 2`}>
            {[1, 2].map((n) => (
              <span key={n} className={`h-2 rounded-full transition-all ${n === step ? 'w-8 bg-amber-300' : 'w-2 bg-white/30'}`} />
            ))}
          </div>
        </div>

        {last && step === 1 && (
          <button
            type="button"
            onClick={() => navigate(`/live/play/${last.sessionId}`)}
            className="lq-glass mb-4 flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-white"
          >
            <PlayerAvatar avatarId={last.avatarId} seed={last.playerId} size={40} />
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-amber-200">Lanjutkan sesi sebelumnya</span>
              <span className="block truncate font-bold">{last.name}</span>
            </span>
            <LogIn className="h-5 w-5 shrink-0 text-amber-200" />
          </button>
        )}

        <div className="lq-card-light overflow-hidden rounded-[2rem] p-6">
          <AnimatePresence mode="wait" initial={false}>
            {step === 1 ? (
              <motion.form key="s1" onSubmit={goNext} className="space-y-4" {...slide}>
                <div>
                  <label htmlFor="live-pin" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
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
                    className="h-14 w-full rounded-2xl border-2 border-slate-200 bg-white text-center text-3xl font-black tracking-[0.4em] text-slate-900 focus:border-blue-500 focus:outline-none"
                  />
                  {info && (
                    <p className={`mt-2 text-sm font-semibold ${info.joinable ? 'text-emerald-600' : 'text-red-600'}`}>
                      {info.title}
                      {!info.joinable && info.reason ? ` — ${info.reason}` : ''}
                    </p>
                  )}
                  {pinError && <p className="mt-2 text-sm font-semibold text-red-600">{pinError}</p>}
                </div>
                <div>
                  <label htmlFor="live-name" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
                    Nama kamu
                  </label>
                  <input
                    id="live-name"
                    autoComplete="nickname"
                    maxLength={20}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nama panggilan"
                    className="h-12 w-full rounded-2xl border-2 border-slate-200 bg-white px-4 text-lg font-semibold text-slate-900 focus:border-blue-500 focus:outline-none"
                  />
                  <p className="mt-1.5 text-xs text-slate-500">
                    {user ? `Login sebagai ${user.name}. Hasil tercatat di akunmu.` : 'Tanpa login pun bisa. Maksimal 20 karakter.'}
                  </p>
                </div>
                {error && (
                  <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                    {error}
                  </p>
                )}
                <button type="submit" disabled={!step1Ready} className="lq-btn lq-btn-electric h-14 w-full text-lg">
                  Pilih karakter <ArrowRight className="h-5 w-5" />
                </button>
              </motion.form>
            ) : (
              <motion.div key="s2" className="space-y-4" {...slide}>
                <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-3">
                  <PlayerAvatar avatarId={avatarId} size={72} ring idle={animate} />
                  <div className="min-w-0">
                    <p className="truncate text-xl font-black text-slate-900">{name.trim()}</p>
                    <p className="text-sm font-semibold text-slate-500">{chosen?.name ?? 'Pilih karakter'}</p>
                  </div>
                </div>
                <AvatarPicker
                  value={avatarId}
                  onChange={(id) => {
                    liveAudio.unlock();
                    liveAudio.play('avatarPick');
                    setAvatarId(id);
                  }}
                />
                {error && (
                  <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                    {error}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    disabled={submitting}
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700 transition active:scale-95"
                    aria-label="Kembali"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <button type="button" onClick={() => void join()} disabled={submitting} className="lq-btn lq-btn-gold h-14 flex-1 text-lg">
                    {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Rocket className="h-5 w-5" />}
                    JOIN THE GAME
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="mt-5 text-center text-sm text-sky-100/80">
          <Link to="/" className="underline underline-offset-2">
            Kembali ke beranda
          </Link>
        </p>
      </div>
    </GameStage>
  );
}
