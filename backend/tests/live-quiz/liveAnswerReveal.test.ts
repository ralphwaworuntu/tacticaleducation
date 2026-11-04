/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../src/config/prisma';
import {
  buildAnswerReveal,
  compareReveal,
  type AnswerRevealRow,
  type RevealAnswer,
  type RevealPlayer,
} from '../../src/modules/live-quiz/liveAnswerReveal';
import {
  TestClient,
  cleanupLiveData,
  createApi,
  createUserWithToken,
  deleteTestUsers,
  sleep,
  startHarness,
} from './helpers/harness';

const OPTS = ['o-a', 'o-b', 'o-c', 'o-d'];
const p = (id: string, name: string, avatarId = 'fox'): RevealPlayer => ({ id, name, avatarId });
const ans = (optionIds: string[], isCorrect: boolean, score: number, responseMs: number): RevealAnswer => ({
  optionIds,
  isCorrect,
  score,
  responseMs,
});

describe('Detail Jawaban Siswa: pengurutan (unit)', () => {
  it('mengurutkan berdasarkan poin soal ini dari tertinggi ke terendah', () => {
    const rows = buildAnswerReveal(
      [p('1', 'Ani'), p('2', 'Budi'), p('3', 'Cici')],
      new Map([
        ['1', ans(['o-a'], true, 500, 4000)],
        ['2', ans(['o-a'], true, 950, 1000)],
        ['3', ans(['o-a'], true, 720, 2500)],
      ]),
      OPTS,
    );
    expect(rows.map((r) => r.name)).toEqual(['Budi', 'Cici', 'Ani']);
    expect(rows.map((r) => r.earned)).toEqual([950, 720, 500]);
  });

  it('poin sama -> waktu tercepat; waktu sama -> nama A-Z; nama sama -> ID peserta', () => {
    const rows = buildAnswerReveal(
      [p('z9', 'Rina'), p('a1', 'Rina'), p('b2', 'budi'), p('c3', 'Agus'), p('d4', 'Cahya'), p('e5', 'Dewi')],
      new Map([
        ['z9', ans(['o-a'], true, 800, 2000)], // sama persis dengan a1 (nama & waktu) -> ID
        ['a1', ans(['o-a'], true, 800, 2000)],
        ['b2', ans(['o-a'], true, 800, 2000)], // nama "budi" (huruf kecil) tetap diurut alfabet
        ['c3', ans(['o-a'], true, 800, 1500)], // lebih cepat -> paling atas di antara poin 800
        ['d4', ans(['o-a'], true, 900, 3000)], // poin lebih tinggi menang walau lebih lambat
      ]),
      OPTS,
    );
    expect(rows.map((r) => `${r.name}:${r.playerId}`)).toEqual([
      'Cahya:d4', // 900
      'Agus:c3', // 800 @1500
      'budi:b2', // 800 @2000, nama B
      'Rina:a1', // 800 @2000, nama R, ID a1
      'Rina:z9', // ... ID z9
      'Dewi:e5', // tidak menjawab (0) di akhir
    ]);
  });

  it('salah & tidak menjawab tetap tampil dengan poin 0; yang menjawab (salah) mendahului yang tidak menjawab bila poin sama', () => {
    const rows = buildAnswerReveal(
      [p('1', 'Ani'), p('2', 'Budi'), p('3', 'Cici'), p('4', 'Dodi')],
      new Map([
        ['1', ans(['o-b'], false, 0, 9000)],
        ['3', ans(['o-c'], true, 300, 8000)],
        ['4', ans(['o-a'], false, 0, 1200)],
      ]),
      OPTS,
    );
    expect(rows.map((r) => [r.name, r.status, r.earned])).toEqual([
      ['Cici', 'CORRECT', 300],
      ['Dodi', 'WRONG', 0], // waktu 1200 < 9000
      ['Ani', 'WRONG', 0],
      ['Budi', 'NONE', 0], // tidak menjawab: waktu dianggap tak terhingga
    ]);
    expect(rows[3]).toMatchObject({ selectedOptionIds: [], selectedLetters: [], responseMs: null });
  });

  it('huruf opsi mengikuti urutan opsi; jawaban ganda menampilkan semua huruf terpilih secara berurutan', () => {
    const rows = buildAnswerReveal(
      [p('1', 'Ani'), p('2', 'Budi')],
      new Map([
        ['1', ans(['o-d', 'o-b'], false, 0, 100)],
        ['2', ans(['o-c'], true, 100, 200)],
      ]),
      OPTS,
    );
    const ani = rows.find((r) => r.name === 'Ani')!;
    const budi = rows.find((r) => r.name === 'Budi')!;
    expect(ani.selectedLetters).toEqual(['B', 'D']);
    expect(ani.selectedOptionIds).toEqual(['o-d', 'o-b']); // data asli tidak diubah
    expect(budi.selectedLetters).toEqual(['C']);
  });

  it('setelah disaring (mis. hanya Salah) urutan tetap poin soal ini tertinggi dulu', () => {
    const rows = buildAnswerReveal(
      [p('1', 'Ani'), p('2', 'Budi'), p('3', 'Cici'), p('4', 'Dodi')],
      new Map([
        ['1', ans(['o-a'], true, 900, 1000)],
        ['2', ans(['o-b'], false, 0, 8000)],
        ['3', ans(['o-c'], false, 0, 2000)],
        ['4', ans(['o-a'], true, 400, 5000)],
      ]),
      OPTS,
    );
    const wrong = rows.filter((r) => r.status === 'WRONG');
    expect(wrong.map((r) => r.name)).toEqual(['Cici', 'Budi']); // waktu 2000 lalu 8000, poin sama 0
    expect(wrong.every((r) => r.earned === 0)).toBe(true);
  });

  it('deterministik: urutan input berbeda menghasilkan urutan identik, dan comparator stabil', () => {
    const players = Array.from({ length: 30 }, (_, i) => p(`id${i}`, `Nama ${i % 6}`));
    const answers = new Map<string, RevealAnswer>(
      players.map((pl, i) => [pl.id, ans(['o-a'], i % 3 === 0, (i % 3 === 0 ? 100 : 0) * (i % 4), 1000 + (i % 5) * 100)]),
    );
    const first = buildAnswerReveal(players, answers, OPTS).map((r) => r.playerId);
    const second = buildAnswerReveal([...players].reverse(), answers, OPTS).map((r) => r.playerId);
    expect(second).toEqual(first);
    const sample = buildAnswerReveal(players, answers, OPTS);
    for (let i = 1; i < sample.length; i += 1) {
      expect(compareReveal(sample[i - 1] as AnswerRevealRow, sample[i] as AnswerRevealRow)).toBeLessThanOrEqual(0);
    }
  });
});

/* ---------------------------------------------------------------------- */
/* Integrasi: payload score_updated host berasal dari data server asli       */
/* ---------------------------------------------------------------------- */

const FAST = {
  countdownSec: 1,
  timeLimitSec: 5,
  resultDurationSec: 1,
  scoreDurationSec: 2,
  leaderboardDurationSec: 1,
  advanceMode: 'MANUAL',
};

let harness: Awaited<ReturnType<typeof startHarness>>;
let adminToken = '';
const openClients: TestClient[] = [];
const track = <T extends TestClient>(client: T) => {
  openClients.push(client);
  return client;
};

beforeAll(async () => {
  await cleanupLiveData();
  await deleteTestUsers();
  harness = await startHarness();
  adminToken = (await createUserWithToken('ADMIN', 'reveal-admin')).token;
});

afterAll(async () => {
  openClients.forEach((c) => c.close());
  await sleep(100);
  await cleanupLiveData();
  await deleteTestUsers();
  await harness.close();
  await prisma.$disconnect();
});

describe('Detail Jawaban Siswa (socket)', () => {
  it('host menerima semua siswa terurut poin tertinggi; pilihan & status sesuai jawaban tersimpan; hanya host; leaderboard tetap total poin', async () => {
    const api = createApi(harness.base, adminToken);
    const quiz = await api('POST', '/admin/live-quiz/quizzes', {
      title: `Kuis Reveal ${Date.now()}`,
      subject: 'Uji',
      questions: [
        {
          type: 'SINGLE',
          prompt: 'Berapa 2 + 2?',
          options: [
            { label: '3', isCorrect: false },
            { label: '4', isCorrect: true },
            { label: '5', isCorrect: false },
            { label: '6', isCorrect: false },
          ],
        },
      ],
    });
    expect(quiz.status).toBe(201);
    const created = await api('POST', '/admin/live-quiz/sessions', { quizId: quiz.json.data.id, settings: { ...FAST, autoCloseWhenAllAnswered: false } });
    expect(created.status).toBe(201);
    const session = created.json.data as { id: string; pin: string };

    const anon = createApi(harness.base);
    const join = async (name: string, avatarId: string) => {
      const res = await anon('POST', '/live/join', { pin: session.pin, name, avatarId });
      expect(res.status).toBe(200);
      return res.json.data as { playerId: string; playerToken: string };
    };
    const fast = await join('Cepat', 'ninja');
    const slow = await join('Lambat', 'owl');
    const wrong = await join('Salah', 'cat');
    const silent = await join('Diam', 'lion');

    const host = track(new TestClient(harness.base, { role: 'host', sessionId: session.id, token: adminToken }));
    await host.connect();
    await host.waitFor('session_state_sync');
    const connect = async (token: string) => {
      const c = track(new TestClient(harness.base, { role: 'player', sessionId: session.id, playerToken: token }));
      await c.connect();
      await c.waitFor('session_state_sync');
      return c;
    };
    const pFast = await connect(fast.playerToken);
    const pSlow = await connect(slow.playerToken);
    const pWrong = await connect(wrong.playerToken);
    const pSilent = await connect(silent.playerToken);

    await host.emitAck('host_action', { type: 'start' });
    const questions = await Promise.all([pFast, pSlow, pWrong, pSilent].map((c) => c.waitFor('question_started')));
    const opt = (q: any, label: string) => q.question.options.find((o: any) => o.label === label).id;
    const q0 = questions[0];

    expect((await pFast.emitAck('submit_answer', { questionIndex: 0, optionIds: [opt(q0, '4')] })).ok).toBe(true);
    await sleep(600);
    expect((await pSlow.emitAck('submit_answer', { questionIndex: 0, optionIds: [opt(q0, '4')] })).ok).toBe(true);
    expect((await pWrong.emitAck('submit_answer', { questionIndex: 0, optionIds: [opt(q0, '6')] })).ok).toBe(true);
    // pSilent tidak menjawab.

    const scorePlayerFast = pFast.waitFor('score_updated');
    const score = await host.waitFor('score_updated');
    const mine = await scorePlayerFast;

    // Host: seluruh peserta aktif, terurut poin soal ini (desc).
    expect(score.answers).toHaveLength(4);
    expect(score.answers.map((r: any) => r.name)).toEqual(['Cepat', 'Lambat', 'Salah', 'Diam']);
    const [r1, r2, r3, r4] = score.answers;
    expect(r1).toMatchObject({ status: 'CORRECT', selectedLetters: ['B'], avatarId: 'ninja', playerId: fast.playerId });
    expect(r2).toMatchObject({ status: 'CORRECT', selectedLetters: ['B'], playerId: slow.playerId });
    expect(r1.earned).toBeGreaterThan(r2.earned); // lebih cepat -> poin lebih besar (rumus server tidak diubah)
    expect(r3).toMatchObject({ status: 'WRONG', selectedLetters: ['D'], earned: 0, playerId: wrong.playerId });
    expect(r4).toMatchObject({ status: 'NONE', selectedLetters: [], selectedOptionIds: [], earned: 0, responseMs: null });

    // Poin per baris = poin yang dicatat server di DB (bukan dihitung ulang).
    const dbAnswers = await prisma.liveAnswer.findMany({ where: { sessionId: session.id } });
    for (const row of [r1, r2, r3]) {
      const stored = dbAnswers.find((a) => a.playerId === row.playerId);
      expect(stored?.scoreEarned).toBe(row.earned);
      expect(stored?.selectedOptionIds).toEqual(row.selectedOptionIds);
    }
    // Pemain hanya menerima data dirinya: tidak ada daftar jawaban teman.
    expect(JSON.stringify(mine)).not.toMatch(/answers|Lambat|Salah|Diam/);

    // Leaderboard utama tetap berdasarkan TOTAL poin & tidak berubah bentuknya.
    const lb = await host.waitFor('leaderboard_updated');
    expect(lb.entries[0]).toMatchObject({ name: 'Cepat', rank: 1, totalScore: r1.earned });
    expect(lb.entries[1]).toMatchObject({ name: 'Lambat', rank: 2, totalScore: r2.earned });
    expect(lb.entries.every((e: any) => !('answers' in e) && !('selectedLetters' in e))).toBe(true);
  });
});
