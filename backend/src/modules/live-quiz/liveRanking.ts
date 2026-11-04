export type RankablePlayer = {
  id: string;
  totalScore: number;
  correctCount: number;
  /** Total waktu respons pada jawaban BENAR (ms). Lebih kecil = lebih baik. */
  correctTimeMs: number;
};

export type RankedPlayer<T extends RankablePlayer> = T & {
  /** Rank kompetisi (1,2,2,4): pemain seri pada ketiga kriteria berbagi rank sama. */
  rank: number;
  /** Urutan tampil deterministik (1..N), unik per pemain. */
  displayOrder: number;
};

/**
 * Tie-breaker default Tactical Live Quiz:
 * 1. Total poin tertinggi.
 * 2. Jumlah jawaban benar terbanyak.
 * 3. Total waktu jawaban benar terendah.
 * 4. ID pemain (stabil) agar urutan tampil deterministik.
 */
export function comparePlayers(a: RankablePlayer, b: RankablePlayer): number {
  if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
  if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
  if (a.correctTimeMs !== b.correctTimeMs) return a.correctTimeMs - b.correctTimeMs;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function sameStanding(a: RankablePlayer, b: RankablePlayer): boolean {
  return (
    a.totalScore === b.totalScore && a.correctCount === b.correctCount && a.correctTimeMs === b.correctTimeMs
  );
}

export function rankPlayers<T extends RankablePlayer>(players: readonly T[]): Array<RankedPlayer<T>> {
  const sorted = [...players].sort(comparePlayers);
  const ranked: Array<RankedPlayer<T>> = [];
  sorted.forEach((player, index) => {
    const previous = ranked[index - 1];
    const rank = previous && sameStanding(previous, player) ? previous.rank : index + 1;
    ranked.push({ ...player, rank, displayOrder: index + 1 });
  });
  return ranked;
}
