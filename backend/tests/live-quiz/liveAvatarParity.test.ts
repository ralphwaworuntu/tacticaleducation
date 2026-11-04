import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { AVATAR_IDS, defaultAvatarFor } from '../../src/modules/live-quiz/liveAvatars';

const FRONTEND_AVATARS = path.resolve(__dirname, '../../../frontend/src/features/live-quiz/avatars.tsx');

/**
 * Menjaga katalog avatar backend dan frontend tetap sama (id + avatar default deterministik).
 * Dilewati bila folder frontend tidak ada (mis. backend dideploy sendiri).
 */
describe.skipIf(!existsSync(FRONTEND_AVATARS))('Kesesuaian avatar frontend <-> backend', () => {
  const source = existsSync(FRONTEND_AVATARS) ? readFileSync(FRONTEND_AVATARS, 'utf8') : '';
  const frontendIds = [...source.matchAll(/^\s{4}id: '([a-z]+)',/gm)].map((m) => m[1]);

  it('memiliki 16 id yang identik dan berurutan sama', () => {
    expect(frontendIds).toHaveLength(16);
    expect(frontendIds).toEqual([...AVATAR_IDS]);
  });

  it('memakai algoritma hash FNV-1a yang sama untuk avatar default', () => {
    expect(source).toContain('0x811c9dc5');
    expect(source).toContain('0x01000193');
    expect(source).toContain('stableHash(seed) % AVATARS.length');
    // Backend: hasil deterministik untuk seed yang sama.
    expect(defaultAvatarFor('player-abc')).toBe(defaultAvatarFor('player-abc'));
    expect(AVATAR_IDS).toContain(defaultAvatarFor('player-abc'));
  });
});
