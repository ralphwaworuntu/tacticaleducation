/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { prisma } from '../../src/config/prisma';
import { isLivePlayerAvatarUrl } from '../../src/modules/live-quiz/liveAvatars';
import {
  cleanupLiveData,
  createApi,
  createUserWithToken,
  deleteTestUsers,
  startHarness,
} from './helpers/harness';

const quizBody = {
  title: 'Avatar kartun',
  subject: 'Uji',
  questions: [
    {
      type: 'SINGLE',
      prompt: '1+1?',
      options: [
        { label: '1', isCorrect: false },
        { label: '2', isCorrect: true },
      ],
    },
  ],
};

describe('URL avatar kartun', () => {
  it('hanya menerima path unggahan Live Quiz', () => {
    expect(isLivePlayerAvatarUrl('/uploads/live-quiz/avatars/av-1.webp')).toBe(true);
    expect(isLivePlayerAvatarUrl('/uploads/live-quiz/avatars/av-1.jpg')).toBe(true);
    expect(isLivePlayerAvatarUrl('/uploads/live-quiz/avatars/../secret.webp')).toBe(false);
    expect(isLivePlayerAvatarUrl('/uploads/avatars/x.webp')).toBe(false);
    expect(isLivePlayerAvatarUrl('https://evil.example/x.webp')).toBe(false);
    expect(isLivePlayerAvatarUrl('/uploads/live-quiz/avatars/a.png')).toBe(true);
  });
});

describe('Unggah avatar kartun pemain', () => {
  let close: () => Promise<void>;
  let base = '';

  beforeAll(async () => {
    const h = await startHarness();
    close = h.close;
    base = h.base;
  });
  afterAll(async () => {
    await cleanupLiveData();
    await deleteTestUsers();
    await close();
  });

  it('menolak tanpa token, menerima unggahan pemilik, dan host melihat avatarUrl', async () => {
    const { token } = await createUserWithToken('ADMIN', 'avurl');
    const api = createApi(base, token);
    const quiz = await api('POST', '/admin/live-quiz/quizzes', quizBody);
    const session = await api('POST', '/admin/live-quiz/sessions', { quizId: quiz.json.data.id });
    const pin = session.json.data.pin as string;
    const sessionId = session.json.data.id as string;

    const join = await createApi(base)('POST', '/live/join', { pin, name: 'Sinta', avatarId: 'fox' });
    expect(join.status).toBe(200);
    const playerToken = join.json.data.playerToken as string;
    expect(join.json.data.avatarUrl).toBeNull();

    const jpeg = await sharp({ create: { width: 80, height: 80, channels: 3, background: '#2575FC' } })
      .jpeg()
      .toBuffer();

    const denied = await fetch(`${base}/api/v1/live/sessions/${sessionId}/avatar`, {
      method: 'POST',
      body: (() => {
        const form = new FormData();
        form.append('avatar', new Blob([jpeg], { type: 'image/jpeg' }), 'selfie.jpg');
        return form;
      })(),
    });
    expect(denied.status).toBe(401);

    const form = new FormData();
    form.append('avatar', new Blob([jpeg], { type: 'image/jpeg' }), 'selfie.jpg');
    const uploaded = await fetch(`${base}/api/v1/live/sessions/${sessionId}/avatar`, {
      method: 'POST',
      headers: { 'x-player-token': playerToken },
      body: form,
    });
    const body = (await uploaded.json()) as any;
    expect(uploaded.status).toBe(200);
    expect(isLivePlayerAvatarUrl(body.data.avatarUrl)).toBe(true);

    const stored = await prisma.$queryRaw<Array<{ avatarUrl: string | null }>>`
      SELECT avatarUrl FROM LivePlayer WHERE sessionId = ${sessionId}
    `;
    expect(stored[0]?.avatarUrl).toBe(body.data.avatarUrl);

    const me = await createApi(base)('GET', `/live/sessions/${sessionId}/me`, undefined, {
      'x-player-token': playerToken,
    });
    expect(me.json.data.me.avatarUrl).toBe(body.data.avatarUrl);
  });
});
