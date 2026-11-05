/** Aturan hapus yang tidak menyentuh database. Dipakai service dan tes. */

const TERMINAL = new Set(['FINISHED', 'CANCELLED']);

export function isTerminalSessionStatus(status: string) {
  return TERMINAL.has(status);
}

/** Alasan penolakan, atau null bila riwayat sesi ini boleh dihapus. */
export function sessionHistoryDeleteBlock(status: string): string | null {
  if (isTerminalSessionStatus(status)) return null;
  return 'Sesi yang masih berjalan tidak dapat dihapus. Selesaikan atau batalkan sesi terlebih dahulu.';
}

export type QuizDeleteDecision =
  | { ok: true; sessionIds: string[] }
  | { ok: false; status: 409; message: string };

/**
 * Hapus kuis tidak pernah menghapus akun siswa.
 * Sesi berjalan selalu ditolak. Riwayat sesi kuis ini hanya ikut terhapus bila admin mengonfirmasi permanen.
 */
export function decideQuizDelete(
  sessions: Array<{ id: string; status: string }>,
  permanent: boolean,
): QuizDeleteDecision {
  const active = sessions.filter((session) => !isTerminalSessionStatus(session.status));
  if (active.length > 0) {
    return {
      ok: false,
      status: 409,
      message: `Kuis ini masih punya ${active.length} sesi yang berjalan. Selesaikan atau batalkan sesi itu sebelum menghapus kuis.`,
    };
  }
  if (sessions.length > 0 && !permanent) {
    return {
      ok: false,
      status: 409,
      message: `Kuis ini punya ${sessions.length} riwayat sesi. Konfirmasi penghapusan permanen bila riwayat sesi kuis ini juga boleh dihapus. Akun siswa dan kuis lain tidak ikut terhapus.`,
    };
  }
  return { ok: true, sessionIds: sessions.map((session) => session.id) };
}
