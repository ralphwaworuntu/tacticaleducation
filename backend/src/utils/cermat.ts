export type CermatMode = 'NUMBER' | 'LETTER' | 'IMAGE';

export type CermatQuestion = {
  sequence: string[];
  answer: string;
};

/** Seed per attempt — dipakai untuk urutan 10 kolom (satu permutasi, tanpa pengulangan). */
export type CermatAttemptSeed = {
  userId: string;
  attemptId: string;
};

/** Seed unik per akun + attempt + sesi — menjamin layout berbeda antar user dan antar pengerjaan. */
export type CermatSessionSeed = CermatAttemptSeed & {
  sessionIndex: number;
};

function hashSeed(parts: string[]): number {
  const str = parts.join('|');
  let hash = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(parts: string[], salt: string): () => number {
  let state = hashSeed([...parts, salt]);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createAttemptSeededRandom(seed: CermatAttemptSeed, salt: string): () => number {
  return createSeededRandom([seed.userId, seed.attemptId], salt);
}

function createSessionSeededRandom(seed: CermatSessionSeed, salt: string): () => number {
  return createSeededRandom([seed.userId, seed.attemptId, String(seed.sessionIndex)], salt);
}

function shuffleArray<T>(items: T[], random: () => number = Math.random): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const temp = next[i]!;
    next[i] = next[j]!;
    next[j] = temp;
  }
  return next;
}

const LETTERS = Array.from({ length: 26 }, (_, idx) => String.fromCharCode(65 + idx));

/** 10 kolom × 5 ikon — sesuai lembar referensi KOLOM 1–10 */
export const CERMAT_IMAGE_COLUMNS = [
  ['bulu-tangkis', 'bola-voly', 'sarung-tinju', 'bowling', 'sepatu'],
  ['larangan-jalan', 'larangan-merokok', 'larangan-mobil', 'larangan-sampah', 'larangan-kosong'],
  ['emoji-lidah', 'emoji-kacamata', 'emoji-baik', 'emoji-datar', 'emoji-senang'],
  ['apel', 'semangka', 'anggur', 'alpukat', 'pisang'],
  ['pesawat', 'mobil', 'kapal', 'bus', 'kereta-api'],
  ['diagram-batang', 'panah-naik', 'donut-chart', 'diagram-turun', 'garis-naik'],
  ['topi', 'sepatu-olahraga', 'baju', 'tas', 'celana'],
  ['gitar', 'harpa', 'suling', 'drum', 'piano'],
  ['kucing', 'ikan', 'jerapah', 'ayam', 'burung'],
  ['saturnus', 'bulan-sabit', 'bulan-purnama', 'bintang', 'matahari'],
] as const;

export type CermatImageIconKey = (typeof CERMAT_IMAGE_COLUMNS)[number][number];

export const CERMAT_ICON_POOL = CERMAT_IMAGE_COLUMNS.flat();

export type CermatIconKey = CermatImageIconKey;

export function isCermatMode(value: unknown): value is CermatMode {
  return value === 'NUMBER' || value === 'LETTER' || value === 'IMAGE';
}

export function parseCermatMode(value: unknown, fallback: CermatMode = 'NUMBER'): CermatMode {
  return isCermatMode(value) ? value : fallback;
}

/**
 * Satu permutasi 10 kolom per attempt — tiap kolom muncul tepat sekali
 * (sesi 1 → kolom ke-1 dari permutasi, … sesi 10 → kolom ke-10).
 */
export function getImageColumnOrderForAttempt(seed: CermatAttemptSeed): number[] {
  const columnRng = createAttemptSeededRandom(seed, 'column-order');
  return shuffleArray(
    Array.from({ length: CERMAT_IMAGE_COLUMNS.length }, (_, i) => i),
    columnRng,
  );
}

function getImageColumnForSession(sessionIndex: number, seed: CermatSessionSeed): readonly string[] {
  const columnIndices = getImageColumnOrderForAttempt(seed);
  const safeIndex = Math.min(Math.max(sessionIndex, 1), columnIndices.length) - 1;
  const columnIndex = columnIndices[safeIndex] ?? 0;
  return CERMAT_IMAGE_COLUMNS[columnIndex] ?? CERMAT_IMAGE_COLUMNS[0];
}

function generateBaseSet(mode: CermatMode, sessionIndex = 1, seed?: CermatSessionSeed) {
  if (mode === 'LETTER') {
    const rng = seed ? createSessionSeededRandom(seed, 'base-set') : Math.random;
    return shuffleArray(LETTERS, rng).slice(0, 5).sort();
  }
  if (mode === 'IMAGE') {
    const column = seed
      ? getImageColumnForSession(sessionIndex, seed)
      : CERMAT_IMAGE_COLUMNS[Math.min(Math.max(sessionIndex, 1), CERMAT_IMAGE_COLUMNS.length) - 1] ??
        CERMAT_IMAGE_COLUMNS[0];
    const iconRng = seed ? createSessionSeededRandom(seed, 'icon-order') : Math.random;
    return shuffleArray([...column], iconRng);
  }
  const rng = seed ? createSessionSeededRandom(seed, 'base-set') : Math.random;
  const digits = shuffleArray(Array.from({ length: 10 }, (_, idx) => idx.toString()), rng);
  return digits.slice(0, 5).sort((a, b) => Number(a) - Number(b));
}

export function generateSessionSet(
  totalQuestions: number,
  mode: CermatMode,
  sessionIndex = 1,
  seed?: CermatSessionSeed,
) {
  const baseSet = generateBaseSet(mode, sessionIndex, seed);
  const questions: CermatQuestion[] = Array.from({ length: totalQuestions }, (_, qIndex) => {
    const qRng = seed ? createSessionSeededRandom(seed, `question-${qIndex}`) : Math.random;
    const missing = baseSet[Math.floor(qRng() * baseSet.length)]!;
    const promptTokens = shuffleArray(
      baseSet.filter((token) => token !== missing),
      qRng,
    );
    return { sequence: promptTokens, answer: missing } satisfies CermatQuestion;
  });

  // Gambar Hilang: acak urutan soal agar tidak berurutan/predictable tiap attempt.
  const orderRng = seed ? createSessionSeededRandom(seed, 'question-order') : Math.random;
  const orderedQuestions = mode === 'IMAGE' ? shuffleArray(questions, orderRng) : questions;

  return { baseSet, questions: orderedQuestions };
}
