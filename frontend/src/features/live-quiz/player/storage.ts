export type StoredPlayer = {
  sessionId: string;
  playerId: string;
  playerToken: string;
  name: string;
  avatarId?: string;
  pin: string;
  savedAt: number;
};

const KEY_PREFIX = 'tactical-live-player:';
const LAST_KEY = 'tactical-live-last';
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

const read = (key: string): StoredPlayer | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPlayer;
    if (!parsed.playerToken || !parsed.sessionId) return null;
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const playerStorage = {
  save(player: Omit<StoredPlayer, 'savedAt'>) {
    const value: StoredPlayer = { ...player, savedAt: Date.now() };
    try {
      localStorage.setItem(`${KEY_PREFIX}${player.sessionId}`, JSON.stringify(value));
      localStorage.setItem(LAST_KEY, JSON.stringify(value));
    } catch {
      // penyimpanan penuh / mode privat: sesi tetap berjalan, hanya tanpa pemulihan setelah refresh
    }
  },
  load(sessionId: string) {
    return read(`${KEY_PREFIX}${sessionId}`);
  },
  loadLast() {
    return read(LAST_KEY);
  },
  clear(sessionId: string) {
    try {
      localStorage.removeItem(`${KEY_PREFIX}${sessionId}`);
      const last = read(LAST_KEY);
      if (last?.sessionId === sessionId) localStorage.removeItem(LAST_KEY);
    } catch {
      // abaikan
    }
  },
};

/** Karakter terakhir yang dipakai di perangkat ini (hanya kenyamanan; server tetap pemegang data resmi). */
const AVATAR_KEY = 'tactical-live-avatar';
export const avatarPreference = {
  load(): string | null {
    try {
      return localStorage.getItem(AVATAR_KEY);
    } catch {
      return null;
    }
  },
  save(avatarId: string) {
    try {
      localStorage.setItem(AVATAR_KEY, avatarId);
    } catch {
      // abaikan
    }
  },
};
