import crypto from 'crypto';

export const MAX_PLAYER_NAME_LENGTH = 20;
export const MIN_PLAYER_NAME_LENGTH = 1;

/**
 * Sanitasi nama panggilan: normalisasi Unicode, buang karakter kontrol dan karakter
 * yang berbahaya untuk HTML (< > & " ` \), rapikan spasi, batasi panjang.
 * Rendering di frontend tetap memakai teks biasa (React escape), ini lapisan tambahan.
 */
export function sanitizePlayerName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff]/g, '')
    .replace(/[<>&"'`\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_PLAYER_NAME_LENGTH)
    .trim();
}

/** Kunci keunikan nama per sesi (tidak peka huruf besar/kecil). */
export function playerNameKey(name: string): string {
  return name.normalize('NFKC').toLocaleLowerCase('id-ID');
}

export function generatePlayerToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashPlayerToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** PIN 6 digit aman secara kriptografis (tanpa awalan nol agar mudah diketik). */
export function generatePin(): string {
  return String(crypto.randomInt(100000, 1000000));
}

/** Fisher-Yates dengan sumber acak kriptografis. */
export function shuffled<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [copy[i], copy[j]] = [copy[j] as T, copy[i] as T];
  }
  return copy;
}

/** Cegah CSV/Excel formula injection pada sel ekspor. */
export function csvSafeCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}
