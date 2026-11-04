/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../src/config/prisma';
import { AVATAR_IDS, defaultAvatarFor, isAvatarId, normalizeAvatarId } from '../../src/modules/live-quiz/liveAvatars';
import {
  REACTION_BATCH_MAX_ITEMS,
  REACTION_BURST_MAX,
  REACTION_COOLDOWN_MS,
  REACTION_IDS,
  ReactionState,
  checkReactionPhase,
} from '../../src/modules/live-quiz/liveReactions';
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
      ],
    },
  ],
});

/* ---------------------------------------------------------------------- */
/* Unit: katalog avatar & aturan reaksi (tanpa DB / socket)                 */
/* ---------------------------------------------------------------------- */

describe('Katalog avatar', () => {
  it('memiliki 16 ID unik dan valid', () => {
    expect(AVATAR_IDS.length).toBe(16);
    expect(new Set(AVATAR_IDS).size).toBe(16);
    AVATAR_IDS.forEach((id) => expect(isAvatarId(id)).toBe(true));
  });

  it('ID tidak dikenal / kosong jatuh ke avatar default yang deterministik', () => {
    for (const bad of [undefined, null, '', 'avatar-lama', 42, {}, '<script>']) {
      const result = normalizeAvatarId(bad, 'player-1');
      expect(isAvatarId(result)).toBe(true);
      expect(result).toBe(defaultAvatarFor('player-1'));
    }
    expect(defaultAvatarFor('abc')).toBe(defaultAvatarFor('abc'));
    expect(normalizeAvatarId('fox', 'x')).toBe('fox');
  });

  it('default tersebar ke banyak avatar (bukan satu avatar untuk semua)', () => {
    const used = new Set(Array.from({ length: 200 }, (_, i) => defaultAvatarFor(`id-${i}`)));
    expect(used.size).toBeGreaterThan(8);
  });
});

describe('Aturan fase reaksi', () => {
  const on = { reactionsEnabled: true, reactionsAfterSubmit: true };
  it('LOBBY dan fase hasil/leaderboard/final diizinkan', () => {
    for (const phase of ['LOBBY', 'QUESTION_RESULT', 'SCORE_RESULT', 'LEADERBOARD', 'FINISHED'] as const) {
      expect(checkReactionPhase(phase, on, false).ok).toBe(true);
    }
  });
  it('COUNTDOWN, DRAFT, CANCELLED dilarang', () => {
    for (const phase of ['COUNTDOWN', 'DRAFT', 'CANCELLED'] as const) {
      expect(checkReactionPhase(phase, on, true).ok).toBe(false);
    }
  });
  it('QUESTION_ACTIVE hanya setelah menjawab dan bila host mengizinkan', () => {
    expect(checkReactionPhase('QUESTION_ACTIVE', on, false)).toMatchObject({ ok: false, code: 'answer_required' });
    expect(checkReactionPhase('QUESTION_ACTIVE', on, true).ok).toBe(true);
    expect(
      checkReactionPhase('QUESTION_ACTIVE', { reactionsEnabled: true, reactionsAfterSubmit: false }, true),
    ).toMatchObject({ ok: false, code: 'phase_not_allowed' });
  });
  it('dimatikan host -> semua fase ditolak', () => {
    expect(checkReactionPhase('LOBBY', { reactionsEnabled: false, reactionsAfterSubmit: true }, true)).toMatchObject({
      ok: false,
      code: 'reactions_disabled',
    });
  });
});

describe('Pembatas laju reaksi', () => {
  it('1 reaksi per 3 detik per pemain', () => {
    const s = new ReactionState();
    expect(s.admit('p1', 1000).ok).toBe(true);
    const second = s.admit('p1', 1000 + REACTION_COOLDOWN_MS - 1);
    expect(second).toMatchObject({ ok: false, code: 'cooldown' });
    expect(s.admit('p1', 1000 + REACTION_COOLDOWN_MS).ok).toBe(true);
    // Pemain lain tidak terpengaruh.
    expect(s.admit('p2', 1001).ok).toBe(true);
  });

  it('burst: maksimal REACTION_BURST_MAX per 30 detik meski cooldown dipatuhi', () => {
    const s = new ReactionState();
    let accepted = 0;
    for (let i = 0; i < 20; i += 1) {
      if (s.admit('p1', i * (REACTION_COOLDOWN_MS + 1)).ok) accepted += 1;
    }
    // 20 percobaan tiap 3,001 dtk = 60 dtk -> jendela 30 dtk menampung maksimal BURST_MAX.
    expect(accepted).toBeLessThan(20);
    expect(accepted).toBeGreaterThanOrEqual(REACTION_BURST_MAX);
    expect(accepted).toBeLessThanOrEqual(REACTION_BURST_MAX * 2 + 1);
  });

  it('batch menggabungkan emoji dan membatasi item bernama', () => {
    const s = new ReactionState();
    for (let i = 0; i < 40; i += 1) {
      s.enqueue({ playerId: `p${i}`, name: `P${i}`, avatarId: 'fox', emoji: i % 2 ? 'fire' : 'heart', at: i });
    }
    const batch = s.drain()!;
    expect(batch.total).toBe(40);
    expect(batch.items.length).toBe(REACTION_BATCH_MAX_ITEMS);
    expect(batch.counts.fire).toBe(20);
    expect(batch.counts.heart).toBe(20);
    expect(s.drain()).toBeNull();
  });
});

/* ---------------------------------------------------------------------- */
/* Integrasi REST + Socket.IO (DB tes terpisah)                             */
/* ---------------------------------------------------------------------- */

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
  adminToken = (await createUserWithToken('ADMIN', 'avatar-admin')).token;
});

afterAll(async () => {
  openClients.forEach((c) => c.close());
  await sleep(100);
  await cleanupLiveData();
  await deleteTestUsers();
  await harness.close();
  await prisma.$disconnect();
});

async function newSession(settings: Record<string, unknown> = {}) {
  const api = createApi(harness.base, adminToken);
  const quiz = await api('POST', '/admin/live-quiz/quizzes', quizBody(`Kuis Avatar ${Date.now()}`));
  expect(quiz.status).toBe(201);
  const created = await api('POST', '/admin/live-quiz/sessions', { quizId: quiz.json.data.id, settings: { ...FAST, ...settings } });
  expect(created.status).toBe(201);
  return created.json.data as { id: string; pin: string };
}

const anon = () => createApi(harness.base);

async function join(session: { pin: string }, name: string, avatarId?: string | null) {
  const res = await anon()('POST', '/live/join', { pin: session.pin, name, ...(avatarId === undefined ? {} : { avatarId }) });
  expect(res.status).toBe(200);
  return res.json.data as { playerId: string; playerToken: string; avatarId: string; displayName: string };
}

async function connectPlayer(session: { id: string }, token: string) {
  const client = track(new TestClient(harness.base, { role: 'player', sessionId: session.id, playerToken: token }));
  await client.connect();
  return client;
}

async function connectHost(session: { id: string }) {
  const client = track(new TestClient(harness.base, { role: 'host', sessionId: session.id, token: adminToken }));
  await client.connect();
  return client;
}

describe('Avatar pemain (REST + socket)', () => {
  it('join menyimpan avatar pilihan, memberi default bila kosong/tidak valid, dan konsisten setelah rejoin & refresh', async () => {
    const session = await newSession();
    const chosen = await join(session, 'Ayu', 'astronaut');
    expect(chosen.avatarId).toBe('astronaut');

    const none = await join(session, 'Budi');
    expect(isAvatarId(none.avatarId)).toBe(true);
    const invalid = await join(session, 'Cici', 'avatar-yang-tidak-ada');
    expect(isAvatarId(invalid.avatarId)).toBe(true);
    // Klien lama (tanpa field avatarId) tetap bisa join: backward compatible.
    expect(none.avatarId).toBe(defaultAvatarFor(none.playerId));

    // Rejoin dengan token + avatar berbeda tidak mengubah avatar yang sudah ada.
    const rejoin = await anon()('POST', '/live/join', {
      pin: session.pin,
      name: 'x',
      rejoinToken: chosen.playerToken,
      avatarId: 'robot',
    });
    expect(rejoin.json.data.avatarId).toBe('astronaut');

    // Tersimpan di DB sebagai ID (bukan gambar).
    const row = await prisma.livePlayer.findUnique({ where: { id: chosen.playerId } });
    expect(row?.avatarId).toBe('astronaut');
    const noneRow = await prisma.livePlayer.findUnique({ where: { id: none.playerId } });
    expect(noneRow?.avatarId).toBeNull(); // default dihitung, tidak dipaksa tersimpan

    // Sync pemain (refresh/reconnect) memuat avatar; host melihat avatar di lobby.
    const host = await connectHost(session);
    const hostSync = await host.waitFor('session_state_sync');
    const lobbyAyu = hostSync.lobby.players.find((p: any) => p.name === 'Ayu');
    expect(lobbyAyu.avatarId).toBe('astronaut');
    const p = await connectPlayer(session, chosen.playerToken);
    const sync = await p.waitFor('session_state_sync');
    expect(sync.me.avatarId).toBe('astronaut');
    p.close();
    const again = await connectPlayer(session, chosen.playerToken);
    expect((await again.waitFor('session_state_sync')).me.avatarId).toBe('astronaut');

    // Endpoint pemulihan /me juga memuat avatar.
    const me = await anon()('GET', `/live/sessions/${session.id}/me`, undefined, { 'x-player-token': chosen.playerToken });
    expect(me.json.data.me.avatarId).toBe('astronaut');
  });

  it('ganti avatar di lobby: hanya diri sendiri, host diberi tahu, ditolak setelah game mulai', async () => {
    const session = await newSession();
    const a = await join(session, 'Alpha', 'fox');
    const b = await join(session, 'Bravo', 'panda');
    const host = await connectHost(session);
    await host.waitFor('session_state_sync');
    const pa = await connectPlayer(session, a.playerToken);
    await pa.waitFor('session_state_sync');

    // ID tidak dikenal ditolak; payload tak valid ditolak.
    expect((await pa.emitAck('set_avatar', { avatarId: 'bukan-avatar' })).code).toBe('invalid_avatar');
    expect((await pa.emitAck('set_avatar', {})).code).toBe('invalid_payload');

    // Mencoba menyetel avatar pemain lain lewat payload: playerId dari klien diabaikan.
    const res = await pa.emitAck('set_avatar', { avatarId: 'dragon', playerId: b.playerId });
    expect(res).toMatchObject({ ok: true, avatarId: 'dragon' });
    const updated = await host.waitFor('player_avatar_updated', (p) => p.player.id === a.playerId);
    expect(updated.player.avatarId).toBe('dragon');
    expect((await prisma.livePlayer.findUnique({ where: { id: a.playerId } }))?.avatarId).toBe('dragon');
    expect((await prisma.livePlayer.findUnique({ where: { id: b.playerId } }))?.avatarId).toBe('panda');

    // Host tidak punya hak set_avatar.
    expect((await host.emitAck('set_avatar', { avatarId: 'cat' })).code).toBe('forbidden');

    // Setelah game mulai: ditolak.
    expect((await host.emitAck('host_action', { type: 'start' })).ok).toBe(true);
    await pa.waitFor('question_started');
    expect((await pa.emitAck('set_avatar', { avatarId: 'owl' })).code).toBe('phase_not_allowed');
    expect((await prisma.livePlayer.findUnique({ where: { id: a.playerId } }))?.avatarId).toBe('dragon');
  });

  it('host dapat melarang ganti avatar lewat pengaturan sesi', async () => {
    const session = await newSession({ allowAvatarChange: false });
    const a = await join(session, 'Locked', 'cat');
    const pa = await connectPlayer(session, a.playerToken);
    await pa.waitFor('session_state_sync');
    expect((await pa.emitAck('set_avatar', { avatarId: 'owl' })).code).toBe('avatar_locked');
  });

  it('avatar ikut di leaderboard, podium/final, dan laporan admin', async () => {
    const session = await newSession();
    const a = await join(session, 'Juara', 'tiger');
    const b = await join(session, 'Kedua', 'lion');
    const host = await connectHost(session);
    await host.waitFor('session_state_sync');
    const pa = await connectPlayer(session, a.playerToken);
    const pb = await connectPlayer(session, b.playerToken);
    await Promise.all([pa.waitFor('session_state_sync'), pb.waitFor('session_state_sync')]);

    await host.emitAck('host_action', { type: 'start' });
    const qa = await pa.waitFor('question_started');
    const qb = await pb.waitFor('question_started');
    const correct = (q: any) => q.question.options.find((o: any) => o.label === '4').id;
    const wrong = (q: any) => q.question.options.find((o: any) => o.label === '3').id;
    await pa.emitAck('submit_answer', { questionIndex: 0, optionIds: [correct(qa)] });
    await pb.emitAck('submit_answer', { questionIndex: 0, optionIds: [wrong(qb)] });

    const score = await host.waitFor('score_updated');
    expect(score.topGains[0].avatarId).toBe('tiger');
    const lb = await host.waitFor('leaderboard_updated');
    expect(lb.entries.find((e: any) => e.name === 'Juara').avatarId).toBe('tiger');
    const lbPlayer = await pb.waitFor('leaderboard_updated');
    expect(lbPlayer.top.find((e: any) => e.name === 'Juara').avatarId).toBe('tiger');

    await host.emitAck('host_action', { type: 'next', version: lb.version });
    const finalHost = await host.waitFor('game_finished');
    expect(finalHost.podium[0]).toMatchObject({ name: 'Juara', avatarId: 'tiger', rank: 1 });
    expect(finalHost.podium[1]).toMatchObject({ name: 'Kedua', avatarId: 'lion' });
    const finalPlayer = await pb.waitFor('game_finished');
    expect(finalPlayer.podium[0].avatarId).toBe('tiger');

    const report = await createApi(harness.base, adminToken)('GET', `/admin/live-quiz/sessions/${session.id}/report`);
    expect(report.status).toBe(200);
    const rows = JSON.stringify(report.json.data);
    expect(rows).toContain('"avatarId":"tiger"');
  });
});

describe('Reaksi emoji (REST + socket)', () => {
  it('lobby: host menerima reaksi bernama + avatar, pemain hanya hitungan; cooldown & emoji tidak valid ditolak', async () => {
    const session = await newSession();
    const a = await join(session, 'Reaktor', 'ninja');
    const b = await join(session, 'Penonton', 'owl');
    const host = await connectHost(session);
    await host.waitFor('session_state_sync');
    const pa = await connectPlayer(session, a.playerToken);
    const pb = await connectPlayer(session, b.playerToken);
    await Promise.all([pa.waitFor('session_state_sync'), pb.waitFor('session_state_sync')]);

    // Emoji di luar 8 ID tetap ditolak (termasuk teks bebas / emoji unicode mentah).
    for (const bad of ['💀', 'fire!!', '<b>x</b>', 'FIRE', '']) {
      const r = await pa.emitAck('player_reaction_sent', { emoji: bad });
      expect(r.ok).toBe(false);
      expect(['invalid_emoji', 'invalid_payload']).toContain(r.code);
    }
    expect((await pa.emitAck('player_reaction_sent', { emoji: 42 })).code).toBe('invalid_payload');
    expect((await pa.emitAck('player_reaction_sent', {})).code).toBe('invalid_payload');

    expect((await pa.emitAck('player_reaction_sent', { emoji: 'fire' })).ok).toBe(true);
    const second = await pa.emitAck('player_reaction_sent', { emoji: 'heart' });
    expect(second).toMatchObject({ ok: false, code: 'cooldown' });
    expect(second.retryAfterMs).toBeGreaterThan(0);

    const hostBatch = await host.waitFor('live_reaction_broadcast');
    expect(hostBatch.items).toHaveLength(1);
    expect(hostBatch.items[0]).toMatchObject({ name: 'Reaktor', avatarId: 'ninja', emoji: 'fire', playerId: a.playerId });
    const playerBatch = await pb.waitFor('live_reaction_broadcast');
    expect(playerBatch.counts).toEqual({ fire: 1 });
    // Pemain lain tidak pernah menerima nama/ID pengirim.
    expect(JSON.stringify(playerBatch)).not.toMatch(/Reaktor|playerId|items/);

    // Host tidak bisa mengirim reaksi; pemain tidak bisa set_reactions.
    expect((await host.emitAck('player_reaction_sent', { emoji: 'fire' })).code).toBe('forbidden');
    expect((await pa.emitAck('host_action', { type: 'set_reactions', enabled: false })).code).toBe('forbidden');

    // Tidak ada penyimpanan permanen: tidak ada tabel/baris reaksi.
    const tables = (await prisma.$queryRawUnsafe(
      "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) LIKE '%reaction%'",
    )) as unknown[];
    expect(tables).toHaveLength(0);
  });

  it('fase: countdown ditolak; soal aktif hanya setelah menjawab; hasil diizinkan; tidak memengaruhi skor/timer', async () => {
    const session = await newSession();
    const a = await join(session, 'Pertama', 'robot');
    const b = await join(session, 'Kedua', 'pilot');
    const host = await connectHost(session);
    await host.waitFor('session_state_sync');
    const pa = await connectPlayer(session, a.playerToken);
    const pb = await connectPlayer(session, b.playerToken);
    await Promise.all([pa.waitFor('session_state_sync'), pb.waitFor('session_state_sync')]);

    await host.emitAck('host_action', { type: 'start' });
    await pa.waitFor('game_starting');
    expect((await pa.emitAck('player_reaction_sent', { emoji: 'fire' })).code).toBe('phase_not_allowed');

    const qa = await pa.waitFor('question_started');
    const qb = await pb.waitFor('question_started');
    // Sebelum menjawab: ditolak.
    expect((await pa.emitAck('player_reaction_sent', { emoji: 'fire' })).code).toBe('answer_required');
    const correct = (q: any) => q.question.options.find((o: any) => o.label === '4').id;
    expect((await pa.emitAck('submit_answer', { questionIndex: 0, optionIds: [correct(qa)] })).ok).toBe(true);
    // Setelah menjawab: diterima. Pemain yang belum menjawab tetap ditolak.
    expect((await pa.emitAck('player_reaction_sent', { emoji: 'rocket' })).ok).toBe(true);
    expect((await pb.emitAck('player_reaction_sent', { emoji: 'rocket' })).code).toBe('answer_required');

    // Reaksi tidak membuat soal tertutup lebih cepat dan tidak mengubah status jawaban pemain lain.
    await sleep(500);
    expect(host.count('question_ended')).toBe(0);
    expect((await pb.emitAck('submit_answer', { questionIndex: 0, optionIds: [correct(qb)] })).ok).toBe(true);
    await pa.waitFor('question_ended');
    const scoreA = await pa.waitFor('score_updated');
    const scoreB = await pb.waitFor('score_updated');
    // Skor identik dengan jalur tanpa reaksi: dihitung dari kecepatan jawaban, bukan reaksi.
    expect(scoreA.earned).toBeGreaterThanOrEqual(900);
    expect(scoreB.earned).toBeGreaterThanOrEqual(900);

    // Fase hasil: diizinkan (cooldown 3 dtk sejak reaksi sebelumnya -> pakai pemain B).
    await pb.waitFor('question_result');
    expect((await pb.emitAck('player_reaction_sent', { emoji: 'party' })).ok).toBe(true);
  });

  it('host dapat menyembunyikan reaksi dari proyektor dan mematikannya untuk semua (tersimpan per sesi)', async () => {
    const session = await newSession();
    const a = await join(session, 'Satu', 'cat');
    const host = await connectHost(session);
    await host.waitFor('session_state_sync');
    const pa = await connectPlayer(session, a.playerToken);
    const sync = await pa.waitFor('session_state_sync');
    expect(sync.settings.reactionsEnabled).toBe(true);

    // Sembunyikan dari proyektor: pemain tetap bisa mengirim, host tidak menerima siaran.
    expect((await host.emitAck('host_action', { type: 'set_reactions', onProjector: false })).ok).toBe(true);
    const changed = await pa.waitFor('reactions_enabled_changed');
    expect(changed).toMatchObject({ reactionsEnabled: true, reactionsOnProjector: false });
    expect((await pa.emitAck('player_reaction_sent', { emoji: 'wow' })).ok).toBe(true);
    await pa.waitFor('live_reaction_broadcast');
    await sleep(300);
    expect(host.count('live_reaction_broadcast')).toBe(0);

    // Matikan untuk semua.
    expect((await host.emitAck('host_action', { type: 'set_reactions', enabled: false })).ok).toBe(true);
    await pa.waitFor('reactions_enabled_changed', (p) => p.reactionsEnabled === false);
    await sleep(REACTION_COOLDOWN_MS + 100);
    expect((await pa.emitAck('player_reaction_sent', { emoji: 'wow' })).code).toBe('reactions_disabled');
    // Pengaturan tersimpan per sesi (DB), ikut ke sync berikutnya.
    const row = await prisma.liveSession.findUnique({ where: { id: session.id } });
    expect((row?.settings as any).reactionsEnabled).toBe(false);
    const fresh = await connectPlayer(session, a.playerToken);
    expect((await fresh.waitFor('session_state_sync')).settings.reactionsEnabled).toBe(false);
    // Perubahan tanpa efek (nilai sama) diabaikan.
    expect(await host.emitAck('host_action', { type: 'set_reactions', enabled: false })).toMatchObject({ ok: true, ignored: true });
  }, 20000);

  it('37 pemain mengirim reaksi serentak + spam: tiap pemain maksimal 1 diterima, server stabil, batch dibatasi', async () => {
    const session = await newSession({ maxPlayers: 60 });
    const players: Array<{ client: TestClient; id: string }> = [];
    for (let i = 0; i < 37; i += 1) {
      const joined = await join(session, `Bot ${String(i + 1).padStart(2, '0')}`, AVATAR_IDS[i % AVATAR_IDS.length]);
      players.push({ client: await connectPlayer(session, joined.playerToken), id: joined.playerId });
    }
    const host = await connectHost(session);
    await host.waitFor('session_state_sync');
    await Promise.all(players.map((p) => p.client.waitFor('session_state_sync')));

    const emojis = REACTION_IDS;
    const results = await Promise.all(
      players.flatMap((p, i) =>
        // 5 percobaan beruntun per pemain (spam) dengan emoji berbeda.
        Array.from({ length: 5 }, (_, k) => p.client.emitAck('player_reaction_sent', { emoji: emojis[(i + k) % emojis.length] })),
      ),
    );
    const accepted = results.filter((r) => r.ok).length;
    expect(accepted).toBe(37); // tepat satu per pemain
    expect(results.filter((r) => !r.ok).every((r) => ['cooldown', 'rate_limited'].includes(r.code))).toBe(true);

    await sleep(1200);
    const hostBatches = host.log.filter((l) => l.event === 'live_reaction_broadcast').map((l) => l.payload);
    expect(hostBatches.length).toBeGreaterThan(0);
    // Diterima host sebagai beberapa batch dan tidak pernah melebihi batas item bernama per batch.
    hostBatches.forEach((b) => expect(b.items.length).toBeLessThanOrEqual(REACTION_BATCH_MAX_ITEMS));
    expect(hostBatches.reduce((sum, b) => sum + b.total, 0)).toBe(37);
    // Jumlah event jauh lebih sedikit daripada 37 (penggabungan server).
    expect(hostBatches.length).toBeLessThan(10);

    // Server tetap sehat dan state sesi tidak berubah.
    const sync = await players[0]!.client.emitAck('request_sync');
    expect(sync.ok).toBe(true);
    const start = await host.emitAck('host_action', { type: 'start' });
    expect(start.ok).toBe(true);
    await players[0]!.client.waitFor('question_started');
  }, 60000);
});
