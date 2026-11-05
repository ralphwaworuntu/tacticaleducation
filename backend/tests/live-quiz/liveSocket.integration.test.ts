/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../src/config/prisma';
import { LiveEngine, liveEngine } from '../../src/modules/live-quiz/liveEngine';
import {
  TestClient,
  cleanupLiveData,
  createApi,
  createUserWithToken,
  deleteTestUsers,
  sleep,
  startHarness,
} from './helpers/harness';

const FAST = {
  countdownSec: 1,
  timeLimitSec: 5,
  resultDurationSec: 1,
  scoreDurationSec: 1,
  leaderboardDurationSec: 1,
  advanceMode: 'MANUAL',
};

const quizBody = (title: string) => ({
  title,
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
    {
      type: 'TRUE_FALSE',
      prompt: 'Matahari terbit dari timur.',
      options: [
        { label: 'Benar', isCorrect: true },
        { label: 'Salah', isCorrect: false },
      ],
    },
    {
      type: 'MULTIPLE',
      prompt: 'Pilih bilangan genap.',
      options: [
        { label: '2', isCorrect: true },
        { label: '3', isCorrect: false },
        { label: '4', isCorrect: true },
        { label: '7', isCorrect: false },
      ],
    },
  ],
});

let harness: Awaited<ReturnType<typeof startHarness>>;
let adminToken = '';
let adminId = '';
const openClients: TestClient[] = [];
const track = <T extends TestClient>(client: T) => {
  openClients.push(client);
  return client;
};

const idOf = (question: any, label: string) => question.options.find((o: any) => o.label === label).id;

beforeAll(async () => {
  await cleanupLiveData();
  await deleteTestUsers();
  harness = await startHarness();
  const admin = await createUserWithToken('ADMIN', 'admin');
  adminToken = admin.token;
  adminId = admin.user.id;
});

afterAll(async () => {
  openClients.forEach((c) => c.close());
  await sleep(100);
  await cleanupLiveData();
  await deleteTestUsers();
  await harness.close();
  await prisma.$disconnect();
});

describe('Live Quiz end-to-end via REST + Socket.IO (DB tes terpisah)', () => {
  it('menolak akses admin tanpa login / sebagai member', async () => {
    const anon = createApi(harness.base);
    expect((await anon('GET', '/admin/live-quiz/quizzes')).status).toBe(401);
    const member = await createUserWithToken('MEMBER', 'member');
    const asMember = createApi(harness.base, member.token);
    expect((await asMember('GET', '/admin/live-quiz/quizzes')).status).toBe(403);
    expect((await asMember('POST', '/admin/live-quiz/sessions', { quizId: 'x' })).status).toBe(403);
  });

  it('validasi kuis: kunci jawaban ganda pada SINGLE ditolak', async () => {
    const api = createApi(harness.base, adminToken);
    const bad = quizBody('Kuis rusak');
    bad.questions[0]!.options[0]!.isCorrect = true;
    const res = await api('POST', '/admin/live-quiz/quizzes', bad);
    expect(res.status).toBe(422);
  });

  it('permainan penuh: 3 pemain, soal Single/TF/Multiple, skor, tie-break, laporan, CSV', async () => {
    const api = createApi(harness.base, adminToken);

    const created = await api('POST', '/admin/live-quiz/quizzes', quizBody('Kuis Utama'));
    expect(created.status).toBe(201);
    const quizId = created.json.data.id as string;

    const sessionRes = await api('POST', '/admin/live-quiz/sessions', { quizId, settings: FAST });
    expect(sessionRes.status).toBe(201);
    const session = sessionRes.json.data;
    expect(session.pin).toMatch(/^\d{6}$/);
    expect(session.join.joinPath).toContain(session.pin);

    // PIN publik
    const anon = createApi(harness.base);
    const pinInfo = await anon('GET', `/live/pin/${session.pin}`);
    expect(pinInfo.status).toBe(200);
    expect(pinInfo.json.data.joinable).toBe(true);
    expect((await anon('GET', '/live/pin/000000')).status).toBe(404);
    expect((await anon('GET', '/live/pin/12')).status).toBe(422);

    // Join
    const join = async (name: string) => {
      const res = await anon('POST', '/live/join', { pin: session.pin, name });
      return res;
    };
    const alice = (await join('Alice')).json.data;
    const bob = (await join('  Bob<script>  ')).json.data;
    const carol = (await join('Carol')).json.data;
    expect(bob.displayName).toBe('Bobscript');
    expect((await join('alice')).status).toBe(409); // nama unik tanpa peduli huruf besar/kecil
    expect((await join('   ')).status).toBe(422);
    // Reconnect memakai token mengembalikan identitas yang sama
    const rejoin = await anon('POST', '/live/join', { pin: session.pin, name: 'apapun', rejoinToken: alice.playerToken });
    expect(rejoin.json.data.playerId).toBe(alice.playerId);
    expect(rejoin.json.data.rejoined).toBe(true);

    // Autentikasi socket
    const badPlayer = new TestClient(harness.base, { role: 'player', sessionId: session.id, playerToken: 'salah-salah-salah' });
    await expect(badPlayer.connect()).rejects.toThrow(/unauthorized/);
    const playerAsHost = new TestClient(harness.base, { role: 'host', sessionId: session.id, token: alice.playerToken });
    await expect(playerAsHost.connect()).rejects.toThrow(/unauthorized/);
    const other = await createUserWithToken('ADMIN', 'other');
    const otherHost = new TestClient(harness.base, { role: 'host', sessionId: session.id, token: other.token });
    await expect(otherHost.connect()).rejects.toThrow(/forbidden/);

    // Host & pemain terhubung
    const host = track(new TestClient(harness.base, { role: 'host', sessionId: session.id, token: adminToken }));
    await host.connect();
    const hostSync = await host.waitFor('session_state_sync');
    expect(hostSync.status).toBe('LOBBY');
    expect(hostSync.lobby.count).toBe(3);

    const pa = track(new TestClient(harness.base, { role: 'player', sessionId: session.id, playerToken: alice.playerToken }));
    const pb = track(new TestClient(harness.base, { role: 'player', sessionId: session.id, playerToken: bob.playerToken }));
    const pc = track(new TestClient(harness.base, { role: 'player', sessionId: session.id, playerToken: carol.playerToken }));
    await Promise.all([pa.connect(), pb.connect(), pc.connect()]);
    const playerSync = await pa.waitFor('session_state_sync');
    expect(playerSync.status).toBe('LOBBY');
    expect(playerSync.me.name).toBe('Alice');
    // Pemain tidak boleh melihat daftar peserta lain di lobby
    expect(playerSync.lobby).toBeUndefined();

    // Pemain tidak bisa memakai aksi host
    const forbidden = await pa.emitAck('host_action', { type: 'start' });
    expect(forbidden.ok).toBe(false);
    expect(forbidden.code).toBe('forbidden');
    // Payload tidak valid
    expect((await host.emitAck('host_action', { type: 'hapus-semua' })).code).toBe('invalid_payload');

    // ---- Mulai ----
    expect((await host.emitAck('host_action', { type: 'start' })).ok).toBe(true);
    const starting = await pa.waitFor('game_starting');
    expect(starting.countdownMs).toBe(1000);

    // ---- Soal 1 (SINGLE) ----
    const q0a = await pa.waitFor('question_started');
    const q0b = await pb.waitFor('question_started');
    const q0c = await pc.waitFor('question_started');
    const q0h = await host.waitFor('question_started');
    expect(q0a.questionIndex).toBe(0);
    // Kunci jawaban TIDAK boleh bocor ke pemain sebelum soal ditutup
    const leak = JSON.stringify(q0a);
    expect(leak).not.toMatch(/isCorrect|correctOptionIds|explanation|pembahasan/i);
    expect(JSON.stringify(q0h)).not.toMatch(/isCorrect|explanation|pembahasan/i);
    expect(q0a.deadlineAt - q0a.startedAt).toBe(5000);

    // Opsi tidak valid ditolak
    const invalid = await pa.emitAck('submit_answer', { questionIndex: 0, optionIds: ['bukan-opsi'] });
    expect(invalid.code).toBe('invalid_answer');
    // Soal yang bukan soal aktif ditolak
    expect((await pa.emitAck('submit_answer', { questionIndex: 2, optionIds: [idOf(q0a.question, '4')] })).code).toBe('question_closed');

    const t0 = Date.now();
    const ackA = await pa.emitAck('submit_answer', { questionIndex: 0, optionIds: [idOf(q0a.question, '4')] });
    expect(ackA.ok).toBe(true);
    expect(ackA.ack.duplicate).toBe(false);
    // Ack tidak mengungkap benar/salah/poin
    expect(JSON.stringify(ackA)).not.toMatch(/isCorrect|score|points|correct/i);
    // Kirim ganda (retry / klik ganda): duplikat, tidak menambah skor
    const dup = await pa.emitAck('submit_answer', { questionIndex: 0, optionIds: [idOf(q0a.question, '3')] });
    expect(dup.ok).toBe(true);
    expect(dup.ack.duplicate).toBe(true);
    await sleep(250);
    expect((await pb.emitAck('submit_answer', { questionIndex: 0, optionIds: [idOf(q0b.question, '5')] })).ok).toBe(true);
    expect((await pc.emitAck('submit_answer', { questionIndex: 0, optionIds: [idOf(q0c.question, '4')] })).ok).toBe(true);

    // Semua menjawab -> ditutup lebih cepat dari 5 detik
    const ended0 = await pa.waitFor('question_ended');
    expect(Date.now() - t0).toBeLessThan(3000);
    expect(ended0.questionIndex).toBe(0);

    const resA = await pa.waitFor('question_result');
    const resB = await pb.waitFor('question_result');
    const resH = await host.waitFor('question_result');
    expect(resA.correct).toBe(true);
    expect(resB.correct).toBe(false);
    expect(resA.correctOptionIds).toEqual([idOf(q0a.question, '4')]);
    expect(resH.counts).toMatchObject({ answered: 3, correct: 2, wrong: 1, unanswered: 0 });
    expect(resH.distribution[idOf(q0a.question, '4')]).toBe(2);
    expect(JSON.stringify(resA)).not.toMatch(/explanation|pembahasan/i);

    const scoreA = await pa.waitFor('score_updated');
    const scoreB = await pb.waitFor('score_updated');
    const scoreC = await pc.waitFor('score_updated');
    expect(scoreA.earned).toBeGreaterThanOrEqual(900);
    expect(scoreA.earned).toBeLessThanOrEqual(1000);
    expect(scoreB.earned).toBe(0);
    expect(scoreC.earned).toBeGreaterThanOrEqual(900);

    const lb0 = await host.waitFor('leaderboard_updated');
    expect(lb0.entries.length).toBe(3);
    expect(lb0.entries[2].name).toBe('Bobscript'); // skor 0 paling bawah
    const lbA = await pa.waitFor('leaderboard_updated');
    expect([1, 2]).toContain(lbA.rank);

    // ---- Klik "Next" ganda dengan versi sama: hanya satu yang efektif ----
    const [n1, n2] = await Promise.all([
      host.emitAck('host_action', { type: 'next', version: lb0.version }),
      host.emitAck('host_action', { type: 'next', version: lb0.version }),
    ]);
    expect([n1.ignored, n2.ignored].filter(Boolean).length).toBe(1);
    const q1a = await pa.waitFor('question_started', (p) => p.questionIndex === 1);
    const q1b = await pb.waitFor('question_started', (p) => p.questionIndex === 1);
    await sleep(300);
    expect(host.count('question_started', (p) => p.questionIndex === 1)).toBe(1);

    // ---- Soal 2 (TRUE_FALSE): Carol tidak menjawab ----
    const benarA = idOf(q1a.question, 'Benar');
    expect((await pa.emitAck('submit_answer', { questionIndex: 1, optionIds: [benarA] })).ok).toBe(true);
    expect((await pb.emitAck('submit_answer', { questionIndex: 1, optionIds: [idOf(q1b.question, 'Benar')] })).ok).toBe(true);

    // Bob putus & sambung lagi di tengah soal: state tersinkron dan jawaban tidak hilang
    pb.close();
    await sleep(150);
    expect(host.count('player_left')).toBeGreaterThanOrEqual(1);
    const pb2 = track(new TestClient(harness.base, { role: 'player', sessionId: session.id, playerToken: bob.playerToken }));
    await pb2.connect();
    const syncB = await pb2.waitFor('session_state_sync');
    expect(syncB.status).toBe('QUESTION_ACTIVE');
    expect(syncB.question.questionIndex).toBe(1);
    expect(syncB.myAnswer.optionIds).toEqual([idOf(q1b.question, 'Benar')]);
    expect(syncB.me.totalScore).toBe(0); // skor sebelum soal ini ditutup

    // Carol belum menjawab -> timer server menutup di deadline
    const ended1 = await pa.waitFor('question_ended', (p) => p.questionIndex === 1, 9000);
    expect(ended1.questionIndex).toBe(1);
    const res1h = await host.waitFor('question_result', (p) => p.questionIndex === 1);
    expect(res1h.counts).toMatchObject({ answered: 2, correct: 2, unanswered: 1 });

    // Jawaban terlambat ditolak
    const late = await pc.emitAck('submit_answer', { questionIndex: 1, optionIds: [idOf(q1a.question, 'Benar')] });
    expect(late.ok).toBe(false);
    expect(late.code).toBe('question_closed');

    const lb1 = await host.waitFor('leaderboard_updated', (p) => p.questionIndex === 1);
    expect(lb1.entries[0].name).toBe('Alice');
    expect(lb1.entries[0].totalScore).toBeGreaterThanOrEqual(1800);
    expect((await host.emitAck('host_action', { type: 'next', version: lb1.version })).ok).toBe(true);

    // ---- Soal 3 (MULTIPLE): harus cocok persis ----
    const q2a = await pa.waitFor('question_started', (p) => p.questionIndex === 2);
    const q2b = await pb2.waitFor('question_started', (p) => p.questionIndex === 2);
    const q2c = await pc.waitFor('question_started', (p) => p.questionIndex === 2);
    // Pilihan ganda pada SINGLE tidak boleh; pada MULTIPLE boleh
    expect((await pa.emitAck('submit_answer', { questionIndex: 2, optionIds: [idOf(q2a.question, '2'), idOf(q2a.question, '4')] })).ok).toBe(true);
    expect((await pb2.emitAck('submit_answer', { questionIndex: 2, optionIds: [idOf(q2b.question, '2')] })).ok).toBe(true); // sebagian -> salah
    expect(
      (await pc.emitAck('submit_answer', { questionIndex: 2, optionIds: [idOf(q2c.question, '2'), idOf(q2c.question, '4'), idOf(q2c.question, '3')] })).ok,
    ).toBe(true); // kelebihan -> salah

    const res2a = await pa.waitFor('question_result', (p) => p.questionIndex === 2);
    const res2b = await pb2.waitFor('question_result', (p) => p.questionIndex === 2);
    const res2c = await pc.waitFor('question_result', (p) => p.questionIndex === 2);
    expect([res2a.correct, res2b.correct, res2c.correct]).toEqual([true, false, false]);

    const lb2 = await host.waitFor('leaderboard_updated', (p) => p.questionIndex === 2);
    expect(lb2.isLast).toBe(true);
    expect((await host.emitAck('host_action', { type: 'next', version: lb2.version })).ok).toBe(true);

    // ---- Selesai ----
    const finalHost = await host.waitFor('game_finished');
    const finalA = await pa.waitFor('game_finished');
    const finalB = await pb2.waitFor('game_finished');
    const finalC = await pc.waitFor('game_finished');
    expect(finalHost.podium.map((p: any) => p.rank)).toEqual([1, 2, 3]);
    expect(finalHost.podium[0].name).toBe('Alice');
    expect(finalA.rank).toBe(1);
    expect(finalA.medal).toBe('GOLD');
    expect(finalA.totalScore).toBeGreaterThanOrEqual(2700);
    expect(finalA.correctCount).toBe(3);
    expect(finalA.accuracy).toBe(100);
    expect([finalB.rank, finalC.rank].sort()).toEqual([2, 3]);
    expect(finalB.correctCount).toBe(1);
    expect(finalB.incorrectCount).toBe(2);
    expect(finalC.unansweredCount).toBe(1);
    await host.waitFor('session_ended');

    // Hasil tersimpan permanen & PIN tidak aktif lagi
    expect(await prisma.liveResult.count({ where: { sessionId: session.id } })).toBe(3);
    const row = await prisma.liveSession.findUnique({ where: { id: session.id } });
    expect(row?.status).toBe('FINISHED');
    expect(row?.activePin).toBeNull();
    expect((await anon('GET', `/live/pin/${session.pin}`)).status).toBe(404);
    expect((await join('Dave')).status).toBe(404);

    // Pemain dapat mengambil hasil lagi lewat token (refresh setelah selesai)
    const me = await anon('GET', `/live/sessions/${session.id}/me`, undefined, { 'x-player-token': alice.playerToken });
    expect(me.status).toBe(200);
    expect(me.json.data.final.rank).toBe(1);
    expect((await anon('GET', `/live/sessions/${session.id}/me`, undefined, { 'x-player-token': 'tokensalahsalah' })).status).toBe(401);

    // Laporan
    const report = await api('GET', `/admin/live-quiz/sessions/${session.id}/report`);
    expect(report.status).toBe(200);
    const data = report.json.data;
    expect(data.ranking.length).toBe(3);
    expect(data.ranking[0]).toMatchObject({ name: 'Alice', rank: 1, correctCount: 3 });
    expect(data.questions.length).toBe(3);
    expect(data.questions[2].correctRate).toBeCloseTo(33.3, 1);
    expect(JSON.stringify(data)).not.toMatch(/explanation|pembahasan/i);

    const detail = await api('GET', `/admin/live-quiz/sessions/${session.id}/players/${alice.playerId}`);
    expect(detail.json.data.answers.length).toBe(3);
    expect(detail.json.data.answers[0]).toMatchObject({ isCorrect: true });

    const csv = await api('GET', `/admin/live-quiz/sessions/${session.id}/export.csv`);
    expect(csv.status).toBe(200);
    expect(csv.headers.get('content-type')).toContain('text/csv');
    expect(csv.text.charCodeAt(0)).toBe(0xfeff);
    expect(csv.text).toContain('Alice');
    expect(csv.text.split('\r\n')[0]).toContain('Peringkat');

    // Kuis yang sudah dimainkan tidak boleh dihapus (riwayat dilindungi)
    expect((await api('DELETE', `/admin/live-quiz/quizzes/${quizId}`)).status).toBe(409);
    // Duplikat berfungsi
    const dupQuiz = await api('POST', `/admin/live-quiz/quizzes/${quizId}/duplicate`);
    expect(dupQuiz.status).toBe(201);
    expect(dupQuiz.json.data.questions.length).toBe(3);
    expect((await api('DELETE', `/admin/live-quiz/quizzes/${dupQuiz.json.data.id}`)).status).toBe(200);
  }, 60000);

  it('kick pemain & kunci lobby', async () => {
    const api = createApi(harness.base, adminToken);
    const anon = createApi(harness.base);
    const quiz = (await api('POST', '/admin/live-quiz/quizzes', quizBody('Kuis Kick'))).json.data;
    const session = (await api('POST', '/admin/live-quiz/sessions', { quizId: quiz.id, settings: FAST })).json.data;
    const p1 = (await anon('POST', '/live/join', { pin: session.pin, name: 'Satu' })).json.data;
    const p2 = (await anon('POST', '/live/join', { pin: session.pin, name: 'Dua' })).json.data;
    const host = track(new TestClient(harness.base, { role: 'host', sessionId: session.id, token: adminToken }));
    await host.connect();
    const c1 = track(new TestClient(harness.base, { role: 'player', sessionId: session.id, playerToken: p1.playerToken }));
    await c1.connect();
    await c1.waitFor('session_state_sync');

    // Host mengunci lobby -> pemain baru ditolak
    expect((await host.emitAck('host_action', { type: 'lock', locked: true })).ok).toBe(true);
    expect((await anon('POST', '/live/join', { pin: session.pin, name: 'Tiga' })).status).toBe(403);
    expect((await host.emitAck('host_action', { type: 'lock', locked: false })).ok).toBe(true);
    expect((await anon('POST', '/live/join', { pin: session.pin, name: 'Tiga' })).status).toBe(200);

    // Kick
    expect((await host.emitAck('host_action', { type: 'kick', playerId: p1.playerId })).ok).toBe(true);
    const kicked = await c1.waitFor('kicked');
    expect(kicked.reason).toBeTruthy();
    // Pemain yang di-kick tidak bisa masuk lagi dengan token lama
    expect((await anon('POST', '/live/join', { pin: session.pin, name: 'Satu', rejoinToken: p1.playerToken })).status).toBe(403);
    const again = new TestClient(harness.base, { role: 'player', sessionId: session.id, playerToken: p1.playerToken });
    await expect(again.connect()).rejects.toThrow(/unauthorized/);
    expect(p2.playerId).toBeTruthy();

    // Memulai tanpa peserta aktif ditolak; batalkan sesi
    expect((await host.emitAck('host_action', { type: 'cancel' })).ok).toBe(true);
    const row = await prisma.liveSession.findUnique({ where: { id: session.id } });
    expect(row?.status).toBe('CANCELLED');
    expect(row?.activePin).toBeNull();
  }, 30000);

  it('pemulihan setelah restart server: timer dihitung ulang dari deadline di DB', async () => {
    const api = createApi(harness.base, adminToken);
    const anon = createApi(harness.base);
    const quiz = (await api('POST', '/admin/live-quiz/quizzes', { ...quizBody('Kuis Recovery'), questions: [quizBody('x').questions[0]] })).json.data;
    const session = (await api('POST', '/admin/live-quiz/sessions', { quizId: quiz.id, settings: FAST })).json.data;
    const player = (await anon('POST', '/live/join', { pin: session.pin, name: 'Pulih' })).json.data;

    expect((await liveEngine.hostAction(session.id, adminId, { type: 'start' })).ok).toBe(true);
    await sleep(1600); // countdown 1 dtk -> soal aktif
    const before = await prisma.liveSession.findUnique({ where: { id: session.id } });
    expect(before?.status).toBe('QUESTION_ACTIVE');

    // "Restart": buang seluruh memori + timer, lalu muat ulang dari DB di instance baru.
    liveEngine.shutdown();
    const events: Array<{ event: string; payload: any }> = [];
    const revived = new LiveEngine(prisma);
    revived.setEmitter({
      toHost: (_s, event, payload) => void events.push({ event, payload: payload as any }),
      toPlayers: (_s, event, payload) => void events.push({ event, payload: payload as any }),
      toPlayer: (_p, event, payload) => void events.push({ event, payload: payload as any }),
      disconnectPlayer: () => undefined,
    });
    expect(await revived.recover()).toBeGreaterThanOrEqual(1);

    const sync: any = await revived.getSync(session.id, { role: 'player', playerId: player.playerId });
    expect(sync.status).toBe('QUESTION_ACTIVE');
    expect(sync.question.questionIndex).toBe(0);

    // Jawaban setelah pemulihan tetap diterima selama belum lewat deadline
    const optionId = sync.question.question.options[0].id as string;
    const answered = await revived.submitAnswer(session.id, player.playerId, { questionIndex: 0, optionIds: [optionId] }, Date.now());
    expect(answered.ok).toBe(true);

    // Karena satu-satunya pemain tidak terhubung via socket, soal ditutup oleh timer deadline hasil pemulihan.
    await sleep(Math.max(0, (before!.phaseDeadlineAt!.getTime() - Date.now())) + 800);
    expect(events.some((e) => e.event === 'question_ended')).toBe(true);
    const after = await prisma.liveSession.findUnique({ where: { id: session.id } });
    expect(['QUESTION_RESULT', 'SCORE_RESULT', 'LEADERBOARD']).toContain(after?.status);
    expect(after!.stateVersion).toBeGreaterThan(before!.stateVersion);

    await revived.hostAction(session.id, adminId, { type: 'cancel' });
    revived.shutdown();
  }, 30000);
});

describe('Beban: 37 pemain bersamaan', () => {
  it('semua pemain join, menjawab, dan menerima hasil + peringkat unik yang benar', async () => {
    const api = createApi(harness.base, adminToken);
    const anon = createApi(harness.base);
    const body = quizBody('Kuis Beban');
    const quiz = (await api('POST', '/admin/live-quiz/quizzes', { ...body, questions: body.questions.slice(0, 2) })).json.data;
    const session = (await api('POST', '/admin/live-quiz/sessions', { quizId: quiz.id, settings: FAST })).json.data;

    const N = 37;
    const joinStart = Date.now();
    const joined = await Promise.all(
      Array.from({ length: N }, (_, i) => anon('POST', '/live/join', { pin: session.pin, name: `Siswa ${i + 1}` })),
    );
    expect(joined.every((r) => r.status === 200)).toBe(true);
    const joinMs = Date.now() - joinStart;

    const host = track(new TestClient(harness.base, { role: 'host', sessionId: session.id, token: adminToken }));
    await host.connect();
    const players = joined.map((r) =>
      track(new TestClient(harness.base, { role: 'player', sessionId: session.id, playerToken: r.json.data.playerToken })),
    );
    await Promise.all(players.map((p) => p.connect()));
    await Promise.all(players.map((p) => p.waitFor('session_state_sync')));

    await host.emitAck('host_action', { type: 'start' });
    const startMs = Date.now();
    const questions = await Promise.all(players.map((p) => p.waitFor('question_started')));
    const fanoutMs = Date.now() - startMs;

    // Siswa ke-i menjawab benar bila i genap (Soal 1: opsi "4")
    const ackStart = Date.now();
    const acks = await Promise.all(
      players.map((p, i) => {
        const q = questions[i];
        const label = i % 2 === 0 ? '4' : '3';
        return p.emitAck('submit_answer', { questionIndex: 0, optionIds: [idOf(q.question, label)] });
      }),
    );
    const answerMs = Date.now() - ackStart;
    expect(acks.every((a) => a.ok === true)).toBe(true);

    const results = await Promise.all(players.map((p) => p.waitFor('question_result')));
    expect(results.filter((r) => r.correct).length).toBe(19); // i = 0,2,...,36
    const hostResult = await host.waitFor('question_result');
    expect(hostResult.counts).toMatchObject({ answered: 37, correct: 19, wrong: 18, unanswered: 0 });

    const lb = await host.waitFor('leaderboard_updated');
    expect(lb.entries.length).toBe(5);
    expect(lb.totalPlayers).toBe(37);
    const ranks = (await Promise.all(players.map((p) => p.waitFor('leaderboard_updated')))).map((p) => p.rank);
    expect(Math.min(...ranks)).toBe(1);
    expect(Math.max(...ranks)).toBeLessThanOrEqual(37);

    // Akhiri lebih awal lewat host -> hasil final tersimpan untuk semua
    expect((await host.emitAck('host_action', { type: 'end' })).ok).toBe(true);
    const finals = await Promise.all(players.map((p) => p.waitFor('game_finished')));
    expect(finals.length).toBe(37);
    expect(await prisma.liveResult.count({ where: { sessionId: session.id } })).toBe(37);
    // Akhir lebih awal: hanya soal yang sudah ditutup dihitung
    expect(finals[0].totalQuestions).toBe(1);
    // eslint-disable-next-line no-console
    console.log(`[beban 37 pemain] join paralel ${joinMs}ms, fan-out soal ${fanoutMs}ms, 37 jawaban ${answerMs}ms`);
  }, 60000);
});
