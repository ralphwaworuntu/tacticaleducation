import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { API_BASE_ORIGIN } from '@/lib/api';
import { authStore } from '@/store/auth';
import { liveQuizApi } from './api';
import type {
  ClientSettings,
  FinalPayload,
  LeaderboardPayload,
  LivePhase,
  LobbyPayload,
  LobbyPlayer,
  ReactionId,
  ReactionSettingsPayload,
  QuestionPayload,
  PublicQuestion,
  ResultPayload,
  ScorePayload,
  SyncPayload,
} from './types';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'denied';

export type LiveState = {
  connection: ConnectionStatus;
  deniedReason: string | null;
  hasSynced: boolean;
  version: number;
  status: LivePhase | null;
  paused: boolean;
  lobbyLocked: boolean;
  session: SyncPayload['session'] | null;
  settings: ClientSettings | null;
  playerCount: number;
  lobby: LobbyPayload | null;
  me: SyncPayload['me'] | null;
  countdown: { startedAt: number; deadlineAt: number; countdownMs: number } | null;
  question: QuestionPayload | null;
  replayQuestion: PublicQuestion | null;
  questionClosed: boolean;
  myAnswer: string[] | null;
  answeredCount: number;
  totalPlayers: number;
  result: ResultPayload | null;
  score: ScorePayload | null;
  leaderboard: LeaderboardPayload | null;
  final: FinalPayload | null;
  kicked: string | null;
  /** serverNow - Date.now() dalam ms. */
  offsetMs: number;
};

const initialState: LiveState = {
  connection: 'connecting',
  deniedReason: null,
  hasSynced: false,
  version: -1,
  status: null,
  paused: false,
  lobbyLocked: false,
  session: null,
  settings: null,
  playerCount: 0,
  lobby: null,
  me: null,
  countdown: null,
  question: null,
  replayQuestion: null,
  questionClosed: false,
  myAnswer: null,
  answeredCount: 0,
  totalPlayers: 0,
  result: null,
  score: null,
  leaderboard: null,
  final: null,
  kicked: null,
  offsetMs: 0,
};

type Action =
  | { type: 'connection'; status: ConnectionStatus; reason?: string }
  | { type: 'offset'; offsetMs: number }
  | { type: 'myAnswer'; optionIds: string[] }
  | { type: 'event'; event: string; payload: unknown };

type Versioned = { version?: number };

const isStale = (state: LiveState, payload: unknown) => {
  const version = (payload as Versioned | null)?.version;
  return typeof version === 'number' && version < state.version;
};

function applySync(state: LiveState, sync: SyncPayload): LiveState {
  const active = sync.status === 'QUESTION_ACTIVE';
  const questionActive = active ? (sync.question as QuestionPayload | null) : null;
  const replay = !active && sync.question ? (sync.question as PublicQuestion) : null;
  return {
    ...state,
    hasSynced: true,
    version: sync.version,
    status: sync.status,
    paused: sync.paused,
    lobbyLocked: sync.lobbyLocked,
    session: sync.session,
    settings: sync.settings,
    playerCount: sync.playerCount,
    lobby: sync.lobby ?? state.lobby,
    me: sync.me ?? state.me,
    countdown: sync.countdown ?? null,
    question: questionActive,
    replayQuestion: replay,
    questionClosed: !active,
    myAnswer: sync.myAnswer?.optionIds ?? null,
    answeredCount: questionActive?.answeredCount ?? 0,
    totalPlayers: questionActive?.totalPlayers ?? sync.playerCount,
    result: sync.result ?? null,
    score: sync.score ?? null,
    leaderboard: sync.leaderboard ?? null,
    final: sync.final ?? null,
    offsetMs: sync.serverNow - Date.now(),
  };
}

function reduce(state: LiveState, action: Action): LiveState {
  switch (action.type) {
    case 'connection':
      return {
        ...state,
        connection: action.status,
        deniedReason: action.status === 'denied' ? (action.reason ?? 'Akses ditolak.') : state.deniedReason,
      };
    case 'offset':
      return { ...state, offsetMs: action.offsetMs };
    case 'myAnswer':
      return { ...state, myAnswer: action.optionIds };
    case 'event':
      break;
  }

  const { event, payload } = action;
  const data = payload as Record<string, unknown> & Versioned;

  switch (event) {
    case 'session_state_sync':
      return applySync(state, payload as SyncPayload);

    case 'lobby_updated': {
      const lobby = payload as LobbyPayload;
      return {
        ...state,
        lobby: Array.isArray((data as { players?: unknown }).players) ? lobby : state.lobby,
        playerCount: lobby.count,
        lobbyLocked: lobby.locked,
      };
    }

    case 'pause_changed':
      return { ...state, paused: Boolean(data.paused) };

    case 'player_avatar_updated': {
      // Pemain: { avatarId } untuk dirinya sendiri. Host: { player } -> perbarui kartu di lobby.
      const hostPlayer = (data as { player?: LobbyPlayer }).player;
      if (hostPlayer && state.lobby) {
        return {
          ...state,
          lobby: { ...state.lobby, players: state.lobby.players.map((p) => (p.id === hostPlayer.id ? { ...p, ...hostPlayer } : p)) },
        };
      }
      const avatarId = (data as { avatarId?: string }).avatarId;
      if (avatarId && state.me) return { ...state, me: { ...state.me, avatarId } };
      return state;
    }

    case 'reactions_enabled_changed': {
      if (!state.settings) return state;
      const next = payload as unknown as ReactionSettingsPayload;
      return {
        ...state,
        settings: {
          ...state.settings,
          reactionsEnabled: next.reactionsEnabled,
          reactionsAfterSubmit: next.reactionsAfterSubmit,
          reactionsOnProjector: next.reactionsOnProjector,
        },
      };
    }

    case 'kicked':
      return { ...state, kicked: String(data.reason ?? 'Anda dikeluarkan oleh tutor.') };

    case 'game_starting': {
      if (isStale(state, payload)) return state;
      const countdown = payload as unknown as { startedAt: number; deadlineAt: number; countdownMs: number };
      return {
        ...state,
        version: data.version ?? state.version,
        status: 'COUNTDOWN',
        countdown,
        question: null,
        result: null,
        score: null,
        leaderboard: null,
        lobbyLocked: state.lobbyLocked,
      };
    }

    case 'question_started': {
      if (isStale(state, payload)) return state;
      const question = payload as unknown as QuestionPayload;
      return {
        ...state,
        version: question.version,
        status: 'QUESTION_ACTIVE',
        question,
        replayQuestion: null,
        questionClosed: false,
        myAnswer: null,
        answeredCount: 0,
        totalPlayers: question.totalPlayers ?? state.playerCount,
        result: null,
        score: null,
        leaderboard: null,
        countdown: null,
      };
    }

    case 'answer_submitted':
      if (typeof data.questionIndex === 'number' && state.question && data.questionIndex !== state.question.questionIndex) return state;
      return {
        ...state,
        answeredCount: Number(data.answeredCount ?? state.answeredCount),
        totalPlayers: Number(data.totalPlayers ?? state.totalPlayers),
      };

    case 'question_ended':
      if (isStale(state, payload)) return state;
      return { ...state, version: data.version ?? state.version, questionClosed: true };

    case 'question_result': {
      if (isStale(state, payload)) return state;
      return {
        ...state,
        version: data.version ?? state.version,
        status: 'QUESTION_RESULT',
        questionClosed: true,
        result: payload as unknown as ResultPayload,
      };
    }

    case 'score_updated': {
      if (isStale(state, payload)) return state;
      const score = payload as unknown as ScorePayload;
      return {
        ...state,
        version: score.version,
        status: 'SCORE_RESULT',
        score,
        me: state.me && typeof score.totalScore === 'number' ? { ...state.me, totalScore: score.totalScore } : state.me,
      };
    }

    case 'leaderboard_updated': {
      if (isStale(state, payload)) return state;
      const lb = payload as unknown as LeaderboardPayload;
      return {
        ...state,
        version: lb.version,
        status: 'LEADERBOARD',
        leaderboard: lb,
        me:
          state.me && typeof lb.rank === 'number'
            ? { ...state.me, rank: lb.rank, totalScore: lb.totalScore ?? state.me.totalScore }
            : state.me,
      };
    }

    case 'game_finished': {
      if (isStale(state, payload)) return state;
      const final = payload as unknown as FinalPayload;
      return { ...state, version: final.version, status: 'FINISHED', final };
    }

    case 'session_ended': {
      const status = String(data.status ?? '') as LivePhase;
      if (status === 'CANCELLED') return { ...state, status: 'CANCELLED', version: data.version ?? state.version };
      return state;
    }

    default:
      return state;
  }
}

const SERVER_EVENTS = [
  'session_state_sync',
  'lobby_updated',
  'player_joined',
  'player_left',
  'player_reconnected',
  'game_starting',
  'game_started',
  'next_question',
  'question_started',
  'answer_submitted',
  'answer_acknowledged',
  'question_ended',
  'question_result',
  'score_updated',
  'leaderboard_updated',
  'game_finished',
  'session_ended',
  'pause_changed',
  'kicked',
  'player_avatar_updated',
  'reactions_enabled_changed',
  'live_reaction_broadcast',
] as const;

export type HostAction =
  | { type: 'start' }
  | { type: 'next'; version: number }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'lock'; locked: boolean }
  | { type: 'kick'; playerId: string }
  | { type: 'set_reactions'; enabled?: boolean; afterSubmit?: boolean; onProjector?: boolean }
  | { type: 'end' }
  | { type: 'cancel' };

export type AckResult = { ok: boolean; code?: string; message?: string; ignored?: boolean; retryAfterMs?: number };
export type SubmitResult = 'ok' | 'duplicate' | 'late' | 'error';

type Options =
  | { role: 'host'; sessionId: string; onEvent?: (event: string, payload: unknown) => void }
  | { role: 'player'; sessionId: string; playerToken: string; onEvent?: (event: string, payload: unknown) => void };

export function useLiveSession(options: Options) {
  const [state, dispatch] = useReducer(reduce, initialState);
  const socketRef = useRef<Socket | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const onEventRef = useRef(options.onEvent);
  onEventRef.current = options.onEvent;

  const role = options.role;
  const sessionId = options.sessionId;
  const playerToken = options.role === 'player' ? options.playerToken : '';
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let disposed = false;
    let refreshedOnce = false;
    const socket = io(`${API_BASE_ORIGIN}/live`, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
      auth: (cb) =>
        cb(
          role === 'host'
            ? { role: 'host', sessionId, token: authStore.getState().accessToken ?? '' }
            : { role: 'player', sessionId, playerToken },
        ),
    });
    socketRef.current = socket;

    const calibrate = async () => {
      let best: { rtt: number; offset: number } | null = null;
      for (let i = 0; i < 4 && !disposed; i += 1) {
        const t0 = Date.now();
        const response = await new Promise<{ ok?: boolean; serverNow?: number } | null>((resolve) => {
          const timer = setTimeout(() => resolve(null), 2500);
          socket.emit('time_sync', null, (res: { ok?: boolean; serverNow?: number }) => {
            clearTimeout(timer);
            resolve(res);
          });
        });
        const t1 = Date.now();
        if (response?.ok && typeof response.serverNow === 'number') {
          const rtt = t1 - t0;
          const offset = response.serverNow - (t0 + rtt / 2);
          if (!best || rtt < best.rtt) best = { rtt, offset };
        }
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      if (best && !disposed) dispatch({ type: 'offset', offsetMs: best.offset });
    };

    const askSync = () => {
      if (disposed || !socket.connected) return;
      socket.emit('request_sync', null, () => undefined);
    };

    socket.on('connect', () => {
      if (disposed) return;
      dispatch({ type: 'connection', status: 'connected' });
      askSync();
      void calibrate();
    });
    socket.on('disconnect', (reason) => {
      if (disposed) return;
      if (reason === 'io server disconnect') {
        dispatch({ type: 'connection', status: 'denied', reason: 'Koneksi diputus oleh server.' });
      } else {
        dispatch({ type: 'connection', status: 'reconnecting' });
      }
    });
    socket.io.on('reconnect_attempt', () => dispatch({ type: 'connection', status: 'reconnecting' }));
    let failures = 0;
    socket.on('connect_error', (error) => {
      failures += 1;
      const message = error.message;
      if (message === 'unauthorized' && role === 'host' && !refreshedOnce) {
        // Token akses mungkin kedaluwarsa: panggilan REST memicu refresh otomatis lalu coba lagi.
        refreshedOnce = true;
        void liveQuizApi
          .sessionMeta(sessionId)
          .catch(() => undefined)
          .finally(() => {
            if (!disposed) socket.connect();
          });
        return;
      }
      if (!socket.active || failures >= 4) {
        const reasons: Record<string, string> = {
          unauthorized: role === 'host' ? 'Sesi login tidak valid. Silakan login ulang.' : 'Sesi permainan tidak ditemukan atau Anda sudah dikeluarkan.',
          forbidden: 'Anda bukan host sesi ini.',
          session_not_found: 'Sesi tidak ditemukan.',
        };
        dispatch({
          type: 'connection',
          status: 'denied',
          reason: reasons[message] ?? 'Tidak dapat terhubung ke server live quiz. Periksa jaringan lalu coba lagi.',
        });
        return;
      }
      dispatch({ type: 'connection', status: 'reconnecting' });
    });

    const watchdog = window.setInterval(() => {
      if (disposed || stateRef.current.hasSynced) return;
      if (socket.connected) askSync();
    }, 2000);

    SERVER_EVENTS.forEach((event) => {
      socket.on(event, (payload: unknown) => {
        dispatch({ type: 'event', event, payload });
        onEventRef.current?.(event, payload);
      });
    });

    return () => {
      disposed = true;
      window.clearInterval(watchdog);
      socket.removeAllListeners();
      socket.io.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [role, sessionId, playerToken, retryKey]);

  const hostAction = useCallback((action: HostAction): Promise<AckResult> => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) {
      return Promise.resolve({ ok: false, code: 'offline', message: 'Tidak terhubung ke server.' });
    }
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve({ ok: false, code: 'timeout', message: 'Server tidak merespons.' }), 8000);
      socket.emit('host_action', action, (response: AckResult) => {
        clearTimeout(timer);
        resolve(response);
      });
    });
  }, []);

  const submit = useCallback(async (optionIds: string[]): Promise<SubmitResult> => {
    const current = stateRef.current;
    const questionIndex = current.question?.questionIndex;
    const socket = socketRef.current;
    if (questionIndex === undefined || !socket) return 'error';

    const attempt = () =>
      new Promise<{ ok: boolean; code?: string; ack?: { duplicate: boolean } } | null>((resolve) => {
        if (!socket.connected) return resolve(null);
        const timer = setTimeout(() => resolve(null), 6000);
        socket.emit('submit_answer', { questionIndex, optionIds }, (response: { ok: boolean; code?: string; ack?: { duplicate: boolean } }) => {
          clearTimeout(timer);
          resolve(response);
        });
      });

    // Server idempoten: mencoba ulang aman (jawaban final pertama yang dihitung).
    for (let i = 0; i < 4; i += 1) {
      const response = await attempt();
      if (response?.ok) {
        dispatch({ type: 'myAnswer', optionIds });
        return response.ack?.duplicate ? 'duplicate' : 'ok';
      }
      if (response && !response.ok) {
        if (response.code === 'late' || response.code === 'question_closed') return 'late';
        if (response.code !== 'rate_limited') return 'error';
      }
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
    return 'error';
  }, []);

  /** Ganti karakter sendiri di lobby (server menolak di luar lobby / bila host melarang). */
  const setAvatar = useCallback((avatarId: string): Promise<AckResult> => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return Promise.resolve({ ok: false, code: 'offline', message: 'Tidak terhubung ke server.' });
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve({ ok: false, code: 'timeout' }), 6000);
      socket.emit('set_avatar', { avatarId }, (response: AckResult) => {
        clearTimeout(timer);
        resolve(response);
      });
    });
  }, []);

  /** Kirim reaksi emoji (server yang memutuskan fase, cooldown, dan rate limit). */
  const sendReaction = useCallback((emoji: ReactionId): Promise<AckResult> => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return Promise.resolve({ ok: false, code: 'offline', message: 'Tidak terhubung ke server.' });
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve({ ok: false, code: 'timeout' }), 4000);
      socket.emit('player_reaction_sent', { emoji }, (response: AckResult) => {
        clearTimeout(timer);
        resolve(response);
      });
    });
  }, []);

  const requestSync = useCallback(() => {
    socketRef.current?.emit('request_sync', null, () => undefined);
  }, []);

  /** Waktu server saat ini (ms) berdasarkan offset terkalibrasi. */
  const serverNow = useCallback(() => Date.now() + stateRef.current.offsetMs, []);

  const retry = useCallback(() => {
    dispatch({ type: 'connection', status: 'connecting' });
    setRetryKey((key) => key + 1);
  }, []);

  return useMemo(
    () => ({ state, hostAction, submit, requestSync, serverNow, setAvatar, sendReaction, retry }),
    [state, hostAction, submit, requestSync, serverNow, setAvatar, sendReaction, retry],
  );
}
