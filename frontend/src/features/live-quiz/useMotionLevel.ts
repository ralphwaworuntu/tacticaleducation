import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { usePrefersReducedMotion } from './useReducedMotion';

/**
 * Tingkat gerak Live Quiz:
 *  - full    : semua animasi (framer-motion spring, confetti, bentuk melayang, blur kaca)
 *  - lite    : animasi esensial saja (tanpa konfeti/blur/bentuk melayang) -- untuk HP lemah
 *  - reduced : hampir tanpa gerak; mengikuti prefers-reduced-motion atau pengaturan sesi
 */
export type MotionLevel = 'full' | 'lite' | 'reduced';
type Pref = 'auto' | 'full' | 'lite';

const KEY = 'tactical-live-motion';
const listeners = new Set<() => void>();

function readPref(): Pref {
  try {
    const value = localStorage.getItem(KEY);
    return value === 'full' || value === 'lite' ? value : 'auto';
  } catch {
    return 'auto';
  }
}

let current: Pref = typeof window === 'undefined' ? 'auto' : readPref();

export const motionPref = {
  get: () => current,
  set(value: Pref) {
    current = value;
    try {
      if (value === 'auto') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, value);
    } catch {
      // abaikan: preferensi hanya berlaku selama halaman terbuka
    }
    listeners.forEach((l) => l());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/** Perangkat lemah (CPU <= 4 inti atau RAM <= 2 GB) otomatis memakai mode lite saat preferensi "auto". */
export function isLowEndDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 8;
  const memory = nav.deviceMemory ?? 8;
  return cores <= 4 || memory <= 2;
}

export function useMotionLevel(animationsEnabled = true) {
  const reducedSystem = usePrefersReducedMotion();
  const pref = useSyncExternalStore(motionPref.subscribe, motionPref.get, () => 'auto' as Pref);
  const level: MotionLevel = useMemo(() => {
    if (reducedSystem || !animationsEnabled) return 'reduced';
    if (pref === 'lite') return 'lite';
    if (pref === 'full') return 'full';
    return isLowEndDevice() ? 'lite' : 'full';
  }, [reducedSystem, animationsEnabled, pref]);

  const setPref = useCallback((value: Pref) => motionPref.set(value), []);
  return {
    level,
    pref,
    setPref,
    /** Animasi framer-motion/transisi bermakna (tidak berlaku pada "reduced"). */
    animate: level !== 'reduced',
    /** Efek dekoratif/berat (konfeti, bentuk melayang, blur, glow berlapis). */
    fancy: level === 'full',
    /** Kelas CSS root: aktifkan penonaktifan animasi dekoratif. */
    rootClass: level === 'full' ? 'lq-root' : 'lq-root lq-lite',
  };
}

/** Pasang atribut data pada <html> agar portal/dialog ikut mode; tidak wajib dipakai. */
export function useMotionAttribute(level: MotionLevel) {
  useEffect(() => {
    document.documentElement.dataset.lqMotion = level;
    return () => {
      delete document.documentElement.dataset.lqMotion;
    };
  }, [level]);
}
