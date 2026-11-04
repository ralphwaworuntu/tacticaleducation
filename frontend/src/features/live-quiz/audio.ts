/**
 * Audio Live Quiz 2.0 -- 100% disintesis dengan Web Audio API (osilator + noise).
 * Tidak ada file audio, sampel, atau melodi pihak ketiga; semua nada dibuat dari kode ini.
 *
 * Struktur: sumber -> bus (sfx / musik, masing-masing punya volume sendiri) -> master (mute) -> output.
 * Kebijakan autoplay: AudioContext baru dibuat/dilanjutkan di dalam gestur pengguna (`unlock()`);
 * sebelum itu semua pemutaran diabaikan tanpa error.
 */

export type Sfx =
  | 'select'
  | 'join'
  | 'tick'
  | 'countdown'
  | 'go'
  | 'start'
  | 'timeUp'
  | 'correct'
  | 'wrong'
  | 'points'
  | 'reveal'
  | 'rankUp'
  | 'drumroll'
  | 'fanfare'
  // v2
  | 'avatarPick'
  | 'reaction'
  | 'whoosh'
  | 'podiumRise'
  | 'trophy'
  | 'streak';

export type MusicMode = 'lobby' | 'question' | 'leaderboard' | 'victory';

const STORAGE_KEY = 'tactical-live-audio';

type Prefs = { muted: boolean; musicVolume: number; sfxVolume: number };

const midi = (note: number) => 440 * Math.pow(2, (note - 69) / 12);
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function loadPrefs(): Prefs {
  const fallback: Prefs = { muted: false, musicVolume: 0.5, sfxVolume: 0.8 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    // Mendukung format v1 ({ muted, volume }) -> volume lama dipakai untuk SFX dan musik.
    const parsed = JSON.parse(raw) as Partial<Prefs> & { volume?: number };
    const legacy = typeof parsed.volume === 'number' ? clamp01(parsed.volume) : null;
    return {
      muted: Boolean(parsed.muted),
      musicVolume: typeof parsed.musicVolume === 'number' ? clamp01(parsed.musicVolume) : (legacy ?? fallback.musicVolume),
      sfxVolume: typeof parsed.sfxVolume === 'number' ? clamp01(parsed.sfxVolume) : (legacy ?? fallback.sfxVolume),
    };
  } catch {
    return fallback;
  }
}

/** Progresi akor (nada MIDI akar) dan pola arpeggio untuk tiap mode musik. */
const MUSIC: Record<MusicMode, { bpm: number; roots: number[]; arp: number[]; arpOctave: number; gain: number; wave: OscillatorType }> = {
  lobby: { bpm: 104, roots: [57, 53, 60, 55], arp: [0, 7, 12, 7, 4, 7, 12, 7], arpOctave: 12, gain: 0.5, wave: 'triangle' },
  question: { bpm: 128, roots: [57, 57, 53, 55], arp: [0, 3, 7, 3, 0, 3, 7, 10], arpOctave: 12, gain: 0.4, wave: 'triangle' },
  leaderboard: { bpm: 116, roots: [60, 55, 57, 53], arp: [0, 4, 7, 12, 7, 4, 7, 4], arpOctave: 12, gain: 0.45, wave: 'triangle' },
  victory: { bpm: 136, roots: [60, 65, 67, 60], arp: [0, 4, 7, 12, 16, 12, 7, 12], arpOctave: 12, gain: 0.55, wave: 'square' },
};

class LiveAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private prefs: Prefs = loadPrefs();
  private musicTimer: number | null = null;
  private musicMode: MusicMode | null = null;
  private nextStepTime = 0;
  private step = 0;
  private listeners = new Set<() => void>();
  private snapshot = '';

  constructor() {
    this.refreshSnapshot();
  }

  get muted() {
    return this.prefs.muted;
  }
  /** Alias lama (v1): volume efek suara. */
  get volume() {
    return this.prefs.sfxVolume;
  }
  get sfxVolume() {
    return this.prefs.sfxVolume;
  }
  get musicVolume() {
    return this.prefs.musicVolume;
  }
  get currentMusic() {
    return this.musicMode;
  }

  /** String snapshot stabil untuk useSyncExternalStore. */
  getSnapshot() {
    return this.snapshot;
  }

  private refreshSnapshot() {
    this.snapshot = `${this.prefs.muted}:${this.prefs.musicVolume}:${this.prefs.sfxVolume}:${this.isUnlocked}`;
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    this.refreshSnapshot();
    this.listeners.forEach((listener) => listener());
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.prefs));
    } catch {
      // abaikan
    }
  }

  private applyGains() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master?.gain.setTargetAtTime(this.prefs.muted ? 0 : 1, t, 0.03);
    this.sfxBus?.gain.setTargetAtTime(this.prefs.sfxVolume, t, 0.03);
    // Musik latar sengaja jauh lebih pelan daripada efek (0.3 = headroom agar tidak menutupi SFX).
    this.musicBus?.gain.setTargetAtTime(this.prefs.musicVolume * 0.3, t, 0.03);
  }

  /** Harus dipanggil dari gestur pengguna (klik/tap) agar browser mengizinkan audio. */
  unlock() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.connect(this.master);
      this.master.gain.value = this.prefs.muted ? 0 : 1;
      this.sfxBus.gain.value = this.prefs.sfxVolume;
      this.musicBus.gain.value = this.prefs.musicVolume * 0.3;
      this.ctx.addEventListener('statechange', () => this.emit());
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().then(() => this.emit());
    this.emit();
  }

  get isUnlocked() {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  setMuted(muted: boolean) {
    this.prefs.muted = muted;
    this.applyGains();
    this.persist();
    this.emit();
  }

  setSfxVolume(volume: number) {
    this.prefs.sfxVolume = clamp01(volume);
    this.applyGains();
    this.persist();
    this.emit();
  }

  setMusicVolume(volume: number) {
    this.prefs.musicVolume = clamp01(volume);
    this.applyGains();
    this.persist();
    this.emit();
  }

  /** Alias lama (v1): mengatur efek suara dan musik sekaligus. */
  setVolume(volume: number) {
    this.prefs.sfxVolume = clamp01(volume);
    this.prefs.musicVolume = clamp01(volume);
    this.applyGains();
    this.persist();
    this.emit();
  }

  /* ---------------- primitif ---------------- */

  private tone(
    freq: number,
    start: number,
    duration: number,
    type: OscillatorType = 'sine',
    gain = 0.25,
    slideTo?: number,
    bus?: GainNode | null,
  ) {
    const out = bus ?? this.sfxBus;
    if (!this.ctx || !out) return;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), start + duration);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(amp);
    amp.connect(out);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  private noise(start: number, duration: number, gain = 0.15, highpass = 1200) {
    if (!this.ctx || !this.sfxBus) return;
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = highpass;
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(gain, start);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(amp);
    amp.connect(this.sfxBus);
    source.start(start);
  }

  /* ---------------- efek ---------------- */

  play(name: Sfx) {
    if (!this.ctx || !this.sfxBus || this.prefs.muted) return;
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    const t = this.ctx.currentTime + 0.01;
    switch (name) {
      case 'select':
        this.tone(midi(76), t, 0.08, 'triangle', 0.18);
        break;
      case 'join':
        this.tone(midi(72), t, 0.1, 'sine', 0.2);
        this.tone(midi(79), t + 0.07, 0.14, 'sine', 0.18);
        break;
      case 'tick':
        this.tone(midi(88), t, 0.05, 'square', 0.07);
        break;
      case 'countdown':
        this.tone(midi(69), t, 0.18, 'triangle', 0.3);
        break;
      case 'go':
        this.tone(midi(81), t, 0.45, 'triangle', 0.32);
        this.tone(midi(88), t, 0.45, 'sine', 0.18);
        break;
      case 'start':
        [64, 67, 71, 76].forEach((n, i) => this.tone(midi(n), t + i * 0.07, 0.22, 'triangle', 0.22));
        break;
      case 'timeUp':
        this.tone(midi(60), t, 0.35, 'sawtooth', 0.16, midi(48));
        this.noise(t, 0.2, 0.08, 800);
        break;
      case 'correct':
        [72, 76, 79, 84].forEach((n, i) => this.tone(midi(n), t + i * 0.08, 0.28, 'triangle', 0.24));
        break;
      case 'wrong':
        this.tone(midi(55), t, 0.32, 'sawtooth', 0.14, midi(45));
        this.tone(midi(52), t + 0.14, 0.4, 'sawtooth', 0.12, midi(40));
        break;
      case 'points':
        for (let i = 0; i < 6; i += 1) this.tone(midi(84 + (i % 3) * 4), t + i * 0.045, 0.1, 'sine', 0.12);
        break;
      case 'reveal':
        this.noise(t, 0.25, 0.1, 3000);
        this.tone(midi(67), t + 0.1, 0.3, 'triangle', 0.2);
        break;
      case 'rankUp':
        this.tone(midi(64), t, 0.12, 'triangle', 0.2, midi(76));
        break;
      case 'drumroll': {
        for (let i = 0; i < 28; i += 1) this.noise(t + i * 0.055, 0.05, 0.06 + i * 0.004, 400);
        break;
      }
      case 'fanfare': {
        const notes: Array<[number, number, number]> = [
          [67, 0, 0.18],
          [67, 0.2, 0.18],
          [67, 0.4, 0.18],
          [72, 0.6, 0.5],
          [76, 1.15, 0.2],
          [79, 1.4, 0.7],
          [84, 2.1, 0.9],
        ];
        notes.forEach(([n, at, dur]) => {
          this.tone(midi(n), t + at, dur, 'triangle', 0.26);
          this.tone(midi(n - 12), t + at, dur, 'sine', 0.2);
        });
        break;
      }
      case 'avatarPick':
        this.tone(midi(79), t, 0.09, 'sine', 0.16);
        this.tone(midi(86), t + 0.06, 0.16, 'sine', 0.14);
        break;
      case 'reaction':
        // "pop" lembut dan pendek; sengaja pelan agar tidak mengganggu banyak reaksi sekaligus.
        this.tone(midi(83), t, 0.07, 'sine', 0.08, midi(95));
        break;
      case 'whoosh':
        this.noise(t, 0.28, 0.07, 1800);
        this.tone(midi(55), t, 0.28, 'sine', 0.06, midi(79));
        break;
      case 'podiumRise':
        this.tone(midi(48), t, 0.55, 'sawtooth', 0.1, midi(72));
        this.noise(t, 0.5, 0.05, 600);
        break;
      case 'trophy':
        [88, 91, 95, 100].forEach((n, i) => this.tone(midi(n), t + i * 0.09, 0.4, 'sine', 0.09));
        break;
      case 'streak':
        [72, 76, 79, 84, 88].forEach((n, i) => this.tone(midi(n), t + i * 0.055, 0.16, 'triangle', 0.16));
        break;
    }
  }

  /* ---------------- musik latar (loop pendek buatan sendiri) ---------------- */

  startMusic(mode: MusicMode) {
    if (!this.ctx || !this.musicBus) return;
    if (this.musicMode === mode && this.musicTimer !== null) return;
    this.stopMusic();
    this.musicMode = mode;
    this.step = 0;
    this.nextStepTime = this.ctx.currentTime + 0.1;
    const schedule = () => {
      if (!this.ctx || !this.musicBus || !this.musicMode) return;
      const cfg = MUSIC[this.musicMode];
      const stepLen = 60 / cfg.bpm / 2;
      while (this.nextStepTime < this.ctx.currentTime + 0.35) {
        const bar = Math.floor(this.step / 8) % cfg.roots.length;
        const inBar = this.step % 8;
        const root = cfg.roots[bar]!;
        if (inBar === 0 || inBar === 4) this.tone(midi(root - 12), this.nextStepTime, stepLen * 3.5, 'sine', cfg.gain * 0.9, undefined, this.musicBus);
        this.tone(midi(root + cfg.arpOctave + cfg.arp[inBar]!), this.nextStepTime, stepLen * 0.9, cfg.wave, cfg.gain * 0.5, undefined, this.musicBus);
        this.nextStepTime += stepLen;
        this.step += 1;
      }
    };
    schedule();
    this.musicTimer = window.setInterval(schedule, 120);
  }

  stopMusic() {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.musicMode = null;
  }
}

export const liveAudio = new LiveAudio();
