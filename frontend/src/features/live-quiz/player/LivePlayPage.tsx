import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Clock, Loader2, Medal, Pencil, Send, Trophy, X } from 'lucide-react';
import { toast } from 'sonner';
import { getAssetUrl } from '@/lib/media';
import { cn } from '@/utils/cn';
import { liveAudio, type Sfx } from '../audio';
import { PlayerAvatar } from '../avatars';
import type { ClientSettings, PublicQuestion } from '../types';
import { useLiveSession, type LiveState } from '../useLiveSession';
import { useMotionLevel } from '../useMotionLevel';
import { AnswerCard, themeFor } from '../ui/AnswerCard';
import { AvatarPicker } from '../ui/AvatarPicker';
import { GameCountdown } from '../ui/Countdown';
import { GameStage } from '../ui/GameStage';
import { Leaderboard } from '../ui/Leaderboard';
import { ReactionPicker } from '../ui/ReactionPicker';
import {
  AnimatedNumber,
  AudioUnlockHint,
  CenterCard,
  RankDelta,
  ReconnectBanner,
  RichText,
  SoundToggle,
  fireConfetti,
  useRemainingMs,
} from '../ui/shared';
import { uploadLivePlayerAvatar } from '../selfie/uploadAvatar';
import { avatarPreference, playerStorage } from './storage';

const SelfieAvatarStudio = lazy(() => import('../selfie/SelfieAvatarStudio').then((m) => ({ default: m.SelfieAvatarStudio })));

/* ------------------------------------------------------------------ */
/* Tahap-tahap layar pemain                                             */
/* ------------------------------------------------------------------ */

type View = { animate: boolean; fancy: boolean };

function PlayerLobby({
  state,
  view,
  setAvatar,
  sfx,
  sessionId,
  playerToken,
}: {
  state: LiveState;
  view: View;
  setAvatar: (id: string) => Promise<{ ok: boolean; message?: string; code?: string }>;
  sfx: (n: Sfx) => void;
  sessionId: string;
  playerToken: string;
}) {
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const canChange = state.settings?.allowAvatarChange !== false;

  const choose = async (id: string) => {
    if (saving || (id === state.me?.avatarId && !state.me?.avatarUrl)) return;
    liveAudio.unlock();
    setSaving(true);
    const result = await setAvatar(id);
    setSaving(false);
    if (result.ok) {
      sfx('avatarPick');
      avatarPreference.save(id);
      setPicking(false);
    } else {
      toast.error(result.code === 'avatar_locked' ? 'Tutor tidak mengizinkan ganti karakter.' : (result.message ?? 'Gagal mengganti karakter.'));
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center text-white">
      <p className="text-sm font-black uppercase tracking-[0.3em] text-amber-300">Kamu sudah masuk!</p>
      <motion.div
        key={`${state.me?.avatarId}-${state.me?.avatarUrl ?? ''}`}
        initial={view.animate ? { scale: 0.6, rotate: -8, opacity: 0 } : false}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 240, damping: 14 }}
      >
        <PlayerAvatar avatarId={state.me?.avatarId} src={state.me?.avatarUrl} seed={state.me?.id ?? ''} size={150} ring idle={view.animate} />
      </motion.div>
      <p className="max-w-full break-words text-4xl font-black">{state.me?.name}</p>
      <p className="max-w-xs text-sky-100">Lihat karaktermu di layar tutor. Permainan segera dimulai!</p>
      <p className="lq-glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold">
        <Loader2 className="h-4 w-4 animate-spin" /> {state.playerCount} peserta di lobby
      </p>
      {state.lobbyLocked && <p className="text-xs text-amber-200">Lobby dikunci tutor.</p>}
      {canChange && (
        <button type="button" onClick={() => setPicking((v) => !v)} className="lq-btn lq-btn-ghost px-5 py-2.5 text-sm">
          <Pencil className="h-4 w-4" /> {picking ? 'Tutup' : 'Ganti karakter'}
        </button>
      )}
      <AnimatePresence>
        {picking && canChange && (
          <motion.div
            initial={view.animate ? { opacity: 0, y: 16 } : false}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="lq-card-light w-full rounded-3xl p-4"
          >
            <AvatarPicker
              value={state.me?.avatarId ?? null}
              customSrc={state.me?.avatarUrl ?? null}
              onChange={(id) => void choose(id)}
              onSelfie={() => {
                liveAudio.unlock();
                setStudioOpen(true);
              }}
              disabled={saving}
            />
          </motion.div>
        )}
      </AnimatePresence>
      {studioOpen && (
        <Suspense fallback={null}>
          <SelfieAvatarStudio
            onClose={() => setStudioOpen(false)}
            onUse={async (result) => {
              setStudioOpen(false);
              setSaving(true);
              try {
                await uploadLivePlayerAvatar(sessionId, playerToken, result.blob);
                sfx('avatarPick');
                setPicking(false);
              } catch {
                toast.error('Gagal menyimpan avatar kartun. Karakter bawaan tetap bisa dipakai.');
              } finally {
                setSaving(false);
              }
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

function PlayerCountdown({ state, serverNow, sfx, view }: { state: LiveState; serverNow: () => number; sfx: (n: Sfx) => void; view: View }) {
  const remaining = useRemainingMs(state.countdown?.deadlineAt, serverNow, true);
  const seconds = Math.max(1, Math.ceil(remaining / 1000));
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (last.current !== seconds) {
      last.current = seconds;
      sfx('countdown');
    }
  }, [seconds, sfx]);
  return <GameCountdown seconds={seconds} animate={view.animate} fancy={view.fancy} compact />;
}

function PlayerQuestion({
  state,
  serverNow,
  submit,
  sfx,
  view,
}: {
  state: LiveState;
  serverNow: () => number;
  submit: (optionIds: string[]) => Promise<'ok' | 'duplicate' | 'late' | 'error'>;
  sfx: (n: Sfx) => void;
  view: View;
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
  const urgent = remaining <= 5000 && !state.questionClosed;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 text-white">
      <div>
        <div className="mb-1.5 flex items-center justify-between text-sm font-bold text-sky-100">
          <span className="rounded-full bg-white/10 px-3 py-1">
            Soal {question.index + 1}/{question.total}
          </span>
          <span className={cn('inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 tabular-nums', urgent && 'bg-rose-500/30 text-rose-200')}>
            <Clock className="h-4 w-4" /> {Math.ceil(remaining / 1000)} dtk
          </span>
        </div>
        <div className="h-3.5 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fraction * 100)}>
          <div
            className="h-full rounded-full transition-[width] duration-100 ease-linear"
            style={{
              width: `${fraction * 100}%`,
              background: urgent ? 'linear-gradient(90deg,#FF6B8A,#EF476F)' : 'linear-gradient(90deg,#19C6E6,#FFD166)',
            }}
          />
        </div>
      </div>

      {!hidden && (question.prompt || question.imageUrl) && (
        <div className="lq-glass rounded-3xl p-4 text-lg font-extrabold leading-snug">
          {question.prompt && <RichText text={question.prompt} />}
          {question.imageUrl && (
            <img src={getAssetUrl(question.imageUrl)} alt="" className="mt-3 max-h-48 max-w-full rounded-xl bg-white/10 object-contain" />
          )}
        </div>
      )}
      {multi && !locked && !timeIsUp && <p className="text-center text-sm font-semibold text-sky-100">Pilih semua jawaban yang benar, lalu kirim.</p>}

      <div className={cn('grid flex-1 content-start gap-3', hidden && question.options.length <= 4 ? 'grid-cols-2 content-stretch' : 'grid-cols-1')}>
        {question.options.map((option, index) => {
          const isChosen = chosen.includes(option.id);
          const dim = (locked || timeIsUp) && !isChosen;
          return (
            <motion.div
              key={option.id}
              initial={view.animate ? { opacity: 0, y: 18 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: view.animate ? index * 0.05 : 0, duration: 0.28 }}
              className="contents"
            >
              <AnswerCard
                option={option}
                index={index}
                state={isChosen ? 'picked' : dim ? 'dim' : 'idle'}
                disabled={locked || timeIsUp}
                onClick={() => tap(option.id)}
                hideContent={hidden}
              />
            </motion.div>
          );
        })}
      </div>

      {multi && !locked && !timeIsUp && (
        <button type="button" disabled={!selected.length} onClick={() => void send(selected)} className="lq-btn lq-btn-gold h-14 text-lg">
          <Send className="h-5 w-5" /> Kirim jawaban
        </button>
      )}

      <div className="min-h-[2.5rem] text-center text-base font-bold" aria-live="polite">
        {sending && (
          <span className="inline-flex items-center gap-2 text-sky-100">
            <Loader2 className="h-4 w-4 animate-spin" /> Mengirim…
          </span>
        )}
        {!sending && state.myAnswer !== null && <span className="text-emerald-300">✓ Jawaban terkirim. Menunggu yang lain…</span>}
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
    .map(({ option, index }) => ({ letter: themeFor(index).letter, label: option.label }));
}

function PlayerResult({ state, view }: { state: LiveState; view: View }) {
  const result = state.result;
  const question = state.question?.question ?? state.replayQuestion;
  if (!result) return null;
  const answered = result.answered ?? false;
  const correct = result.correct ?? false;
  const correctOnes = optionLetters(question, result.correctOptionIds);
  const bg = !answered
    ? 'linear-gradient(160deg,#5b6b82,#3a475b)'
    : correct
      ? 'linear-gradient(160deg,#2DD4A7,#0f9e78)'
      : 'linear-gradient(160deg,#F0627F,#bd2a4b)';
  return (
    <motion.div
      initial={view.animate ? { scale: 0.85, opacity: 0 } : false}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 18 }}
      className="relative flex flex-1 flex-col items-center justify-center overflow-hidden rounded-[2rem] p-8 text-center text-white shadow-2xl"
      style={{ background: bg }}
    >
      <motion.div
        animate={
          view.animate ? (correct ? { y: [0, -14, 0, -8, 0] } : answered ? { x: [0, -8, 8, -6, 6, 0] } : {}) : {}
        }
        transition={{ duration: 0.7 }}
      >
        <PlayerAvatar avatarId={state.me?.avatarId} src={state.me?.avatarUrl} seed={state.me?.id ?? ''} size={104} ring />
      </motion.div>
      <span className="mt-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/25">
        {!answered ? <Clock className="h-9 w-9" /> : correct ? <Check className="h-10 w-10" strokeWidth={3.5} /> : <X className="h-10 w-10" strokeWidth={3.5} />}
      </span>
      <p className="mt-3 text-5xl font-black drop-shadow">{!answered ? 'Tidak menjawab' : correct ? 'BENAR!' : 'SALAH'}</p>
      {correctOnes.length > 0 && !correct && (
        <div className="mt-5 rounded-2xl bg-black/20 px-5 py-3 text-base">
          <p className="text-xs uppercase tracking-widest text-white/75">Jawaban benar</p>
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

function PlayerScore({ state, view, sfx }: { state: LiveState; view: View; sfx: (n: Sfx) => void }) {
  const score = state.score;
  if (!score) return null;
  const earned = score.earned ?? 0;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center text-white">
      <PlayerAvatar avatarId={state.me?.avatarId} src={state.me?.avatarUrl} seed={state.me?.id ?? ''} size={92} ring idle={view.animate} />
      <p className="text-sm font-black uppercase tracking-[0.25em] text-sky-200">Poin soal ini</p>
      <motion.p
        initial={view.animate ? { scale: 0.4, opacity: 0 } : false}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 14 }}
        className={cn('text-7xl font-black drop-shadow', earned > 0 ? 'text-emerald-300' : 'text-white/60')}
        onAnimationStart={() => earned > 0 && sfx('points')}
      >
        +<AnimatedNumber value={earned} animate={view.animate} durationMs={800} />
      </motion.p>
      <div className="lq-glass rounded-3xl px-8 py-4">
        <p className="text-sm font-semibold text-sky-200">Total poin</p>
        <p className="text-4xl font-black text-amber-300">
          <AnimatedNumber value={score.totalScore ?? 0} from={score.previousScore ?? 0} animate={view.animate} durationMs={1100} />
        </p>
      </div>
    </div>
  );
}

function PlayerLeaderboard({ state, view }: { state: LiveState; view: View }) {
  const lb = state.leaderboard;
  if (!lb) return null;
  const top = lb.top ?? [];
  const me = state.me;
  return (
    <div className="flex flex-1 flex-col items-center gap-4 text-white">
      <div className="lq-glass flex w-full items-center gap-4 rounded-3xl p-4">
        <PlayerAvatar avatarId={me?.avatarId} src={me?.avatarUrl} seed={me?.id ?? ''} size={72} ring />
        <div className="min-w-0 flex-1 text-left">
          <p className="text-xs font-bold uppercase tracking-widest text-sky-200">Peringkatmu</p>
          <p className="flex items-center gap-2 text-5xl font-black text-amber-300">
            #{lb.rank ?? '-'}
            <RankDelta delta={lb.delta} />
          </p>
          <p className="text-sm font-semibold">
            {(lb.totalScore ?? 0).toLocaleString('id-ID')} poin · dari {lb.totalPlayers} peserta
          </p>
        </div>
      </div>
      {lb.visible && top.length > 0 && (
        <div className="w-full">
          <Leaderboard entries={top} animate={view.animate} highlightId={me?.id ?? null} />
          {!lb.inTop && <p className="mt-3 text-center text-sm font-semibold text-sky-100">… kamu berada di peringkat #{lb.rank}</p>}
        </div>
      )}
      <p className="mt-auto text-sm font-semibold text-sky-100">{lb.isLast ? 'Menunggu podium…' : 'Bersiap untuk soal berikutnya'}</p>
    </div>
  );
}

function PlayerFinal({ state, view, onLeave }: { state: LiveState; view: View; onLeave: () => void }) {
  const final = state.final;
  const firedRef = useRef(false);
  useEffect(() => {
    if (final?.medal && !firedRef.current) {
      firedRef.current = true;
      fireConfetti({ enabled: view.fancy, intensity: final.medal === 'GOLD' ? 'big' : 'small' });
    }
  }, [final?.medal, view.fancy]);
  if (!final) return null;
  const medalColor = final.medal === 'GOLD' ? 'text-amber-300' : final.medal === 'SILVER' ? 'text-slate-200' : 'text-orange-300';
  const headline = final.rank === 1 ? 'Juara 1!' : final.rank === 2 ? 'Juara 2!' : final.rank === 3 ? 'Juara 3!' : 'Permainan selesai';
  return (
    <div className="flex flex-1 flex-col items-center gap-4 text-center text-white">
      <motion.div
        initial={view.animate ? { scale: 0.6, opacity: 0 } : false}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 14 }}
        className="lq-glass relative w-full overflow-hidden rounded-[2rem] p-6"
      >
        <PlayerAvatar avatarId={state.me?.avatarId} src={state.me?.avatarUrl} seed={state.me?.id ?? ''} size={104} ring idle={view.animate} className="mx-auto" />
        <div className="mt-3 flex items-center justify-center gap-2">
          {final.medal ? <Medal className={cn('h-9 w-9', medalColor)} /> : <Trophy className="h-8 w-8 text-sky-200" />}
          <p className="text-3xl font-black">{headline}</p>
        </div>
        <p className="mt-2 text-xs font-bold uppercase tracking-widest text-sky-200">Peringkat akhir</p>
        <p className="text-6xl font-black text-amber-300">#{final.rank ?? '-'}</p>
        <p className="text-sm font-semibold text-sky-100">dari {final.totalPlayers} peserta</p>
      </motion.div>
      <div className="grid w-full grid-cols-2 gap-3">
        <div className="lq-glass rounded-2xl p-4">
          <p className="text-3xl font-black text-amber-300">{(final.totalScore ?? 0).toLocaleString('id-ID')}</p>
          <p className="text-xs font-semibold text-sky-200">Total poin</p>
        </div>
        <div className="lq-glass rounded-2xl p-4">
          <p className="text-3xl font-black">{final.accuracy ?? 0}%</p>
          <p className="text-xs font-semibold text-sky-200">Akurasi</p>
        </div>
        <div className="rounded-2xl bg-emerald-500/25 p-4">
          <p className="text-3xl font-black">{final.correctCount ?? 0}</p>
          <p className="text-xs font-semibold text-emerald-100">Benar</p>
        </div>
        <div className="rounded-2xl bg-rose-500/25 p-4">
          <p className="text-3xl font-black">{final.incorrectCount ?? 0}</p>
          <p className="text-xs font-semibold text-rose-100">Salah</p>
        </div>
      </div>
      {(final.unansweredCount ?? 0) > 0 && <p className="text-sm text-sky-100">{final.unansweredCount} soal tidak dijawab</p>}
      <button type="button" onClick={onLeave} className="lq-btn lq-btn-gold mt-auto h-14 w-full text-lg">
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
  const settingsRef = useRef<ClientSettings | null>(null);
  const [settingsForMotion, setSettingsForMotion] = useState(true);
  const mo = useMotionLevel(settingsForMotion);
  const view: View = { animate: mo.animate, fancy: mo.fancy };

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

  const { state, submit, serverNow, setAvatar, sendReaction } = useLiveSession({ role: 'player', sessionId, playerToken, onEvent });
  settingsRef.current = state.settings;
  useEffect(() => {
    setSettingsForMotion(state.settings?.animationsEnabled ?? true);
  }, [state.settings?.animationsEnabled]);
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

  // Aturan tampil tombol REACT (server tetap memvalidasi ulang).
  const reactions = state.settings;
  const canReact =
    state.hasSynced &&
    !state.kicked &&
    reactions?.reactionsEnabled !== false &&
    (status === 'LOBBY' ||
      status === 'QUESTION_RESULT' ||
      status === 'SCORE_RESULT' ||
      status === 'LEADERBOARD' ||
      status === 'FINISHED' ||
      (status === 'QUESTION_ACTIVE' && reactions?.reactionsAfterSubmit !== false && state.myAnswer !== null));

  let body: React.ReactNode = null;
  if (state.kicked) {
    body = (
      <CenterCard>
        <p className="text-2xl font-black">Kamu dikeluarkan</p>
        <p className="mt-3 text-sky-100">{state.kicked}</p>
        <button type="button" onClick={leave} className="lq-btn lq-btn-gold mt-6 px-6 py-3">
          Kembali
        </button>
      </CenterCard>
    );
  } else if (state.connection === 'denied' && !state.hasSynced) {
    body = (
      <CenterCard>
        <p className="text-xl font-bold">{state.deniedReason}</p>
        <button type="button" onClick={leave} className="lq-btn lq-btn-gold mt-6 px-6 py-3">
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
        body = <PlayerLobby state={state} view={view} setAvatar={setAvatar} sfx={sfx} sessionId={sessionId} playerToken={playerToken} />;
        break;
      case 'COUNTDOWN':
        body = <PlayerCountdown state={state} serverNow={serverNow} sfx={sfx} view={view} />;
        break;
      case 'QUESTION_ACTIVE':
        body = <PlayerQuestion state={state} serverNow={serverNow} submit={submit} sfx={sfx} view={view} />;
        break;
      case 'QUESTION_RESULT':
        body = <PlayerResult state={state} view={view} />;
        break;
      case 'SCORE_RESULT':
        body = <PlayerScore state={state} view={view} sfx={sfx} />;
        break;
      case 'LEADERBOARD':
        body = <PlayerLeaderboard state={state} view={view} />;
        break;
      case 'FINISHED':
        body = <PlayerFinal state={state} view={view} onLeave={leave} />;
        break;
      case 'CANCELLED':
        body = (
          <CenterCard>
            <p className="text-2xl font-black">Sesi dibatalkan</p>
            <p className="mt-3 text-sky-100">Tutor membatalkan sesi ini.</p>
            <button type="button" onClick={leave} className="lq-btn lq-btn-gold mt-6 px-6 py-3">
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
      className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
      onPointerDown={() => liveAudio.unlock()}
    >
      <ReconnectBanner show={state.hasSynced && state.connection === 'reconnecting'} />
      <header className="flex items-center justify-between gap-3 text-white">
        <div className="flex min-w-0 items-center gap-2.5">
          <PlayerAvatar avatarId={state.me?.avatarId} src={state.me?.avatarUrl} seed={state.me?.id ?? ''} size={40} ring />
          <div className="min-w-0">
            <p className="truncate text-base font-black leading-tight">{state.me?.name ?? '…'}</p>
            <p className="truncate text-xs text-sky-200">{state.session?.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status && status !== 'LOBBY' && status !== 'COUNTDOWN' && (
            <span className="rounded-full bg-gradient-to-b from-amber-200 to-amber-400 px-3 py-1.5 text-sm font-black tabular-nums text-slate-900 shadow">
              {score.toLocaleString('id-ID')}
            </span>
          )}
          <SoundToggle />
        </div>
      </header>
      {state.paused && (
        <p className="rounded-xl bg-amber-400 px-4 py-2 text-center text-sm font-black text-slate-900">Permainan dijeda tutor</p>
      )}
      <AudioUnlockHint enabled={state.settings?.soundEnabled !== false} className="self-center" />
      <main className="flex min-h-0 flex-1 flex-col">{body}</main>
      {canReact && (
        <ReactionPicker
          send={sendReaction}
          soundEnabled={state.settings?.soundEnabled !== false}
          animate={view.animate}
          className="sticky bottom-2 z-20"
        />
      )}
    </div>
  );
}

export function LivePlayPage() {
  const { sessionId = '' } = useParams();
  const stored = playerStorage.load(sessionId);
  if (!stored) return <Navigate to="/live/join" replace />;
  return (
    <PlayShell>
      <PlayView sessionId={sessionId} playerToken={stored.playerToken} />
      <Link to="/live/join" className="sr-only">
        Gabung kuis lain
      </Link>
    </PlayShell>
  );
}

/** Pembungkus latar; mengikuti pengaturan gerak perangkat (lite/reduced) tanpa menunggu data sesi. */
function PlayShell({ children }: { children: React.ReactNode }) {
  const { level } = useMotionLevel(true);
  return (
    <GameStage level={level} className="min-h-[100dvh]">
      {children}
    </GameStage>
  );
}
