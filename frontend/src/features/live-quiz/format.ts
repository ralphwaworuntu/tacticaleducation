import type { LivePhase } from './types';

const PHASE_LABELS: Record<LivePhase, string> = {
  DRAFT: 'Draft',
  LOBBY: 'Lobby',
  COUNTDOWN: 'Hitung mundur',
  QUESTION_ACTIVE: 'Soal berjalan',
  QUESTION_RESULT: 'Hasil soal',
  SCORE_RESULT: 'Poin',
  LEADERBOARD: 'Leaderboard',
  FINISHED: 'Selesai',
  CANCELLED: 'Dibatalkan',
};

export const phaseLabel = (status: LivePhase) => PHASE_LABELS[status] ?? status;

export const isActivePhase = (status: LivePhase) => status !== 'FINISHED' && status !== 'CANCELLED';

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '-';
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

export const formatPoints = (value: number) => value.toLocaleString('id-ID');

export const formatSeconds = (ms: number | null) => (ms === null ? '-' : `${(ms / 1000).toFixed(1)} dtk`);

/** Format PIN 6 digit menjadi "123 456" agar mudah dibaca dari jauh. */
export const formatPin = (pin: string) => (pin.length === 6 ? `${pin.slice(0, 3)} ${pin.slice(3)}` : pin);
