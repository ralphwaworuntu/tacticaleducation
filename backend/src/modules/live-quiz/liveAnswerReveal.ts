/**
 * Detail Jawaban Siswa (layar tutor, setelah soal ditutup).
 *
 * Modul murni: hanya MENYUSUN ulang data yang sudah dihitung server (jawaban tersimpan + poin per soal).
 * Tidak menghitung poin, tidak menyentuh ranking utama (leaderboard/podium tetap memakai total poin).
 */

export type RevealStatus = 'CORRECT' | 'WRONG' | 'NONE';

export type AnswerRevealRow = {
  playerId: string;
  name: string;
  avatarId: string;
  status: RevealStatus;
  /** ID opsi yang benar-benar dipilih siswa (sesuai yang tersimpan). */
  selectedOptionIds: string[];
  /** Huruf opsi (A, B, C, ...) menurut urutan opsi yang tampil di layar tutor. */
  selectedLetters: string[];
  /** Poin SOAL INI (0 untuk salah / tidak menjawab). */
  earned: number;
  /** Waktu menjawab (ms sejak soal dibuka); null bila tidak menjawab. */
  responseMs: number | null;
};

export type RevealPlayer = { id: string; name: string; avatarId: string };
export type RevealAnswer = { optionIds: string[]; isCorrect: boolean; score: number; responseMs: number };

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Aturan urut: poin soal ini ↓, waktu menjawab tercepat ↑, nama A–Z, terakhir ID peserta. */
export function compareReveal(a: AnswerRevealRow, b: AnswerRevealRow): number {
  if (a.earned !== b.earned) return b.earned - a.earned;
  const ta = a.responseMs ?? Number.POSITIVE_INFINITY;
  const tb = b.responseMs ?? Number.POSITIVE_INFINITY;
  if (ta !== tb) return ta < tb ? -1 : 1;
  const byName = a.name.localeCompare(b.name, 'id', { sensitivity: 'base' });
  if (byName !== 0) return byName;
  // Pembeda terakhir yang deterministik (bukan locale).
  return a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0;
}

/**
 * @param players  peserta aktif (tidak dikeluarkan) -- yang tidak punya jawaban tampil sebagai "Tidak menjawab".
 * @param answers  jawaban soal ini per playerId (data asli server).
 * @param optionIds urutan ID opsi soal (urutan sama dengan kartu jawaban di layar tutor).
 */
export function buildAnswerReveal(
  players: Iterable<RevealPlayer>,
  answers: ReadonlyMap<string, RevealAnswer>,
  optionIds: readonly string[],
): AnswerRevealRow[] {
  const letterOf = new Map(optionIds.map((id, index) => [id, LETTERS[index] ?? String(index + 1)]));
  const rows: AnswerRevealRow[] = [];
  for (const player of players) {
    const answer = answers.get(player.id);
    if (!answer) {
      rows.push({
        playerId: player.id,
        name: player.name,
        avatarId: player.avatarId,
        status: 'NONE',
        selectedOptionIds: [],
        selectedLetters: [],
        earned: 0,
        responseMs: null,
      });
      continue;
    }
    const selected = [...answer.optionIds];
    rows.push({
      playerId: player.id,
      name: player.name,
      avatarId: player.avatarId,
      status: answer.isCorrect ? 'CORRECT' : 'WRONG',
      selectedOptionIds: selected,
      selectedLetters: selected
        .map((id) => letterOf.get(id))
        .filter((letter): letter is string => Boolean(letter))
        .sort(),
      earned: answer.score,
      responseMs: answer.responseMs,
    });
  }
  return rows.sort(compareReveal);
}
