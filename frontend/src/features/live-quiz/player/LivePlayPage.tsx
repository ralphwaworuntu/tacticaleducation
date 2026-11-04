import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Clock, Loader2, Medal, Send, Trophy, X } from 'lucide-react';
import { getAssetUrl } from '@/lib/media';
import { cn } from '@/utils/cn';
import { liveAudio, type Sfx } from '../audio';
import type { ClientSettings, PublicQuestion } from '../types';
import { useLiveSession, type LiveState } from '../useLiveSession';
import { usePrefersReducedMotion } from '../useReducedMotion';
import {
  AnimatedNumber,
  CenterCard,
  Leaderboard,
  OPTION_STYLES,
  OptionContent,
  RankDelta,
  ReconnectBanner,
  RichText,
  SoundToggle,
  fireConfetti,
  liveBackground,
  useRemainingMs,
} from '../ui/shared';
import { playerStorage } from './storage';

/* ------------------------------------------------------------------ */
/* Tahap-tahap layar pemain                                             */
/* ------------------------------------------------------------------ */

function PlayerLobby({ state }: { state: LiveState }) {
  return (
    <CenterCard>
      <p className="text-sm font-semibold uppercase tracking-widest text-amber-300">Kamu sudah masuk</p>
      <p className="mt-3 break-words text-4xl font-black">{state.me?.name}</p>
      <p className="mt-5 text-sky-100">Lihat namamu di layar tutor. Permainan segera dimulai.</p>
      <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold">
        <Loader2 className="h-4 w-4 animate-spin" /> {state.playerCount} peserta di lobby
      </p>
      {state.lobbyLocked && <p className="mt-3 text-xs text-amber-200">Lobby dikunci tutor.</p>}
    </CenterCard>
  );
}

function PlayerCountdown({ state, serverNow, sfx }: { state: LiveState; serverNow: () => number; sfx: (n: Sfx) => void }) {
  const remaining = useRemainingMs(state.countdown?.deadlineAt, serverNow, true);
  const seconds = Math.max(1, Math.ceil(remaining / 1000));
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (last.current !== seconds) {
      last.current = seconds;
      sfx('countdown');
    }
  }, [seconds, sfx]);
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-white">
      <p className="mb-4 text-xl font-semibold text-sky-100">Bersiap…</p>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={seconds}
          initial={{ scale: 2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          className="text-[9rem] font-black leading-none text-amber-300"
        >
          {seconds}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

function PlayerQuestion({
  state,
  serverNow,
  submit,
  sfx,
}: {
  state: LiveState;
  serverNow: () => number;
  submit: (optionIds: string[]) => Promise<'ok' | 'duplicate' | 'late' | 'error'>;
  sfx: (n: Sfx) => void;
}) {
  const payload = state.question;
  const questionIndex = payload?.questionIndex ?? -1;
  const [selected, setSelected] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const remaining = useRemainingMs(payload?.deadlineAt, serverNow, !state.questionClosed);

  useEffect(() => {
    setSelected([]);
    setSending(false);
    setProblem(null);
  }, [questionIndex]);

  if (!payload) return null;
  const question = payload.question;
  const locked = state.myAnswer !== null || sending;
  const timeIsUp = state.questionClosed || remaining <= 0;
  const chosen = state.myAnswer ?? selected;
  const multi = question.type === 'MULTIPLE';

  const send = async (optionIds: string[]) => {
    if (locked || timeIsUp || !optionIds.length) return;
    setSending(true);
    setProblem(null);
    const result = await submit(optionIds);
    setSending(false);
    if (result === 'late') setProblem('Waktu habis, jawaban tidak diterima.');
    else if (result === 'error') {
      setProblem('Jawaban belum terkirim. Periksa koneksi lalu coba lagi.');
    }
  };

  const tap = (optionId: string) => {
    if (locked || timeIsUp) return;
    liveAudio.unlock();
    sfx('select');
    if (multi) {
      setSelected((current) => (current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId]));
    } else {
      setSelected([optionId]);
      void send([optionId]);
    }
  };

  const fraction = Math.min(1, remaining / payload.durationMs);
  const hidden = question.prompt === null && question.options.every((o) => o.label === null);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 text-white">
      <div>
        <div className="mb-1 flex items-center justify-between text-sm font-semibold text-sky-100">
          <span>
            Soal {question.index + 1}/{question.total}
          </span>
          <span className={cn('inline-flex items-center gap-1 tabular-nums', remaining <= 5000 && !state.questionClosed && 'text-rose-300')}>
            <Clock className="h-4 w-4" /> {Math.ceil(remaining / 1000)} dtk
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fraction * 100)}>
          <div
            className={cn('h-full rounded-full transition-[width] duration-100 ease-linear', remaining <= 5000 ? 'bg-rose-400' : 'bg-amber-400')}
            style={{ width: `${fraction * 100}%` }}
          />
        </div>
      </div>

      {!hidden && (question.prompt || question.imageUrl) && (
        <div className="rounded-2xl bg-white/10 p-4 text-lg font-bold leading-snug">
          {question.prompt && <RichText text={question.prompt} />}
          {question.imageUrl && (
            <img src={getAssetUrl(question.imageUrl)} alt="" className="mt-3 max-h-48 max-w-full rounded-xl bg-white/10 object-contain" />
          )}
        </div>
      )}
      {multi && !locked && !timeIsUp && <p className="text-center text-sm text-sky-100">Pilih semua jawaban yang benar, lalu kirim.</p>}

      <div className={cn('grid flex-1 content-start gap-3', hidden && question.options.length <= 4 ? 'grid-cols-2 content-stretch' : 'grid-cols-1')}>
        {question.options.map((option, index) => {
          const style = OPTION_STYLES[index % OPTION_STYLES.length]!;
          const Icon = style.icon;
          const isChosen = chosen.includes(option.id);
          const dim = (locked || timeIsUp) && !isChosen;
          return (
            <button
              key={option.id}
              type="button"
              disabled={locked || timeIsUp}
              onClick={() => tap(option.id)}
              aria-pressed={isChosen}
              className={cn(
                'relative flex min-h-[4.25rem] items-center gap-3 rounded-2xl px-4 py-3 text-left text-lg font-bold shadow-lg transition active:scale-[0.97]',
                hidden && 'min-h-[7rem] flex-col justify-center text-center',
                style.bg,
                isChosen && 'ring-4 ring-white',
                dim && 'opacity-35',
              )}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/20">
                <Icon className="h-6 w-6" aria-hidden />
              </span>
              {option.label !== null || option.imageUrl ? (
                <OptionContent label={option.label} imageUrl={option.imageUrl} />
              ) : (
                <span className="text-3xl font-black">{style.letter}</span>
              )}
              {isChosen && <Check className="h-6 w-6 shrink-0" aria-label="Dipilih" />}
            </button>
          );
        })}
      </div>

      {multi && !locked && !timeIsUp && (
        <button
          type="button"
          disabled={!selected.length}
          onClick={() => void send(selected)}
          className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-amber-400 text-lg font-black text-slate-900 shadow-lg disabled:opacity-40"
        >
          <Send className="h-5 w-5" /> Kirim jawaban
        </button>
      )}

      <div className="min-h-[2.5rem] text-center text-base font-semibold" aria-live="polite">
        {sending && <span className="inline-flex items-center gap-2 text-sky-100"><Loader2 className="h-4 w-4 animate-spin" /> Mengirim…</span>}
        {!sending && state.myAnswer !== null && <span className="text-emerald-300">Jawaban terkirim. Menunggu yang lain…</span>}
        {!sending && state.myAnswer === null && timeIsUp && <span className="text-rose-300">Waktu habis</span>}
        {problem && <span className="text-rose-300">{problem}</span>}
      </div>
    </div>
  );
}

function optionLetters(question: PublicQuestion | null, ids: string[] | null) {
  if (!question || !ids) return [];
  return question.options
    .map((option, index) => ({ option, index }))
    .filter(({ option }) => ids.includes(option.id))
    .map(({ option, index }) => ({
      letter: OPTION_STYLES[index % OPTION_STYLES.length]!.letter,
      label: option.label,
    }));
}

function PlayerResult({ state, animate }: { state: LiveState; animate: boolean }) {
  const result = state.result;
  const question = state.question?.question ?? state.replayQuestion;
  if (!result) return null;
  const answered = result.answered ?? false;
  const correct = result.correct ?? false;
  const correctOnes = optionLetters(question, result.correctOptionIds);
  return (
    <motion.div
      initial={animate ? { scale: 0.8, opacity: 0 } : false}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 18 }}
      className={cn(
        'flex flex-1 flex-col items-center justify-center rounded-3xl p-8 text-center text-white shadow-2xl',
        !answered ? 'bg-slate-600/70' : correct ? 'bg-emerald-600' : 'bg-rose-600',
      )}
    >
      <span className="flex h-24 w-24 items-center justify-center rounded-full bg-white/20">
        {!answered ? <Clock className="h-12 w-12" /> : correct ? <Check className="h-14 w-14" /> : <X className="h-14 w-14" />}
      </span>
      <p className="mt-5 text-4xl font-black">{!answered ? 'Tidak menjawab' : correct ? 'Benar!' : 'Salah'}</p>
      {correctOnes.length > 0 && !correct && (
        <div className="mt-5 rounded-2xl bg-black/20 px-5 py-3 text-base">
          <p className="text-xs uppercase tracking-widest text-white/70">Jawaban benar</p>
          <p className="mt-1 text-xl font-bold">
            {correctOnes.map((c, i) => (
              <span key={c.letter}>
                {i > 0 && ' · '}
                {c.label ? (
                  <>
                    {c.letter}. <RichText text={c.label} />
                  </>
                ) : (
                  c.letter
                )}
              </span>
            ))}
          </p>
        </div>
      )}
    </motion.div>
  );
}

function PlayerScore({ state, animate, sfx }: { state: LiveState; animate: boolean; sfx: (n: Sfx) => void }) {
  const score = state.score;
  if (!score) return null;
  const earned = score.earned ?? 0;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center text-white">
      <p className="text-sm font-semibold uppercase tracking-widest text-sky-200">Poin soal ini</p>
      <motion.p
        initial={animate ? { scale: 0.4, opacity: 0 } : false}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 14 }}
        className={cn('text-7xl font-black', earned > 0 ? 'text-emerald-300' : 'text-white/60')}
        onAnimationStart={() => earned > 0 && sfx('points')}
      >
        +<AnimatedNumber value={earned} animate={animate} durationMs={800} />
      </motion.p>
      <div className="rounded-2xl bg-white/10 px-8 py-4">
        <p className="text-sm text-sky-200">Total poin</p>
        <p className="text-4xl font-black text-amber-300">
          <AnimatedNumber value={score.totalScore ?? 0} from={score.previousScore ?? 0} animate={animate} durationMs={1100} />
        </p>
      </div>
    </div>
  );
}

function PlayerLeaderboard({ state, animate }: { state: LiveState; animate: boolean }) {
  const lb = state.leaderboard;
  if (!lb) return null;
  const top = lb.top ?? [];
  const me = state.me;
  return (
    <div className="flex flex-1 flex-col items-center gap-5 text-white">
      <div className="w-full rounded-3xl bg-white/10 p-6 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-sky-200">Peringkatmu</p>
        <p className="mt-1 flex items-center justify-center gap-3 text-6xl font-black text-amber-300">
          #{lb.rank ?? '-'}
          <RankDelta delta={lb.delta} />
        </p>
        <p className="mt-1 text-lg font-semibold">
          {(lb.totalScore ?? 0).toLocaleString('id-ID')} poin · dari {lb.totalPlayers} peserta
        </p>
      </div>
      {lb.visible && top.length > 0 && (
        <div className="w-full">
          <Leaderboard entries={top} animate={animate} highlightId={me?.id ?? null} />
          {!lb.inTop && (
            <p className="mt-3 text-center text-sm text-sky-100">… kamu berada di peringkat #{lb.rank}</p>
          )}
        </div>
      )}
      <p className="mt-auto text-sm text-sky-100">{lb.isLast ? 'Menunggu podium…' : 'Bersiap untuk soal berikutnya'}</p>
    </div>
  );
}

function PlayerFinal({ state, animate, onLeave }: { state: LiveState; animate: boolean; onLeave: () => void }) {
  const final = state.final;
  const firedRef = useRef(false);
  useEffect(() => {
    if (final?.medal && !firedRef.current) {
      firedRef.current = true;
      fireConfetti({ enabled: animate, intensity: final.medal === 'GOLD' ? 'big' : 'small' });
    }
  }, [final?.medal, animate]);
  if (!final) return null;
  const medalColor = final.medal === 'GOLD' ? 'text-amber-300' : final.medal === 'SILVER' ? 'text-slate-200' : 'text-orange-300';
  const headline = final.rank === 1 ? 'Juara 1!' : final.rank === 2 ? 'Juara 2!' : final.rank === 3 ? 'Juara 3!' : 'Permainan selesai';
  return (
    <div className="flex flex-1 flex-col items-center gap-5 text-center text-white">
      <motion.div
        initial={animate ? { scale: 0.5, opacity: 0 } : false}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 14 }}
        className="w-full rounded-3xl bg-white/10 p-6"
      >
        {final.medal ? <Medal className={cn('mx-auto h-14 w-14', medalColor)} /> : <Trophy className="mx-auto h-12 w-12 text-sky-200" />}
        <p className="mt-2 text-3xl font-black">{headline}</p>
        <p className="mt-3 text-sm uppercase tracking-widest text-sky-200">Peringkat akhir</p>
        <p className="text-6xl font-black text-amber-300">#{final.rank ?? '-'}</p>
        <p className="text-sm text-sky-100">dari {final.totalPlayers} peserta</p>
      </motion.div>
      <div className="grid w-full grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white/10 p-4">
          <p className="text-3xl font-black text-amber-300">{(final.totalScore ?? 0).toLocaleString('id-ID')}</p>
          <p className="text-xs text-sky-200">Total poin</p>
        </div>
        <div className="rounded-2xl bg-white/10 p-4">
          <p className="text-3xl font-black">{final.accuracy ?? 0}%</p>
          <p className="text-xs text-sky-200">Akurasi</p>
        </div>
        <div className="rounded-2xl bg-emerald-500/25 p-4">
          <p className="text-3xl font-black">{final.correctCount ?? 0}</p>
          <p className="text-xs text-emerald-100">Benar</p>
        </div>
        <div className="rounded-2xl bg-rose-500/25 p-4">
          <p className="text-3xl font-black">{final.incorrectCount ?? 0}</p>
          <p className="text-xs text-rose-100">Salah</p>
        </div>
      </div>
      {(final.unansweredCount ?? 0) > 0 && (
        <p className="text-sm text-sky-100">{final.unansweredCount} soal tidak dijawab</p>
      )}
      <button
        type="button"
        onClick={onLeave}
        className="mt-auto h-14 w-full rounded-2xl bg-amber-400 text-lg font-black text-slate-900 shadow-lg"
      >
        Gabung kuis lain
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Halaman pemain                                                       */
/* ------------------------------------------------------------------ */

function PlayView({ sessionId, playerToken }: { sessionId: string; playerToken: string }) {
  const navigate = useNavigate();
  const reducedMotion = usePrefersReducedMotion();
  const settingsRef = useRef<ClientSettings | null>(null);

  const sfx = useCallback((name: Sfx) => {
    if (settingsRef.current?.soundEnabled === false) return;
    liveAudio.play(name);
  }, []);

  const onEvent = useCallback(
    (event: string, payload: unknown) => {
      const data = payload as Record<string, unknown>;
      switch (event) {
        case 'question_started':
          sfx('go');
          break;
        case 'question_result':
          if (!data.answered) sfx('timeUp');
          else sfx(data.correct ? 'correct' : 'wrong');
          if (typeof navigator.vibrate === 'function') navigator.vibrate(data.correct ? [60] : [120]);
          break;
        case 'leaderboard_updated':
          if (typeof data.delta === 'number' && data.delta > 0) sfx('rankUp');
          break;
        case 'game_finished':
          sfx(data.medal ? 'fanfare' : 'reveal');
          break;
        default:
          break;
      }
    },
    [sfx],
  );

  const { state, submit, serverNow } = useLiveSession({ role: 'player', sessionId, playerToken, onEvent });
  settingsRef.current = state.settings;
  const animate = (state.settings?.animationsEnabled ?? true) && !reducedMotion;
  const status = state.status;

  const leave = useCallback(() => {
    playerStorage.clear(sessionId);
    navigate('/live/join', { replace: true });
  }, [navigate, sessionId]);

  // Sesi sudah tidak valid (dikeluarkan / token salah): hapus data lokal agar tidak mencoba terus.
  useEffect(() => {
    if (state.kicked || (state.connection === 'denied' && !state.hasSynced)) playerStorage.clear(sessionId);
  }, [state.kicked, state.connection, state.hasSynced, sessionId]);

  const score = useMemo(() => state.me?.totalScore ?? 0, [state.me?.totalScore]);

  let body: React.ReactNode = null;
  if (state.kicked) {
    body = (
      <CenterCard>
        <p className="text-2xl font-black">Kamu dikeluarkan</p>
        <p className="mt-3 text-sky-100">{state.kicked}</p>
        <button type="button" onClick={leave} className="mt-6 rounded-full bg-amber-400 px-6 py-3 font-bold text-slate-900">
          Kembali
        </button>
      </CenterCard>
    );
  } else if (state.connection === 'denied' && !state.hasSynced) {
    body = (
      <CenterCard>
        <p className="text-xl font-bold">{state.deniedReason}</p>
        <button type="button" onClick={leave} className="mt-6 rounded-full bg-amber-400 px-6 py-3 font-bold text-slate-900">
          Masukkan PIN lagi
        </button>
      </CenterCard>
    );
  } else if (!state.hasSynced) {
    body = (
      <div className="flex flex-1 items-center justify-center text-sky-100">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Menghubungkan…
      </div>
    );
  } else {
    switch (status) {
      case 'LOBBY':
        body = <PlayerLobby state={state} />;
        break;
      case 'COUNTDOWN':
        body = <PlayerCountdown state={state} serverNow={serverNow} sfx={sfx} />;
        break;
      case 'QUESTION_ACTIVE':
        body = <PlayerQuestion state={state} serverNow={serverNow} submit={submit} sfx={sfx} />;
        break;
      case 'QUESTION_RESULT':
        body = <PlayerResult state={state} animate={animate} />;
        break;
      case 'SCORE_RESULT':
        body = <PlayerScore state={state} animate={animate} sfx={sfx} />;
        break;
      case 'LEADERBOARD':
        body = <PlayerLeaderboard state={state} animate={animate} />;
        break;
      case 'FINISHED':
        body = <PlayerFinal state={state} animate={animate} onLeave={leave} />;
        break;
      case 'CANCELLED':
        body = (
          <CenterCard>
            <p className="text-2xl font-black">Sesi dibatalkan</p>
            <p className="mt-3 text-sky-100">Tutor membatalkan sesi ini.</p>
            <button type="button" onClick={leave} className="mt-6 rounded-full bg-amber-400 px-6 py-3 font-bold text-slate-900">
              Kembali
            </button>
          </CenterCard>
        );
        break;
      default:
        break;
    }
  }

  return (
    <div
      className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col gap-4 px-4 pb-6 pt-4"
      onPointerDown={() => liveAudio.unlock()}
    >
      <ReconnectBanner show={state.hasSynced && state.connection === 'reconnecting'} />
      <header className="flex items-center justify-between gap-3 text-white">
        <div className="min-w-0">
          <p className="truncate text-base font-black">{state.me?.name ?? '…'}</p>
          <p className="truncate text-xs text-sky-200">{state.session?.title}</p>
        </div>
        <div className="flex items-center gap-2">
          {status && status !== 'LOBBY' && status !== 'COUNTDOWN' && (
            <span className="rounded-full bg-amber-400 px-3 py-1.5 text-sm font-black tabular-nums text-slate-900">
              {score.toLocaleString('id-ID')}
            </span>
          )}
          <SoundToggle />
        </div>
      </header>
      {state.paused && (
        <p className="rounded-xl bg-amber-400 px-4 py-2 text-center text-sm font-black text-slate-900">Permainan dijeda tutor</p>
      )}
      <main className="flex min-h-0 flex-1 flex-col">{body}</main>
    </div>
  );
}

export function LivePlayPage() {
  const { sessionId = '' } = useParams();
  const stored = playerStorage.load(sessionId);
  if (!stored) return <Navigate to="/live/join" replace />;
  return (
    <div style={liveBackground} className="min-h-[100dvh]">
      <PlayView sessionId={sessionId} playerToken={stored.playerToken} />
      <Link to="/live/join" className="sr-only">
        Gabung kuis lain
      </Link>
    </div>
  );
}
