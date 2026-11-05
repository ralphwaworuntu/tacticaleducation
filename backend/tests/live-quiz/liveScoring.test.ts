import { describe, expect, it } from 'vitest';
import {
  computeAccuracy,
  computeScore,
  isAnswerCorrect,
  maxPointsForWeight,
} from '../../src/modules/live-quiz/liveScoring';

const base = { mode: 'SPEED' as const, isCorrect: true, timeLimitSec: 30, maxPoints: 1000 };
const score = (responseMs: number, overrides: Partial<Parameters<typeof computeScore>[0]> = {}) =>
  computeScore({ ...base, responseMs, ...overrides });

describe('computeScore - speed mode (T = 30s)', () => {
  it('memberi poin penuh untuk jawaban benar tercepat (< 0.5 detik)', () => {
    expect(score(0)).toBe(1000);
    expect(score(300)).toBe(1000);
    expect(score(499)).toBe(1000);
  });

  it('mengikuti tabel contoh dari spesifikasi', () => {
    const table: Array<[number, number]> = [
      [0.3, 1000],
      [1, 983],
      [2, 967],
      [5, 917],
      [10, 833],
      [15, 750],
      [20, 667],
      [25, 583],
      [29, 517],
    ];
    for (const [seconds, expected] of table) {
      expect(score(seconds * 1000), `${seconds}s`).toBe(expected);
    }
  });

  it('jawaban benar lambat tetap mendapat poin di atas separuh', () => {
    expect(score(29_900)).toBeGreaterThan(500);
    expect(score(30_000)).toBe(500);
  });

  it('batas 0.5 detik tepat sudah memakai rumus (bukan poin penuh)', () => {
    expect(score(500)).toBe(Math.round(1000 * (1 - 0.5 / 60)));
  });

  it('jawaban salah = 0', () => {
    expect(score(1000, { isCorrect: false })).toBe(0);
  });

  it('timeout / jawaban lewat deadline = 0', () => {
    expect(score(30_001)).toBe(0);
    expect(score(45_000)).toBe(0);
  });

  it('pembulatan memakai Math.round (966.67 -> 967, 833.33 -> 833)', () => {
    expect(score(2000)).toBe(967);
    expect(score(10_000)).toBe(833);
  });

  it('menolak durasi tak valid', () => {
    expect(score(-1)).toBe(0);
    expect(score(Number.NaN)).toBe(0);
  });

  it('hasil selalu di antara 0 dan maxPoints', () => {
    for (let ms = 0; ms <= 30_000; ms += 137) {
      const value = score(ms);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1000);
    }
  });

  it('batas waktu berbeda menghasilkan skala berbeda', () => {
    expect(score(5000, { timeLimitSec: 10 })).toBe(750);
    expect(score(60_000, { timeLimitSec: 120 })).toBe(750);
  });
});

describe('computeScore - bobot soal', () => {
  it('double points: maksimum 2000 dan skala mengikuti', () => {
    const max = maxPointsForWeight('DOUBLE');
    expect(max).toBe(2000);
    expect(score(100, { maxPoints: max })).toBe(2000);
    expect(score(2000, { maxPoints: max })).toBe(1933);
  });

  it('no points: selalu 0 walau benar', () => {
    const max = maxPointsForWeight('NONE');
    expect(max).toBe(0);
    expect(score(100, { maxPoints: max })).toBe(0);
  });

  it('normal memakai base kustom', () => {
    expect(maxPointsForWeight('NORMAL', 500)).toBe(500);
    expect(maxPointsForWeight('DOUBLE', 500)).toBe(1000);
  });
});

describe('computeScore - accuracy mode', () => {
  it('benar = poin penuh berapapun kecepatannya (selama sebelum deadline)', () => {
    expect(score(100, { mode: 'ACCURACY' })).toBe(1000);
    expect(score(29_000, { mode: 'ACCURACY' })).toBe(1000);
  });

  it('salah = 0 dan terlambat = 0', () => {
    expect(score(100, { mode: 'ACCURACY', isCorrect: false })).toBe(0);
    expect(score(31_000, { mode: 'ACCURACY' })).toBe(0);
  });

  it('double points pada accuracy = 2000', () => {
    expect(score(5000, { mode: 'ACCURACY', maxPoints: 2000 })).toBe(2000);
  });
});

describe('isAnswerCorrect', () => {
  it('single choice: tepat satu pilihan yang benar', () => {
    expect(isAnswerCorrect('SINGLE', ['b'], ['b'])).toBe(true);
    expect(isAnswerCorrect('SINGLE', ['a'], ['b'])).toBe(false);
  });

  it('single choice menolak lebih dari satu pilihan', () => {
    expect(isAnswerCorrect('SINGLE', ['a', 'b'], ['b'])).toBe(false);
  });

  it('true/false diperlakukan seperti single', () => {
    expect(isAnswerCorrect('TRUE_FALSE', ['t'], ['t'])).toBe(true);
    expect(isAnswerCorrect('TRUE_FALSE', ['f'], ['t'])).toBe(false);
  });

  it('multiple select: harus cocok persis', () => {
    expect(isAnswerCorrect('MULTIPLE', ['a', 'c'], ['a', 'c'])).toBe(true);
    expect(isAnswerCorrect('MULTIPLE', ['c', 'a'], ['a', 'c'])).toBe(true);
  });

  it('multiple select: ada pilihan salah => salah', () => {
    expect(isAnswerCorrect('MULTIPLE', ['a', 'b', 'c'], ['a', 'c'])).toBe(false);
    expect(isAnswerCorrect('MULTIPLE', ['a', 'b'], ['a', 'c'])).toBe(false);
  });

  it('multiple select: pilihan benar terlewat => salah', () => {
    expect(isAnswerCorrect('MULTIPLE', ['a'], ['a', 'c'])).toBe(false);
  });

  it('pilihan kosong atau kunci kosong => salah', () => {
    expect(isAnswerCorrect('SINGLE', [], ['a'])).toBe(false);
    expect(isAnswerCorrect('MULTIPLE', ['a'], [])).toBe(false);
  });

  it('pilihan duplikat tidak menggandakan jawaban', () => {
    expect(isAnswerCorrect('MULTIPLE', ['a', 'a'], ['a', 'c'])).toBe(false);
    expect(isAnswerCorrect('SINGLE', ['a', 'a'], ['a'])).toBe(true);
  });
});

describe('computeAccuracy', () => {
  it('menghitung persentase benar / total soal', () => {
    expect(computeAccuracy(21, 25)).toBe(84);
    expect(computeAccuracy(0, 25)).toBe(0);
    expect(computeAccuracy(25, 25)).toBe(100);
  });

  it('total soal 0 tidak membagi nol', () => {
    expect(computeAccuracy(0, 0)).toBe(0);
  });
});
