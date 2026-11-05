import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import { BarChart3, Check, Expand, Lock, LogOut, Pause, Play, SkipForward, SmilePlus, Trophy, Unlock, Users, X } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { getAssetUrl } from '@/lib/media';
import { cn } from '@/utils/cn';
import { liveQuizApi } from '../api';
import { liveAudio, type Sfx } from '../audio';
import { PlayerAvatar } from '../avatars';
import { formatPin } from '../format';
import type { ClientSettings, JoinInfo, LobbyPlayer, ReactionBatchHost, RevealRow, RevealStatus } from '../types';
import { useLiveSession, type HostAction, type LiveState } from '../useLiveSession';
import { useMotionLevel } from '../useMotionLevel';
import { AnswerCard, themeFor } from '../ui/AnswerCard';
import { GameCountdown } from '../ui/Countdown';
import { GameStage, LiveBrand } from '../ui/GameStage';
import { Leaderboard } from '../ui/Leaderboard';
import { PodiumStage, type PodiumEvent } from '../ui/PodiumStage';
import { ReactionLane, type ReactionLaneHandle } from '../ui/ReactionLane';
import {
  AnimatedNumber,
  AudioUnlockHint,
  CenterCard,
  ReconnectBanner,
  RichText,
  SoundToggle,
  TimerRing,
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

type View = { animate: boolean; fancy: boolean };

/* ------------------------------------------------------------------ */
/* Kontrol reaksi host                                                  */
/* ------------------------------------------------------------------ */

function SwitchRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/10"
    >
      <span>
        <span className="block text-sm font-bold">{label}</span>
        {hint && <span className="block text-xs text-sky-200">{hint}</span>}
      </span>
      <span className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-emerald-400' : 'bg-white/25')}>
        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
      </span>
    </button>
  );
}

function ReactionControls({ settings, onChange }: { settings: ClientSettings | null; onChange: (patch: { enabled?: boolean; afterSubmit?: boolean; onProjector?: boolean }) => void }) {
  const [open, setOpen] = useState(false);
  if (!settings) return null;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Pengaturan reaksi emoji"
        className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
      >
        <SmilePlus className="h-5 w-5" />
        <span className={cn('absolute right-0 top-0 h-3 w-3 rounded-full ring-2 ring-[#0b2240]', settings.reactionsEnabled ? 'bg-emerald-400' : 'bg-rose-500')} />
      </button>
      {open && (
        <div className="lq-glass absolute right-0 top-12 z-40 w-72 rounded-2xl bg-[#081b33]/95 p-3 text-white">
          <p className="px-2 pb-1 text-xs font-black uppercase tracking-widest text-amber-300">Reaksi emoji</p>
          <SwitchRow label="Aktifkan reaksi" hint="Matikan untuk semua peserta" checked={settings.reactionsEnabled} onChange={(v) => onChange({ enabled: v })} />
          <SwitchRow
            label="Boleh saat soal berlangsung"
            hint="Hanya setelah peserta menjawab"
            checked={settings.reactionsAfterSubmit}
            onChange={(v) => onChange({ afterSubmit: v })}
          />
          <SwitchRow label="Tampilkan di layar" hint="Sembunyikan dari proyektor" checked={settings.reactionsOnProjector} onChange={(v) => onChange({ onProjector: v })} />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tahap-tahap layar                                                    */
/* ------------------------------------------------------------------ */

function HostLobby({ state, join, onKick, view }: { state: LiveState; join: JoinInfo | null; onKick: (player: LobbyPlayer) => void; view: View }) {
  const players = state.lobby?.players ?? [];
  const url = join ? buildJoinUrl(join) : null;
  const isLocalOnly = url ? /\/\/(localhost|127\.0\.0\.1)/.test(url) : false;
  const dense = players.length > 24;
  const avatarSize = dense ? 56 : players.length > 12 ? 68 : 84;

  return (
    <div className="grid h-full min-h-0 gap-5 lg:grid-cols-[minmax(300px,420px)_1fr]">
      <div className="lq-glass flex min-h-0 flex-col items-center justify-center gap-3 overflow-y-auto rounded-[2rem] p-5 text-center text-white">
        <p className="text-lg font-semibold text-sky-100">
          Buka <span className="font-black text-white">{url ? stripProtocol(url) : '…'}</span>
        </p>
        <p className="text-xs font-black uppercase tracking-[0.35em] text-sky-200">PIN Game</p>
        <p
          className="rounded-2xl bg-white/10 px-5 py-1 text-6xl font-black tracking-widest text-amber-300 sm:text-7xl"
          aria-label={`PIN ${state.session?.pin ?? ''}`}
        >
          {state.session?.pin ? formatPin(state.session.pin) : '------'}
        </p>
        {url && (
          <div className="rounded-3xl bg-white p-4 shadow-2xl">
            <QRCodeSVG value={url} size={190} level="M" marginSize={0} fgColor="#102A43" />
          </div>
        )}
        <p className="text-sm font-semibold text-sky-100">Scan QR dengan kamera HP atau masukkan PIN.</p>
        {isLocalOnly && (
          <p className="rounded-xl bg-amber-400/20 px-3 py-2 text-xs text-amber-100">
            Alamat masih <strong>localhost</strong> sehingga HP tidak bisa membukanya. Buka halaman ini lewat alamat IP jaringan (mis.
            http://192.168.x.x:5173) atau isi <code>APP_URL</code> di server.
          </p>
        )}
      </div>

      <div className="flex min-h-0 flex-col rounded-[2rem] bg-white/5 p-5 text-white">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-2xl font-black">
            <Users className="h-6 w-6 text-amber-300" />
            <AnimatedNumber value={players.length} animate={false} /> pemain bergabung
          </h2>
          {state.lobbyLocked && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/30 px-3 py-1 text-sm font-semibold text-rose-100">
              <Lock className="h-4 w-4" /> Lobby terkunci
            </span>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {players.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center text-xl text-sky-100/80">
              <span className="lq-pulse flex h-24 w-24 items-center justify-center rounded-full bg-white/10">
                <Users className="h-12 w-12" />
              </span>
              Menunggu pemain bergabung…
            </div>
          ) : (
            <ul className="grid content-start gap-3" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${avatarSize + 44}px, 1fr))` }}>
              <AnimatePresence initial={false}>
                {players.map((player) => (
                  <motion.li
                    key={player.id}
                    layout={view.animate}
                    initial={view.animate ? { opacity: 0, scale: 0.4, y: 20 } : false}
                    animate={{ opacity: player.connected ? 1 : 0.5, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 20 }}
                    className="group relative flex flex-col items-center gap-1.5 rounded-2xl bg-white/[0.07] px-2 pb-2 pt-3"
                    title={player.connected ? 'Terhubung' : 'Terputus'}
                  >
                    <PlayerAvatar avatarId={player.avatarId} seed={player.id} size={avatarSize} idle={view.fancy && !dense} />
                    <span
                      className={cn(
                        'max-w-full truncate rounded-full px-3 py-0.5 text-center font-extrabold',
                        dense ? 'text-sm' : 'text-base',
                        player.connected ? 'bg-white text-slate-900' : 'bg-white/30 text-white/80',
                      )}
                    >
                      {player.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => onKick(player)}
                      className="absolute right-1 top-1 hidden rounded-full bg-rose-500 p-1 text-white shadow group-hover:block"
                      aria-label={`Keluarkan ${player.name}`}
                    >
                      <X className="h-3.5 w-3.5" />
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

function HostCountdown({ state, serverNow, sfx, view }: { state: LiveState; serverNow: () => number; sfx: (name: Sfx) => void; view: View }) {
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
    <div className="flex h-full min-h-0 flex-col">
      <GameCountdown seconds={seconds} animate={view.animate} fancy={view.fancy} />
    </div>
  );
}

function HostQuestion({ state, serverNow, sfx, view }: { state: LiveState; serverNow: () => number; sfx: (name: Sfx) => void; view: View }) {
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
    <div
      className="lq-host-board min-h-0 flex-1 text-white"
      style={{ gridTemplateRows: `minmax(0, 2fr) repeat(${question.options.length}, minmax(0, 1fr))` }}
    >
      <div className="flex min-h-0 items-stretch gap-4">
        <motion.div
          key={question.index}
          initial={view.animate ? { opacity: 0, y: -16 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="lq-glass flex min-h-0 min-w-0 flex-1 flex-col justify-center overflow-hidden rounded-[1.5rem] px-6 py-4"
        >
          <p className="mb-2 shrink-0 text-sm font-black uppercase tracking-widest text-sky-200">
            Soal {question.index + 1} dari {question.total}
            {multi ? ' · pilih semua jawaban yang benar' : question.type === 'TRUE_FALSE' ? ' · benar atau salah' : ''}
            {question.weight === 'DOUBLE' ? ' · POIN 2x' : question.weight === 'NONE' ? ' · tanpa poin' : ''}
          </p>
          <div className="text-2xl font-extrabold leading-snug xl:text-4xl">{question.prompt && <RichText text={question.prompt} />}</div>
          {question.imageUrl && (
            <img src={getAssetUrl(question.imageUrl)} alt="" className="mt-3 max-h-[42%] max-w-full rounded-xl bg-white/10 object-contain" />
          )}
        </motion.div>
        <div className="flex shrink-0 flex-col items-center justify-center gap-3">
          <TimerRing remainingMs={remaining} totalMs={payload.durationMs} size={116} pulse={view.fancy} />
          <div className="lq-glass rounded-2xl px-4 py-2 text-center">
            <p className="text-3xl font-black tabular-nums">
              {state.answeredCount}
              <span className="text-lg text-sky-200">/{state.totalPlayers}</span>
            </p>
            <p className="text-xs font-semibold text-sky-200">sudah menjawab</p>
          </div>
        </div>
      </div>

      {question.options.map((option, index) => (
        <motion.div
          key={option.id}
          initial={view.animate ? { opacity: 0, y: 22 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: view.animate ? 0.1 + index * 0.06 : 0, duration: 0.3 }}
          className="flex min-h-0 min-w-0"
        >
          <AnswerCard option={option} index={index} size="host" />
        </motion.div>
      ))}
    </div>
  );
}

function HostResult({ state, view }: { state: LiveState; view: View }) {
  const result = state.result;
  const question = result?.question ?? state.replayQuestion;
  if (!result || !question) return null;
  const distribution = result.distribution ?? {};
  const max = Math.max(1, ...Object.values(distribution));
  const correctIds = result.correctOptionIds;
  const counts = result.counts;

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 text-white">
      <div className="lq-glass rounded-[2rem] p-4">
        <p className="text-sm font-black uppercase tracking-widest text-sky-200">
          Hasil soal {question.index + 1} dari {question.total}
        </p>
        <div className="mt-1 text-2xl font-extrabold sm:text-3xl">{question.prompt && <RichText text={question.prompt} />}</div>
      </div>

      <div className="flex min-h-0 flex-1 items-end justify-center gap-4 sm:gap-8">
        {question.options.map((option, index) => {
          const theme = themeFor(index);
          const count = distribution[option.id] ?? 0;
          const isCorrect = correctIds ? correctIds.includes(option.id) : null;
          const dim = isCorrect === false;
          return (
            <div key={option.id} className={cn('flex h-full w-full max-w-[12rem] flex-col items-center justify-end gap-2 transition-opacity', dim && 'opacity-40')}>
              <span className="text-3xl font-black tabular-nums">{count}</span>
              <div className="flex w-full flex-1 items-end">
                <motion.div
                  initial={view.animate ? { height: 0 } : false}
                  animate={{ height: `${Math.max(count === 0 ? 2 : 6, (count / max) * 100)}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={cn('relative w-full rounded-t-2xl', isCorrect && 'ring-4 ring-emerald-300')}
                  style={{ background: `linear-gradient(180deg, ${theme.top}, ${theme.bottom})` }}
                />
              </div>
              <div
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-base font-bold"
                style={{ background: `linear-gradient(180deg, ${theme.top}, ${theme.bottom})` }}
              >
                {isCorrect && <Check className="h-5 w-5 shrink-0 text-emerald-100" aria-label="Jawaban benar" />}
                <span className="shrink-0 font-black">{theme.letter}</span>
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
            <p className="text-sm font-semibold text-emerald-100">Benar</p>
          </div>
          <div className="rounded-2xl bg-rose-500/25 p-3">
            <p className="text-3xl font-black">{counts.wrong}</p>
            <p className="text-sm font-semibold text-rose-100">Salah</p>
          </div>
          <div className="lq-glass rounded-2xl p-3">
            <p className="text-3xl font-black">{counts.unanswered}</p>
            <p className="text-sm font-semibold text-sky-100">Tidak menjawab</p>
          </div>
        </div>
      )}
    </div>
  );
}

type RevealFilter = 'ALL' | RevealStatus;

const REVEAL_FILTERS: Array<{ id: RevealFilter; label: string }> = [
  { id: 'ALL', label: 'Semua' },
  { id: 'CORRECT', label: 'Benar' },
  { id: 'WRONG', label: 'Salah' },
  { id: 'NONE', label: 'Tidak Menjawab' },
];

const REVEAL_STATUS: Record<RevealStatus, { label: string; chip: string; row: string; points: string }> = {
  CORRECT: {
    label: 'Benar',
    chip: 'bg-emerald-400/25 text-emerald-100 ring-1 ring-emerald-300/50',
    row: 'border-emerald-300/40 bg-emerald-500/15',
    points: 'text-emerald-300',
  },
  WRONG: {
    label: 'Salah',
    chip: 'bg-rose-400/25 text-rose-100 ring-1 ring-rose-300/50',
    row: 'border-rose-300/40 bg-rose-500/15',
    points: 'text-rose-200/80',
  },
  NONE: {
    label: 'Tidak Menjawab',
    chip: 'bg-slate-400/20 text-slate-200 ring-1 ring-slate-300/30',
    row: 'border-white/10 bg-slate-500/15',
    points: 'text-slate-300/70',
  },
};

// Kolom: No | Siswa | Pilihan | Status | Poin (grid yang sama untuk header sticky dan setiap baris).
const REVEAL_GRID =
  'grid grid-cols-[clamp(2.1rem,3.6vw,3.25rem)_minmax(0,1.8fr)_clamp(3.5rem,7vw,6rem)_clamp(6rem,12vw,11rem)_clamp(4.25rem,8vw,7.5rem)] items-center gap-2 sm:gap-3';

function letterTheme(letter: string) {
  return themeFor(Math.max(0, letter.charCodeAt(0) - 65));
}

/** Sama dengan backend `compareReveal`: poin soal ini ↓, waktu ↑, nama A–Z, ID. Tidak menghitung ulang poin. */
function compareRevealRows(a: RevealRow, b: RevealRow): number {
  if (a.earned !== b.earned) return b.earned - a.earned;
  const ta = a.responseMs ?? Number.POSITIVE_INFINITY;
  const tb = b.responseMs ?? Number.POSITIVE_INFINITY;
  if (ta !== tb) return ta < tb ? -1 : 1;
  const byName = a.name.localeCompare(b.name, 'id', { sensitivity: 'base' });
  if (byName !== 0) return byName;
  return a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0;
}

/** Detail Jawaban Siswa: seluruh peserta, diurutkan poin soal ini (bukan total leaderboard). */
function HostAnswerDetails({ rows, view }: { rows: RevealRow[]; view: View }) {
  const [filter, setFilter] = useState<RevealFilter>('ALL');
  const counts = useMemo(() => {
    const c = { ALL: rows.length, CORRECT: 0, WRONG: 0, NONE: 0 } as Record<RevealFilter, number>;
    for (const row of rows) c[row.status] += 1;
    return c;
  }, [rows]);
  const visible = useMemo(() => {
    const list = filter === 'ALL' ? rows : rows.filter((row) => row.status === filter);
    return [...list].sort(compareRevealRows);
  }, [rows, filter]);

  const many = visible.length >= 12;
  const dense = visible.length >= 28;
  const avatarSize = dense ? 32 : many ? 40 : visible.length <= 6 ? 56 : 48;
  const rowPad = dense ? 'px-2 py-1' : many ? 'px-2 py-1.5' : visible.length <= 6 ? 'px-3 py-2.5' : 'px-3 py-2';
  return (
    <div className="flex h-full min-h-0 w-full flex-col items-center gap-2 text-white">
      <div className="flex w-[min(98%,96rem)] flex-wrap items-center justify-between gap-3">
        <div>
            <h2 className="flex items-center gap-3 text-[clamp(1.75rem,3.6vw,3.25rem)] font-black uppercase leading-tight tracking-wide">
            <BarChart3 className="h-[1.1em] w-[1.1em] text-amber-300" /> Detail Jawaban Siswa
          </h2>
          <p className="mt-1 text-sm font-semibold text-sky-100/80 xl:text-base">Poin soal ini, dari tertinggi ke terendah</p>
        </div>
        <div role="tablist" aria-label="Filter jawaban" className="flex flex-wrap gap-2">
          {REVEAL_FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={filter === item.id}
              onClick={() => setFilter(item.id)}
              className={cn(
                'rounded-full px-3 py-1.5 text-sm font-bold transition xl:px-4 xl:text-base',
                filter === item.id ? 'bg-white text-slate-900 shadow-lg' : 'lq-glass text-white hover:bg-white/20',
              )}
            >
              {item.label} <span className="tabular-nums opacity-70">{counts[item.id]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={cn('lq-glass flex w-[min(98%,96rem)] flex-col overflow-hidden rounded-3xl', many || visible.length > 6 ? 'min-h-0 flex-1' : 'max-h-full')}>
        <div className={cn(REVEAL_GRID, 'sticky top-0 z-10 shrink-0 border-b border-white/15 bg-slate-950/70 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-sky-100/80 backdrop-blur xl:text-sm')}>
          <span className="text-center">No</span>
          <span>Avatar & Nama</span>
          <span className="text-center">Pilihan</span>
          <span className="text-center">Status</span>
          <span className="text-right">Poin</span>
        </div>
        <ol className={cn('min-h-0 space-y-1 overflow-y-auto p-2', (many || visible.length > 6) && 'flex-1')} aria-label="Daftar jawaban siswa">
          {visible.length === 0 && (
            <li className="py-10 text-center text-xl text-sky-100">Tidak ada siswa pada filter ini.</li>
          )}
          {visible.map((row, index) => {
            const style = REVEAL_STATUS[row.status];
            const stagger = Math.min(index, 14) * 0.045;
            return (
              <motion.li
                key={row.playerId}
                layout={view.animate ? 'position' : false}
                initial={view.animate ? { opacity: 0, x: -28 } : false}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: view.animate ? stagger : 0, duration: 0.3 }}
                data-testid="reveal-row"
                data-status={row.status}
                className={cn(REVEAL_GRID, 'rounded-xl border', rowPad, style.row)}
              >
                <span className="text-center text-[clamp(1rem,1.8vw,1.75rem)] font-black tabular-nums text-white/70">{index + 1}</span>
                <span className="flex min-w-0 items-center gap-3">
                  <PlayerAvatar avatarId={row.avatarId} seed={row.playerId} size={avatarSize} />
                  <span className="min-w-0 truncate text-[clamp(1rem,1.8vw,1.75rem)] font-bold">{row.name}</span>
                </span>
                <span className="flex justify-center gap-1">
                  {row.selectedLetters.length ? (
                    row.selectedLetters.map((letter) => {
                      const theme = letterTheme(letter);
                      return (
                        <span
                          key={letter}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-base font-black text-white shadow xl:h-11 xl:w-11 xl:text-xl"
                          style={{ background: `linear-gradient(180deg, ${theme.top}, ${theme.bottom})` }}
                        >
                          {letter}
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-xl font-black text-white/40">–</span>
                  )}
                </span>
                <span className="flex justify-center">
                  <span className={cn('whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold xl:text-base', style.chip)}>{style.label}</span>
                </span>
                <span className={cn('text-right text-[clamp(1.1rem,2vw,2rem)] font-black', style.points)}>
                  {row.earned > 0 ? '+' : ''}
                  <AnimatedNumber value={row.earned} animate={view.animate && index < 15 && row.earned > 0} durationMs={900} />
                </span>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function HostScore({ state, view }: { state: LiveState; view: View }) {
  const answers = state.score?.answers;
  if (answers) return <HostAnswerDetails key={state.score?.questionIndex} rows={answers} view={view} />;
  return <HostTopGains state={state} view={view} />;
}

// Cadangan untuk server lama yang belum mengirim daftar jawaban lengkap.
function HostTopGains({ state, view }: { state: LiveState; view: View }) {
  const gains = state.score?.topGains ?? [];
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 text-white">
      <h2 className="flex items-center gap-3 text-4xl font-black">
        <BarChart3 className="h-10 w-10 text-amber-300" /> Poin soal ini
      </h2>
      {gains.length ? (
        <ol className="w-full max-w-2xl space-y-3">
          {gains.map((gain, index) => (
            <motion.li
              key={`${gain.name}-${index}`}
              initial={view.animate ? { opacity: 0, x: -40 } : false}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: view.animate ? index * 0.12 : 0 }}
              className="lq-glass flex items-center gap-4 rounded-2xl px-5 py-3 text-2xl font-bold"
            >
              <PlayerAvatar avatarId={gain.avatarId} seed={gain.name} size={52} />
              <span className="min-w-0 flex-1 truncate">{gain.name}</span>
              <span className="font-black text-emerald-300">+{gain.earned.toLocaleString('id-ID')}</span>
            </motion.li>
          ))}
        </ol>
      ) : (
        <p className="text-2xl text-sky-100">Tidak ada yang mendapat poin di soal ini.</p>
      )}
    </div>
  );
}

function HostLeaderboard({ state, view }: { state: LiveState; view: View }) {
  const lb = state.leaderboard;
  const [showAll, setShowAll] = useState(false);
  const top = lb?.entries ?? [];
  const all = lb?.standings ?? top;
  const shown = showAll ? all : top;
  if (!lb) return null;
  return (
    <div className="flex h-full min-h-0 flex-col items-center gap-2 overflow-hidden text-white">
      <h2 className="flex shrink-0 items-center gap-3 text-[clamp(1.85rem,4.2vw,4.25rem)] font-black tracking-wide">
        <Trophy className="h-[0.9em] w-[0.9em] text-amber-300" /> TACTICAL LEADERBOARD
      </h2>
      {lb.visible === false ? (
        <p className="mt-10 text-2xl text-sky-100">Leaderboard disembunyikan oleh pengaturan sesi.</p>
      ) : (
        <>
          <Leaderboard entries={shown} animate={view.animate && !showAll} large className="min-h-0 flex-1" />
          {all.length > top.length && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="lq-btn lq-btn-ghost shrink-0 px-5 py-2 text-sm"
            >
              {showAll ? `Tampilkan Top ${top.length}` : `Lihat semua peringkat (${all.length})`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function HostFinal({ state, view, sfx, sessionId }: { state: LiveState; view: View; sfx: (name: Sfx) => void; sessionId: string }) {
  const final = state.final;
  const onEvent = useCallback(
    (event: PodiumEvent) => {
      switch (event) {
        case 'lights':
          sfx('whoosh');
          break;
        case 'podium':
          sfx('podiumRise');
          break;
        case 'avatar':
          sfx('reveal');
          break;
        case 'winner':
          sfx('drumroll');
          window.setTimeout(() => sfx('fanfare'), 1100);
          break;
        case 'trophy':
          sfx('trophy');
          if (liveAudio.currentMusic !== 'victory') liveAudio.startMusic('victory');
          break;
        default:
          break;
      }
    },
    [sfx],
  );
  if (!final) return null;
  return (
    <div className="relative flex h-full min-h-0 flex-col items-center gap-2 overflow-hidden text-white">
      <h2 className="shrink-0 text-[clamp(1.75rem,4vw,3.75rem)] font-black tracking-wide">
        {final.early ? 'SESI DIHENTIKAN' : 'FINAL CHAMPIONS'}
      </h2>
      {final.podium.length ? (
        <PodiumStage podium={final.podium} animate={view.animate} fancy={view.fancy} onEvent={onEvent} />
      ) : (
        <p className="text-xl text-sky-100">Tidak ada peserta.</p>
      )}
      <Link to={`/admin/live-quiz/laporan/${sessionId}`} className="lq-btn lq-btn-gold shrink-0 px-8 py-3 text-lg">
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
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'end' | 'cancel' | null>(null);
  const [kickTarget, setKickTarget] = useState<LobbyPlayer | null>(null);
  const settingsRef = useRef<ClientSettings | null>(null);
  const laneRef = useRef<ReactionLaneHandle | null>(null);
  const lastReactionSfx = useRef(0);
  const [animationsAllowed, setAnimationsAllowed] = useState(true);
  const mo = useMotionLevel(animationsAllowed);
  const view: View = { animate: mo.animate, fancy: mo.fancy };

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
          laneRef.current?.clear();
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
        case 'live_reaction_broadcast': {
          const batch = payload as ReactionBatchHost;
          if (batch.items?.length) {
            laneRef.current?.push(batch.items);
            const now = Date.now();
            if (now - lastReactionSfx.current > 900) {
              lastReactionSfx.current = now;
              sfx('reaction');
            }
          }
          break;
        }
        default:
          break;
      }
    },
    [sfx],
  );

  const { state, hostAction, serverNow } = useLiveSession({ role: 'host', sessionId, onEvent });
  settingsRef.current = state.settings;
  useEffect(() => {
    setAnimationsAllowed(state.settings?.animationsEnabled ?? true);
  }, [state.settings?.animationsEnabled]);
  const status = state.status;

  // Musik latar mengikuti tahap permainan (musik kemenangan dimulai oleh animasi podium).
  useEffect(() => {
    if (state.settings?.soundEnabled === false) {
      liveAudio.stopMusic();
      return;
    }
    if (status === 'LOBBY') liveAudio.startMusic('lobby');
    else if (status === 'QUESTION_ACTIVE' && !state.questionClosed) liveAudio.startMusic('question');
    else if (status === 'SCORE_RESULT' || status === 'LEADERBOARD') liveAudio.startMusic('leaderboard');
    else if (status === 'FINISHED' && liveAudio.currentMusic === 'victory') return;
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

  const setReactions = (patch: { enabled?: boolean; afterSubmit?: boolean; onProjector?: boolean }) => {
    liveAudio.unlock();
    void hostAction({ type: 'set_reactions', ...patch }).then((result) => {
      if (!result.ok) toast.error(result.message ?? 'Gagal mengubah pengaturan reaksi.');
    });
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  const pin = state.session?.pin ?? meta.data?.pin ?? null;
  const join = useMemo(
    () => (meta.data?.join ? meta.data.join : pin ? { pin, joinPath: `/live/join?pin=${pin}`, joinBaseUrl: null, lanHosts: [] } : null),
    [meta.data, pin],
  );

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
        <Link to="/admin/live-quiz" className="lq-btn lq-btn-gold mt-6 px-6 py-2">
          Kembali ke Live Quiz
        </Link>
      </CenterCard>
    );
  } else if (!state.hasSynced) {
    body = <p className="flex h-full items-center justify-center text-xl text-sky-100">Menghubungkan ke sesi…</p>;
  } else {
    switch (status) {
      case 'LOBBY':
        body = <HostLobby state={state} join={join} onKick={setKickTarget} view={view} />;
        break;
      case 'COUNTDOWN':
        body = <HostCountdown state={state} serverNow={serverNow} sfx={sfx} view={view} />;
        break;
      case 'QUESTION_ACTIVE':
        body = <HostQuestion state={state} serverNow={serverNow} sfx={sfx} view={view} />;
        break;
      case 'QUESTION_RESULT':
        body = <HostResult state={state} view={view} />;
        break;
      case 'SCORE_RESULT':
        body = <HostScore state={state} view={view} />;
        break;
      case 'LEADERBOARD':
        body = <HostLeaderboard state={state} view={view} />;
        break;
      case 'FINISHED':
        body = <HostFinal state={state} view={view} sfx={sfx} sessionId={sessionId} />;
        break;
      case 'CANCELLED':
        body = (
          <CenterCard>
            <p className="text-2xl font-bold">Sesi dibatalkan</p>
            <Link to="/admin/live-quiz" className="lq-btn lq-btn-gold mt-6 px-6 py-2">
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
  const laneVisible = Boolean(state.settings?.reactionsEnabled && state.settings?.reactionsOnProjector) && !ended;

  return (
    <GameStage level={mo.level} className="flex h-[100dvh] flex-col overflow-hidden">
      <div className="contents" onPointerDown={() => liveAudio.unlock()}>
        <ReconnectBanner show={state.hasSynced && state.connection === 'reconnecting'} />

        <header className="flex shrink-0 items-center justify-between gap-4 px-6 py-3 text-white">
          <div className="flex min-w-0 items-center gap-4">
            <LiveBrand compact />
            <p className="hidden min-w-0 truncate border-l border-white/20 pl-4 text-lg font-bold md:block">
              {state.session?.title ?? meta.data?.title ?? '…'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <AudioUnlockHint enabled={state.settings?.soundEnabled !== false} />
            {pin && !ended && status !== 'LOBBY' && (
              <span className="lq-glass hidden rounded-full px-4 py-2 text-sm font-black sm:inline">PIN {formatPin(pin)}</span>
            )}
            {!ended && (
              <span className="lq-glass hidden items-center gap-2 rounded-full px-4 py-2 text-sm font-black sm:inline-flex">
                <Users className="h-4 w-4" /> {state.playerCount}
              </span>
            )}
            {state.paused && <span className="rounded-full bg-amber-400 px-4 py-2 text-sm font-black text-slate-900">JEDA</span>}
            {!ended && <ReactionControls settings={state.settings} onChange={setReactions} />}
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
              className="lq-btn lq-btn-danger h-10 px-4 text-sm"
            >
              <LogOut className="h-4 w-4" />
              {ended ? 'Keluar' : status === 'LOBBY' ? 'Batalkan' : 'Akhiri'}
            </button>
          </div>
        </header>

        {/* Konten + kolom khusus reaksi (reaksi tidak pernah menimpa konten) */}
        <div className="flex min-h-0 flex-1 gap-2 px-6 pb-3">
          <main className="flex h-full min-h-0 min-w-0 flex-1 flex-col">{body}</main>
          {laneVisible && <ReactionLane ref={laneRef} lite={!view.fancy} />}
        </div>

        {state.hasSynced && !ended && (
          <footer className="flex shrink-0 flex-wrap items-center justify-center gap-3 px-6 pb-4">
            {status === 'LOBBY' && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act({ type: 'lock', locked: !state.lobbyLocked })}
                  className="lq-btn lq-btn-ghost px-5 py-3"
                >
                  {state.lobbyLocked ? <Unlock className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                  {state.lobbyLocked ? 'Buka lobby' : 'Kunci lobby'}
                </button>
                <button
                  type="button"
                  disabled={busy || state.playerCount < 1 || state.connection !== 'connected'}
                  onClick={() => void act({ type: 'start' })}
                  className="lq-btn lq-btn-gold px-12 py-4 text-xl"
                >
                  <Play className="h-6 w-6" /> MULAI
                </button>
              </>
            )}
            {nextLabel && (
              <button
                type="button"
                disabled={busy || state.connection !== 'connected'}
                onClick={() => void act({ type: 'next', version: state.version })}
                className="lq-btn lq-btn-gold px-8 py-3 text-lg"
              >
                <SkipForward className="h-5 w-5" /> {nextLabel}
              </button>
            )}
            {canPause && (
              <button type="button" disabled={busy} onClick={() => void act({ type: state.paused ? 'resume' : 'pause' })} className="lq-btn lq-btn-ghost px-5 py-3">
                {state.paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
                {state.paused ? 'Lanjutkan' : 'Jeda'}
              </button>
            )}
            {state.settings?.advanceMode === 'AUTO' && status === 'LEADERBOARD' && !state.paused && (
              <span className="text-sm font-semibold text-sky-100">Otomatis lanjut ke soal berikutnya…</span>
            )}
          </footer>
        )}
      </div>

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
    </GameStage>
  );
}
