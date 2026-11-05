import { describe, expect, it } from 'vitest';
import { rankPlayers } from '../../src/modules/live-quiz/liveRanking';
import {
  csvSafeCell,
  generatePin,
  hashPlayerToken,
  playerNameKey,
  safeEqualHex,
  sanitizePlayerName,
  shuffled,
} from '../../src/modules/live-quiz/liveText';
import { resolveQuizSettings } from '../../src/modules/live-quiz/live.settings';

const p = (id: string, totalScore: number, correctCount: number, correctTimeMs: number) => ({
  id,
  totalScore,
  correctCount,
  correctTimeMs,
});

describe('rankPlayers - tie-breaker', () => {
  it('urut berdasarkan total poin', () => {
    const ranked = rankPlayers([p('a', 100, 1, 1000), p('b', 300, 1, 1000), p('c', 200, 1, 1000)]);
    expect(ranked.map((r) => r.id)).toEqual(['b', 'c', 'a']);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it('poin sama: jawaban benar terbanyak menang', () => {
    const ranked = rankPlayers([p('a', 500, 2, 1000), p('b', 500, 3, 9000)]);
    expect(ranked.map((r) => r.id)).toEqual(['b', 'a']);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2]);
  });

  it('poin dan benar sama: total waktu benar terendah menang', () => {
    const ranked = rankPlayers([p('a', 500, 3, 9000), p('b', 500, 3, 4000)]);
    expect(ranked.map((r) => r.id)).toEqual(['b', 'a']);
    expect(ranked.map((r) => r.rank)).toEqual([1, 2]);
  });

  it('seri penuh: rank kompetisi sama, urutan tampil deterministik oleh id', () => {
    const ranked = rankPlayers([p('z', 500, 3, 4000), p('a', 500, 3, 4000), p('m', 100, 1, 1000)]);
    expect(ranked.map((r) => r.id)).toEqual(['a', 'z', 'm']);
    expect(ranked.map((r) => r.rank)).toEqual([1, 1, 3]);
    expect(ranked.map((r) => r.displayOrder)).toEqual([1, 2, 3]);
  });

  it('hasil sama untuk urutan input berbeda (deterministik)', () => {
    const input = [p('c', 5, 1, 10), p('a', 5, 1, 10), p('b', 5, 1, 10)];
    const one = rankPlayers(input).map((r) => r.id);
    const two = rankPlayers([...input].reverse()).map((r) => r.id);
    expect(one).toEqual(two);
  });

  it('tidak memutasi array input', () => {
    const input = [p('a', 1, 1, 1), p('b', 2, 1, 1)];
    rankPlayers(input);
    expect(input.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('peserta kurang dari tiga tetap menghasilkan ranking valid', () => {
    expect(rankPlayers([])).toEqual([]);
    expect(rankPlayers([p('a', 1, 1, 1)]).map((r) => r.rank)).toEqual([1]);
    expect(rankPlayers([p('a', 1, 1, 1), p('b', 2, 1, 1)]).map((r) => r.id)).toEqual(['b', 'a']);
  });
});

describe('sanitizePlayerName', () => {
  it('trim dan rapikan spasi', () => {
    expect(sanitizePlayerName('  Almend   Putra  ')).toBe('Almend Putra');
  });

  it('membuang karakter berbahaya dan kontrol', () => {
    expect(sanitizePlayerName('<b>hi</b>')).toBe('bhi/b');
    expect(sanitizePlayerName('<script>alert(1)</script>')).toBe('scriptalert(1)/scrip');
    expect(sanitizePlayerName('A\u0000B\u202eC')).toBe('ABC');
    expect(sanitizePlayerName('x"y\'z`')).toBe('xyz');
  });

  it('membatasi panjang 20 karakter', () => {
    expect(sanitizePlayerName('a'.repeat(50))).toHaveLength(20);
  });

  it('kosong setelah trim atau bukan string => string kosong', () => {
    expect(sanitizePlayerName('    ')).toBe('');
    expect(sanitizePlayerName('<>')).toBe('');
    expect(sanitizePlayerName(null)).toBe('');
    expect(sanitizePlayerName(123)).toBe('');
  });

  it('nameKey tidak peka huruf besar/kecil', () => {
    expect(playerNameKey('ALMEND')).toBe(playerNameKey('almend'));
  });
});

describe('util keamanan', () => {
  it('PIN 6 digit', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generatePin()).toMatch(/^[1-9]\d{5}$/);
    }
  });

  it('hash token deterministik dan perbandingan konstan', () => {
    const hash = hashPlayerToken('abc');
    expect(hash).toBe(hashPlayerToken('abc'));
    expect(safeEqualHex(hash, hashPlayerToken('abc'))).toBe(true);
    expect(safeEqualHex(hash, hashPlayerToken('abd'))).toBe(false);
    expect(safeEqualHex(hash, 'zz')).toBe(false);
  });

  it('shuffle mempertahankan elemen', () => {
    const input = [1, 2, 3, 4, 5, 6];
    const out = shuffled(input);
    expect([...out].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('CSV mencegah formula injection dan meng-escape koma/kutip', () => {
    expect(csvSafeCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvSafeCell('+1')).toBe("'+1");
    expect(csvSafeCell('a,b')).toBe('"a,b"');
    expect(csvSafeCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvSafeCell(null)).toBe('');
    expect(csvSafeCell(42)).toBe('42');
  });
});

describe('resolveQuizSettings', () => {
  it('default sesuai spesifikasi', () => {
    const s = resolveQuizSettings();
    expect(s.timeLimitSec).toBe(30);
    expect(s.scoreMode).toBe('SPEED');
    expect(s.advanceMode).toBe('MANUAL');
    expect(s.showCorrectAnswer).toBe(true);
    expect(s.showLeaderboard).toBe(true);
    expect(s.countdownSec).toBe(3);
  });

  it('override valid diterapkan, nilai tak valid kembali ke default', () => {
    const s = resolveQuizSettings({ timeLimitSec: 60, scoreMode: 'ACCURACY' }, { timeLimitSec: 7, countdownSec: 5 });
    expect(s.timeLimitSec).toBe(30);
    expect(s.scoreMode).toBe('ACCURACY');
    expect(s.countdownSec).toBe(5);
  });

  it('input bukan objek tidak merusak', () => {
    expect(resolveQuizSettings(null, 'x', undefined, [1]).timeLimitSec).toBe(30);
  });
});
