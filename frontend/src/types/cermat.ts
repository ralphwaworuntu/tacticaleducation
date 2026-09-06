export type CermatMode = 'NUMBER' | 'LETTER' | 'IMAGE';

export type CermatConfig = {
  questionCount: number;
  durationSeconds: number;
  totalSessions: number;
  breakSeconds: number;
};

export const DEFAULT_CERMAT_CONFIG: CermatConfig = {
  questionCount: 60,
  durationSeconds: 60,
  totalSessions: 10,
  breakSeconds: 5,
};

export function formatCermatConfigSummary(config: CermatConfig): string {
  return `${config.totalSessions} sesi · ${config.questionCount} soal · ${config.durationSeconds} detik · jeda ${config.breakSeconds} detik`;
}

export const CERMAT_MODE_LABELS: Record<CermatMode, string> = {
  NUMBER: 'Angka Hilang',
  LETTER: 'Huruf Hilang',
  IMAGE: 'Gambar Hilang',
};
