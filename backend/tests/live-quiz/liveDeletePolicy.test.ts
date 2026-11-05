import { describe, expect, it } from 'vitest';
import { decideQuizDelete, sessionHistoryDeleteBlock } from '../../src/modules/live-quiz/liveDeletePolicy';

describe('penghapusan live quiz', () => {
  it('menolak hapus riwayat sesi yang masih berjalan', () => {
    expect(sessionHistoryDeleteBlock('LOBBY')).toMatch(/masih berjalan/);
    expect(sessionHistoryDeleteBlock('QUESTION_ACTIVE')).toMatch(/masih berjalan/);
    expect(sessionHistoryDeleteBlock('FINISHED')).toBeNull();
    expect(sessionHistoryDeleteBlock('CANCELLED')).toBeNull();
  });

  it('menolak hapus kuis bila ada sesi aktif', () => {
    const decision = decideQuizDelete(
      [
        { id: 'done', status: 'FINISHED' },
        { id: 'live', status: 'LOBBY' },
      ],
      true,
    );
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.message).toMatch(/berjalan/);
  });

  it('meminta konfirmasi permanen sebelum riwayat sesi kuis ikut terhapus', () => {
    const decision = decideQuizDelete([{ id: 'done', status: 'FINISHED' }], false);
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.message).toMatch(/permanen/);
  });

  it('mengizinkan hapus kuis beserta riwayat sesinya sendiri setelah konfirmasi', () => {
    const decision = decideQuizDelete(
      [
        { id: 'a', status: 'FINISHED' },
        { id: 'b', status: 'CANCELLED' },
      ],
      true,
    );
    expect(decision).toEqual({ ok: true, sessionIds: ['a', 'b'] });
  });

  it('mengizinkan hapus kuis yang belum pernah dimainkan', () => {
    expect(decideQuizDelete([], false)).toEqual({ ok: true, sessionIds: [] });
  });
});
