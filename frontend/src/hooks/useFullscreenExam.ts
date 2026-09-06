import { useCallback, useEffect, useRef, useState } from 'react';

type FullscreenExamOptions = {
  active: boolean;
};

type DocumentWithWebkit = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type HTMLElementWithWebkit = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export function getDocumentFullscreenElement(): Element | null {
  if (typeof document === 'undefined') return null;
  const doc = document as DocumentWithWebkit;
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

export function isDocumentFullscreen(): boolean {
  return Boolean(getDocumentFullscreenElement());
}

function supportsFullscreenApi(): boolean {
  if (typeof document === 'undefined') return false;
  const element = document.documentElement as HTMLElementWithWebkit;
  if (!element.requestFullscreen && !element.webkitRequestFullscreen) {
    return false;
  }
  if (typeof navigator === 'undefined') {
    return true;
  }
  const isIosDevice =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return !isIosDevice;
}

async function requestElementFullscreen(element: HTMLElementWithWebkit): Promise<void> {
  if (element.requestFullscreen) {
    await element.requestFullscreen();
    return;
  }
  if (element.webkitRequestFullscreen) {
    await element.webkitRequestFullscreen();
    return;
  }
  throw new Error('Fullscreen API tidak tersedia');
}

async function exitDocumentFullscreen(): Promise<void> {
  if (!isDocumentFullscreen()) return;
  const doc = document as DocumentWithWebkit;
  if (document.exitFullscreen) {
    await document.exitFullscreen();
    return;
  }
  if (doc.webkitExitFullscreen) {
    await doc.webkitExitFullscreen();
  }
}

export function useFullscreenExam({ active }: FullscreenExamOptions) {
  const violationRef = useRef<((reason: string) => void) | null>(null);
  const supportsFullscreen = supportsFullscreenApi();
  const [isFullscreen, setIsFullscreen] = useState(() => isDocumentFullscreen());

  const setViolationHandler = useCallback((handler: ((reason: string) => void) | null) => {
    violationRef.current = handler;
  }, []);

  const request = useCallback(async () => {
    if (!supportsFullscreen) return false;
    if (isDocumentFullscreen()) {
      setIsFullscreen(true);
      return true;
    }
    const element = document.documentElement as HTMLElementWithWebkit;
    await requestElementFullscreen(element);
    // Beberapa browser menerapkan fullscreen secara async setelah promise resolve.
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 50);
    });
    const ok = isDocumentFullscreen();
    setIsFullscreen(ok);
    if (!ok) {
      throw new Error('Permintaan layar penuh tidak berhasil');
    }
    return true;
  }, [supportsFullscreen]);

  const exit = useCallback(async () => {
    try {
      await exitDocumentFullscreen();
    } finally {
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    if (!supportsFullscreen) return undefined;

    const sync = () => setIsFullscreen(isDocumentFullscreen());
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync as EventListener);
    sync();
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync as EventListener);
    };
  }, [supportsFullscreen]);

  useEffect(() => {
    if (!active) return undefined;

    const handleViolation = (reason: string) => {
      violationRef.current?.(reason);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        handleViolation('Berpindah tab/ aplikasi lain');
      }
    };

    const handleBlur = () => {
      handleViolation('Menjeda layar / membuka jendela lain');
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    if (supportsFullscreen) {
      const ensureFullscreen = () => {
        if (!isDocumentFullscreen()) {
          handleViolation('Keluar dari layar penuh');
        }
      };
      document.addEventListener('fullscreenchange', ensureFullscreen);
      document.addEventListener('webkitfullscreenchange', ensureFullscreen as EventListener);
      return () => {
        document.removeEventListener('visibilitychange', handleVisibility);
        document.removeEventListener('fullscreenchange', ensureFullscreen);
        document.removeEventListener('webkitfullscreenchange', ensureFullscreen as EventListener);
        window.removeEventListener('blur', handleBlur);
      };
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
    };
  }, [active, supportsFullscreen]);

  return {
    request,
    exit,
    setViolationHandler,
    isSupported: supportsFullscreen,
    isFullscreen,
  };
}
