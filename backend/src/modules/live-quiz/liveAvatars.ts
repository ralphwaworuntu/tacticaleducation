/**
 * Katalog avatar Live Quiz. Server hanya menyimpan ID (bukan gambar); ilustrasi SVG ada di frontend
 * (frontend/src/features/live-quiz/avatars.tsx). Daftar ID di kedua sisi dijaga sama oleh tes.
 */
export const AVATAR_IDS = [
  'explorer',
  'astronaut',
  'robot',
  'ninja',
  'pilot',
  'scientist',
  'fox',
  'panda',
  'owl',
  'tiger',
  'lion',
  'cat',
  'dragon',
  'gamer',
  'warrior',
  'hero',
] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];

export function isAvatarId(value: unknown): value is AvatarId {
  return typeof value === 'string' && (AVATAR_IDS as readonly string[]).includes(value);
}

/** Hash string sederhana & stabil (FNV-1a) agar avatar default tidak berubah-ubah antar sesi tampil. */
function stableHash(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Avatar default deterministik berdasarkan seed (nama/ID pemain). */
export function defaultAvatarFor(seed: string): AvatarId {
  return AVATAR_IDS[stableHash(seed) % AVATAR_IDS.length]!;
}

/**
 * ID valid dipertahankan; ID kosong/tidak dikenal (termasuk avatar lama yang sudah dihapus dari katalog)
 * diganti avatar default deterministik sehingga UI tidak pernah error.
 */
export function normalizeAvatarId(value: unknown, seed: string): AvatarId {
  return isAvatarId(value) ? value : defaultAvatarFor(seed);
}
