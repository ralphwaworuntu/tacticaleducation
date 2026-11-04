import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3,
  Check,
  Expand,
  Lock,
  LogOut,
  Pause,
  Play,
  SkipForward,
  Trophy,
  Unlock,
  Users,
  X,
} from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { getAssetUrl } from '@/lib/media';
import { cn } from '@/utils/cn';
import { liveQuizApi } from '../api';
import { liveAudio, type Sfx } from '../audio';
import { formatPin } from '../format';
import type { ClientSettings, JoinInfo, LobbyPlayer } from '../types';
import { useLiveSession, type HostAction, type LiveState } from '../useLiveSession';
import { usePrefersReducedMotion } from '../useReducedMotion';
import {
  AnimatedNumber,
  CenterCard,
  Leaderboard,
  OPTION_STYLES,
  OptionContent,
  Podium,
  ReconnectBanner,
  RichText,
  SoundToggle,
  TimerRing,
  liveBackground,
  useRemainingMs,
} from '../ui/shared';

function buildJoinUrl(join: JoinInfo): string {
  if (join.joinBaseUrl) return `${join.joinBaseUrl}/live/join?pin=${join.pin}`;
  const { protocol, hostname, port, origin } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    const lan = join.lanHosts[0];
    if (lan) return `${protocol}//${lan}${port ? `:${port}` : ''}/live/join?pin=${join.pin}`;
  }
  return `${origin}/live/join?pin=${join.pin}`;
}

const stripProtocol = (url: string) => url.replace(/^https?:\/\//, '').replace(/\?.*$/, '');

/* ------------------------------------------------------------------ */
/* Tahap-tahap layar                                                    */
/* ------------------------------------------------------------------ */

function HostLobby({
  state,
  join,
  onKick,
}: {
  state: LiveState;
  join: JoinInfo | null;
  onKick: (player: LobbyPlayer) => void;
}) {
  const players = state.lobby?.players ?? [];
  const url = join ? buildJoinUrl(join) : null;
  const isLocalOnly = url ? /\/\/(localhost|127\.0\.0\.1)/.test(url) : false;
  const animate = state.settings?.animationsEnabled !== false;

  return (
    <div className="grid h-full min-h-0 gap-6 lg:grid-cols-[minmax(320px,440px)_1fr]">
      <div className="flex flex-col items-center justify-center gap-5 rounded-3xl bg-white/10 p-6 text-center text-white backdrop-blur">
        <p className="text-lg font-semibold text-sky-100">
          Buka <span className="font-black text-white">{url ? stripProtocol(url) : '…'}</span>
        </p>
        <p className="text-sm uppercase tracking-[0.3em] text-sky-200">PIN Game</p>
        <p className="text-6xl font-black tracking-widest text-amber-300 sm:text-7xl" aria-label={`PIN ${state.session?.pin ?? ''}`}>
          {state.session?.pin ? formatPin(state.session.pin) : '------'}
        </p>
        {url && (
          <div className="rounded-2xl bg-white p-4 shadow-xl">
            <QRCodeSVG value={url} size={200} level="M" marginSize={0} />
          </div>
        )}
        <p className="text-sm text-sky-100">Scan QR dengan kamera HP atau masukkan PIN.</p>
        {isLocalOnly && (
          <p className="rounded-xl bg-amber-400/20 px-3 py-2 text-xs text-amber-100">
            Alamat masih <strong>localhost</strong> sehingga HP tidak bisa membukanya. Buka halaman ini lewat alamat IP
            jaringan (mis. http://192.168.x.x:5173) atau isi <code>APP_URL</code> di server.
          </p>
        )}
      </div>

      <div className="flex min-h-0 flex-col rounded-3xl bg-white/5 p-6 text-white">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-2xl font-black">
            <Users className="h-6 w-6 text-amber-300" />
            <AnimatedNumber value={players.length} animate={false} /> peserta
          </h2>
          {state.lobbyLocked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/30 px-3 py-1 text-sm font-semibold text-rose-100">
              <Lock className="h-4 w-4" /> Lobby terkunci
            </span>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {players.length === 0 ? (
            <p className="flex h-full items-center justify-center text-center text-xl text-sky-100/80">
              Menunggu peserta bergabung…
            </p>
          ) : (
            <ul className="flex flex-wrap content-start gap-3">
              <AnimatePresence initial={false}>
                {players.map((player) => (
                  <motion.li
                    key={player.id}
                    layout={animate}
                    initial={animate ? { opacity: 0, scale: 0.6 } : false}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                    className={cn(
                      'group flex items-center gap-2 rounded-full px-4 py-2 text-lg font-bold shadow',
                      player.connected ? 'bg-white text-slate-900' : 'bg-white/30 text-white/80',
                    )}
                    title={player.connected ? 'Terhubung' : 'Terputus'}
                  >
                    <span className={cn('h-2.5 w-2.5 rounded-full', player.connected ? 'bg-emerald-500' : 'bg-slate-400')} />
                    {player.name}
                    <button
                      type="button"
                      onClick={() => onKick(player)}
                      className="ml-1 hidden rounded-full p-0.5 text-rose-600 hover:bg-rose-100 group-hover:block"
                      aria-label={`Keluarkan ${player.name}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function HostCountdown({ state, serverNow, sfx }: { state: LiveState; serverNow: () => number; sfx: (name: Sfx) => void }) {
  const remaining = useRemainingMs(state.countdown?.deadlineAt, serverNow, true);
  const seconds = Math.max(1, Math.ceil(remaining / 1000));
  const lastRef = useRef<number | null>(null);
  useEffect(() => {
    if (lastRef.current !== seconds) {
      lastRef.current = seconds;
      sfx('countdown');
    }
  }, [seconds, sfx]);
  return (
    <div className="flex h-full flex-col items-center justify-center text-white">
      <p className="mb-6 text-2xl font-semibold text-sky-100">Bersiap…</p>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={seconds}
          initial={{ scale: 2.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="text-[14rem] font-black leading-none text-amber-300 drop-shadow-2xl"
        >
          {seconds}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

function HostQuestion({ state, serverNow, sfx }: { state: LiveState; serverNow: () => number; sfx: (name: Sfx) => void }) {
  const payload = state.question;
  const remaining = useRemainingMs(payload?.deadlineAt, serverNow, !state.questionClosed);
  const lastTick = useRef<number | null>(null);
  const secondsLeft = Math.ceil(remaining / 1000);
  useEffect(() => {
    if (state.questionClosed || secondsLeft > 5 || secondsLeft <= 0) return;
    if (lastTick.current !== secondsLeft) {
      lastTick.current = secondsLeft;
      sfx('tick');
    }
  }, [secondsLeft, state.questionClosed, sfx]);
  if (!payload) return null;
  const question = payload.question;
  const multi = question.type === 'MULTIPLE';

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 text-white">
      <div className="flex items-start gap-5">
        <div className="min-w-0 flex-1 rounded-3xl bg-white/10 p-6 backdrop-blur">
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-sky-200">
            Soal {question.index + 1} dari {question.total}
            {multi ? ' · pilih semua jawaban yang benar' : question.type === 'TRUE_FALSE' ? ' · benar atau salah' : ''}
            {question.weight === 'DOUBLE' ? ' · POIN 2x' : question.weight === 'NONE' ? ' · tanpa poin' : ''}
          </p>
          <div className="text-3xl font-extrabold leading-snug sm:text-4xl">
            {question.prompt && <RichText text={question.prompt} />}
          </div>
          {question.imageUrl && (
            <img src={getAssetUrl(question.imageUrl)} alt="" className="mt-4 max-h-64 max-w-full rounded-xl bg-white/10 object-contain" />
          )}
        </div>
        <div className="flex shrink-0 flex-col items-center gap-3">
          <TimerRing remainingMs={remaining} totalMs={payload.durationMs} size={112} />
          <div className="rounded-2xl bg-white/10 px-4 py-2 text-center">
            <p className="text-3xl font-black tabular-nums">
              {state.answeredCount}
              <span className="text-lg text-sky-200">/{state.totalPlayers}</span>
            </p>
            <p className="text-xs text-sky-200">sudah menjawab</p>
          </div>
        </div>
      </div>

      <div className={cn('grid min-h-0 flex-1 gap-4', question.options.length <= 2 ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-2')}>
        {question.options.map((option, index) => {
          const style = OPTION_STYLES[index % OPTION_STYLES.length]!;
          const Icon = style.icon;
          return (
            <div key={option.id} className={cn('flex min-h-[5rem] items-center gap-4 rounded-2xl px-6 py-4 text-2xl font-bold shadow-lg sm:text-3xl', style.bg)}>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-black/20">
                <Icon className="h-7 w-7" aria-hidden />
              </span>
              <span className="w-8 shrink-0 text-center text-3xl font-black text-white/80">{style.letter}</span>
              <OptionContent label={option.label} imageUrl={option.imageUrl} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HostResult({ state, animate }: { state: LiveState; animate: boolean }) {
  const result = state.result;
  const question = result?.question ?? state.replayQuestion;
  if (!result || !question) return null;
  const distribution = result.distribution ?? {};
  const max = Math.max(1, ...Object.values(distribution));
  const correctIds = result.correctOptionIds;
  const counts = result.counts;

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 text-white">
      <div className="rounded-3xl bg-white/10 p-5 backdrop-blur">
        <p className="text-sm font-semibold uppercase tracking-widest text-sky-200">
          Hasil soal {question.index + 1} dari {question.total}
        </p>
        <div className="mt-1 text-2xl font-extrabold sm:text-3xl">{question.prompt && <RichText text={question.prompt} />}</div>
      </div>

      <div className="flex min-h-0 flex-1 items-end justify-center gap-4 sm:gap-8">
        {question.options.map((option, index) => {
          const style = OPTION_STYLES[index % OPTION_STYLES.length]!;
          const count = distribution[option.id] ?? 0;
          const isCorrect = correctIds ? correctIds.includes(option.id) : null;
          const dim = isCorrect === false;
          return (
            <div key={option.id} className={cn('flex h-full w-full max-w-[12rem] flex-col items-center justify-end gap-2 transition-opacity', dim && 'opacity-40')}>
              <span className="text-3xl font-black tabular-nums">{count}</span>
              <div className="flex w-full flex-1 items-end">
                <motion.div
                  initial={animate ? { height: 0 } : false}
                  animate={{ height: `${Math.max(count === 0 ? 2 : 6, (count / max) * 100)}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={cn('relative w-full rounded-t-xl', style.bg, isCorrect && 'ring-4 ring-emerald-300')}
                />
              </div>
              <div className={cn('flex w-full items-center gap-2 rounded-xl px-3 py-2 text-base font-bold', style.bg)}>
                {isCorrect && <Check className="h-5 w-5 shrink-0 text-emerald-200" aria-label="Jawaban benar" />}
                <span className="shrink-0 font-black">{style.letter}</span>
                <span className="min-w-0 truncate">{option.label ? <RichText text={option.label} /> : '(gambar)'}</span>
              </div>
            </div>
          );
        })}
      </div>

      {counts && (
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="rounded-2xl bg-emerald-500/25 p-3">
            <p className="text-3xl font-black">{counts.correct}</p>
            <p className="text-sm text-emerald-100">Benar</p>
          </div>
          <div className="rounded-2xl bg-rose-500/25 p-3">
            <p className="text-3xl font-black">{counts.wrong}</p>
            <p className="text-sm text-rose-100">Salah</p>
          </div>
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="text-3xl font-black">{counts.unanswered}</p>
            <p className="text-sm text-sky-100">Tidak menjawab</p>
          </div>
        </div>
      )}
    </div>
  );
}

function HostScore({ state }: { state: LiveState }) {
  const gains = state.score?.topGains ?? [];
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 text-white">
      <h2 className="flex items-center gap-3 text-4xl font-black">
        <BarChart3 className="h-10 w-10 text-amber-300" /> Poin soal ini
      </h2>
      {gains.length ? (
        <ol className="w-full max-w-xl space-y-3">
          {gains.map((gain, index) => (
            <motion.li
              key={`${gain.name}-${index}`}
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.12 }}
              className="flex items-center justify-between rounded-2xl bg-white/10 px-6 py-3 text-2xl font-bold"
            >
              <span className="truncate">{gain.name}</span>
              <span className="text-emerald-300">+{gain.earned.toLocaleString('id-ID')}</span>
            </motion.li>
          ))}
        </ol>
      ) : (
        <p className="text-2xl text-sky-100">Tidak ada yang mendapat poin di soal ini.</p>
      )}
    </div>
  );
}

function HostLeaderboard({ state, animate }: { state: LiveState; animate: boolean }) {
  const lb = state.leaderboard;
  if (!lb) return null;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 text-white">
      <h2 className="flex items-center gap-3 text-4xl font-black">
        <Trophy className="h-10 w-10 text-amber-300" /> Leaderboard
      </h2>
      {lb.visible === false ? (
        <p className="text-2xl text-sky-100">Leaderboard disembunyikan oleh pengaturan sesi.</p>
      ) : (
        <Leaderboard entries={lb.entries ?? []} animate={animate} large />
      )}
    </div>
  );
}

function HostFinal({
  state,
  animate,
  sfx,
  sessionId,
}: {
  state: LiveState;
  animate: boolean;
  sfx: (name: Sfx) => void;
  sessionId: string;
}) {
  const final = state.final;
  const confettiEnabled = animate;
  if (!final) return null;
  const rest = (final.standings ?? []).filter((row) => row.rank > 3).slice(0, 5);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 text-white">
      <h2 className="text-5xl font-black">{final.early ? 'Sesi Dihentikan' : 'Pemenang!'}</h2>
      {final.podium.length ? (
        <Podium
          podium={final.podium}
          animate={animate}
          confettiEnabled={confettiEnabled}
          onDrumroll={() => sfx('drumroll')}
          onReveal={(rank) => sfx(rank === 1 ? 'fanfare' : 'reveal')}
        />
      ) : (
        <p className="text-xl text-sky-100">Tidak ada peserta.</p>
      )}
      {rest.length > 0 && (
        <ol className="grid w-full max-w-3xl gap-2 sm:grid-cols-2">
          {rest.map((row) => (
            <li key={row.playerId} className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-2 text-lg font-semibold">
              <span className="w-8 text-center font-black text-amber-300">{row.rank}</span>
              <span className="min-w-0 flex-1 truncate">{row.name}</span>
              <span className="tabular-nums">{row.totalScore.toLocaleString('id-ID')}</span>
            </li>
          ))}
        </ol>
      )}
      <Link
        to={`/admin/live-quiz/laporan/${sessionId}`}
        className="rounded-full bg-amber-400 px-8 py-3 text-lg font-bold text-slate-900 shadow-lg transition hover:bg-amber-300"
      >
        Lihat laporan lengkap
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Halaman host                                                         */
/* ------------------------------------------------------------------ */

export function LiveHostPage() {
  const { sessionId = '' } = useParams();
  const navigate = useNavigate();
  const reducedMotion = usePrefersReducedMotion();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'end' | 'cancel' | null>(null);
  const [kickTarget, setKickTarget] = useState<LobbyPlayer | null>(null);
  const settingsRef = useRef<ClientSettings | null>(null);

  const meta = useQuery({
    queryKey: ['live-quiz', 'session-meta', sessionId],
    queryFn: () => liveQuizApi.sessionMeta(sessionId),
    enabled: Boolean(sessionId),
    staleTime: 60_000,
  });

  const sfx = useCallback((name: Sfx) => {
    if (settingsRef.current?.soundEnabled === false) return;
    liveAudio.play(name);
  }, []);

  const onEvent = useCallback(
    (event: string, payload: unknown) => {
      switch (event) {
        case 'player_joined':
          sfx('join');
          break;
        case 'game_starting':
          sfx('start');
          break;
        case 'question_started':
          sfx('go');
          break;
        case 'question_ended':
          sfx('timeUp');
          break;
        case 'question_result':
          sfx('reveal');
          break;
        case 'score_updated':
          sfx('points');
          break;
        case 'leaderboard_updated':
          sfx('rankUp');
          break;
        default:
          break;
      }
      void payload;
    },
    [sfx],
  );

  const { state, hostAction, serverNow } = useLiveSession({ role: 'host', sessionId, onEvent });
  settingsRef.current = state.settings;
  const animate = state.settings ? state.settings.animationsEnabled && !reducedMotion : !reducedMotion;
  const status = state.status;

  // Musik latar mengikuti tahap permainan.
  useEffect(() => {
    if (state.settings?.soundEnabled === false) {
      liveAudio.stopMusic();
      return;
    }
    if (status === 'LOBBY') liveAudio.startMusic('lobby');
    else if (status === 'QUESTION_ACTIVE' && !state.questionClosed) liveAudio.startMusic('question');
    else liveAudio.stopMusic();
  }, [status, state.questionClosed, state.settings?.soundEnabled]);
  useEffect(() => () => liveAudio.stopMusic(), []);

  const act = async (action: HostAction) => {
    if (busy) return;
    liveAudio.unlock();
    setBusy(true);
    const result = await hostAction(action);
    setBusy(false);
    if (!result.ok) toast.error(result.message ?? 'Aksi gagal. Coba lagi.');
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  const pin = state.session?.pin ?? meta.data?.pin ?? null;
  const join = useMemo(() => (meta.data?.join ? meta.data.join : pin ? { pin, joinPath: `/live/join?pin=${pin}`, joinBaseUrl: null, lanHosts: [] } : null), [meta.data, pin]);

  const nextLabel =
    status === 'QUESTION_ACTIVE'
      ? 'Tutup soal sekarang'
      : status === 'QUESTION_RESULT'
        ? 'Lanjut'
        : status === 'SCORE_RESULT'
          ? 'Ke leaderboard'
          : status === 'LEADERBOARD'
            ? state.leaderboard?.isLast
              ? 'Tampilkan podium'
              : 'Soal berikutnya'
            : null;
  const canPause = status === 'QUESTION_RESULT' || status === 'SCORE_RESULT' || status === 'LEADERBOARD';

  let body: React.ReactNode = null;
  if (state.connection === 'denied' && !state.hasSynced) {
    body = (
      <CenterCard>
        <p className="text-xl font-bold">{state.deniedReason}</p>
        <Link to="/admin/live-quiz" className="mt-6 inline-block rounded-full bg-amber-400 px-6 py-2 font-bold text-slate-900">
          Kembali ke Live Quiz
        </Link>
      </CenterCard>
    );
  } else if (!state.hasSynced) {
    body = <p className="flex h-full items-center justify-center text-xl text-sky-100">Menghubungkan ke sesi…</p>;
  } else {
    switch (status) {
      case 'LOBBY':
        body = <HostLobby state={state} join={join} onKick={setKickTarget} />;
        break;
      case 'COUNTDOWN':
        body = <HostCountdown state={state} serverNow={serverNow} sfx={sfx} />;
        break;
      case 'QUESTION_ACTIVE':
        body = <HostQuestion state={state} serverNow={serverNow} sfx={sfx} />;
        break;
      case 'QUESTION_RESULT':
        body = <HostResult state={state} animate={animate} />;
        break;
      case 'SCORE_RESULT':
        body = <HostScore state={state} />;
        break;
      case 'LEADERBOARD':
        body = <HostLeaderboard state={state} animate={animate} />;
        break;
      case 'FINISHED':
        body = <HostFinal state={state} animate={animate} sfx={sfx} sessionId={sessionId} />;
        break;
      case 'CANCELLED':
        body = (
          <CenterCard>
            <p className="text-2xl font-bold">Sesi dibatalkan</p>
            <Link to="/admin/live-quiz" className="mt-6 inline-block rounded-full bg-amber-400 px-6 py-2 font-bold text-slate-900">
              Kembali ke Live Quiz
            </Link>
          </CenterCard>
        );
        break;
      default:
        break;
    }
  }

  const ended = status === 'FINISHED' || status === 'CANCELLED';

  return (
    <div
      className="relative flex h-[100dvh] flex-col overflow-hidden"
      style={liveBackground}
      onPointerDown={() => liveAudio.unlock()}
    >
      <ReconnectBanner show={state.hasSynced && state.connection === 'reconnecting'} />

      <header className="flex shrink-0 items-center justify-between gap-4 px-6 py-4 text-white">
        <div className="flex min-w-0 items-center gap-4">
          <img src="/Logo_tactical.png" alt="" className="h-10 w-10 rounded-lg bg-white/90 object-contain p-1" />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-300">Tactical Live Quiz</p>
            <p className="truncate text-lg font-bold">{state.session?.title ?? meta.data?.title ?? '…'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {pin && !ended && status !== 'LOBBY' && (
            <span className="hidden rounded-full bg-white/10 px-4 py-2 text-sm font-bold sm:inline">PIN {formatPin(pin)}</span>
          )}
          {!ended && (
            <span className="hidden items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold sm:inline-flex">
              <Users className="h-4 w-4" /> {state.playerCount}
            </span>
          )}
          {state.paused && <span className="rounded-full bg-amber-400 px-4 py-2 text-sm font-black text-slate-900">JEDA</span>}
          <SoundToggle showVolume />
          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Layar penuh"
          >
            <Expand className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => (ended ? navigate('/admin/live-quiz') : setConfirm('end'))}
            className="flex h-10 items-center gap-2 rounded-full bg-rose-600 px-4 text-sm font-bold text-white hover:bg-rose-500"
          >
            <LogOut className="h-4 w-4" />
            {ended ? 'Keluar' : status === 'LOBBY' ? 'Batalkan' : 'Akhiri'}
          </button>
        </div>
      </header>

      <main className="min-h-0 flex-1 px-6 pb-4">{body}</main>

      {state.hasSynced && !ended && (
        <footer className="flex shrink-0 flex-wrap items-center justify-center gap-3 px-6 pb-5">
          {status === 'LOBBY' && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => void act({ type: 'lock', locked: !state.lobbyLocked })}
                className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-3 font-bold text-white hover:bg-white/20"
              >
                {state.lobbyLocked ? <Unlock className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                {state.lobbyLocked ? 'Buka lobby' : 'Kunci lobby'}
              </button>
              <button
                type="button"
                disabled={busy || state.playerCount < 1 || state.connection !== 'connected'}
                onClick={() => void act({ type: 'start' })}
                className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-10 py-4 text-xl font-black text-slate-900 shadow-xl transition hover:bg-amber-300 disabled:opacity-40"
              >
                <Play className="h-6 w-6" /> Mulai
              </button>
            </>
          )}
          {nextLabel && (
            <button
              type="button"
              disabled={busy || state.connection !== 'connected'}
              onClick={() => void act({ type: 'next', version: state.version })}
              className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-8 py-3 text-lg font-black text-slate-900 shadow-xl transition hover:bg-amber-300 disabled:opacity-40"
            >
              <SkipForward className="h-5 w-5" /> {nextLabel}
            </button>
          )}
          {canPause && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void act({ type: state.paused ? 'resume' : 'pause' })}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-3 font-bold text-white hover:bg-white/20"
            >
              {state.paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
              {state.paused ? 'Lanjutkan' : 'Jeda'}
            </button>
          )}
          {state.settings?.advanceMode === 'AUTO' && status === 'LEADERBOARD' && !state.paused && (
            <span className="text-sm text-sky-100">Otomatis lanjut ke soal berikutnya…</span>
          )}
        </footer>
      )}

      <ConfirmDialog
        open={confirm !== null}
        title={status === 'LOBBY' ? 'Batalkan sesi?' : 'Akhiri sesi sekarang?'}
        description={
          status === 'LOBBY'
            ? 'Sesi dibatalkan dan peserta tidak bisa bergabung lagi.'
            : 'Permainan dihentikan dan hasil sampai soal terakhir yang selesai akan disimpan.'
        }
        confirmText={status === 'LOBBY' ? 'Batalkan sesi' : 'Akhiri sesi'}
        loading={busy}
        onConfirm={() => {
          void act({ type: status === 'LOBBY' ? 'cancel' : 'end' }).then(() => setConfirm(null));
        }}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={kickTarget !== null}
        title="Keluarkan peserta?"
        description={`${kickTarget?.name ?? ''} akan dikeluarkan dari sesi dan tidak bisa masuk lagi.`}
        confirmText="Keluarkan"
        loading={busy}
        onConfirm={() => {
          if (kickTarget) void act({ type: 'kick', playerId: kickTarget.id }).then(() => setKickTarget(null));
        }}
        onCancel={() => setKickTarget(null)}
      />
    </div>
  );
}
