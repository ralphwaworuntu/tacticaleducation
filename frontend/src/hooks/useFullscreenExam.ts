import { useCallback, useEffect, useRef } from 'react';

type FullscreenExamOptions = {
  active: boolean;
};

export function useFullscreenExam({ active }: FullscreenExamOptions) {
  const violationRef = useRef<((reason: string) => void) | null>(null);
  const supportsFullscreen = (() => {
    if (typeof document === 'undefined' || !document.documentElement?.requestFullscreen) {
      return false;
    }
    if (typeof navigator === 'undefined') {
      return true;
    }
    const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return !isIosDevice;
  })();

  const setViolationHandler = useCallback((handler: ((reason: string) => void) | null) => {
    violationRef.current = handler;
  }, []);

  const request = useCallback(async () => {
    if (!supportsFullscreen) return;
    if (document.fullscreenElement) return;
    const element = document.documentElement;
    if (element.requestFullscreen) {
      await element.requestFullscreen();
    }
  }, [supportsFullscreen]);

  const exit = useCallback(async () => {
    if (document.fullscreenElement && document.exitFullscreen) {
      await document.exitFullscreen();
    }
  }, []);

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
        if (!document.fullscreenElement) {
          handleViolation('Keluar dari layar penuh');
        }
      };
      document.addEventListener('fullscreenchange', ensureFullscreen);
      return () => {
        document.removeEventListener('visibilitychange', handleVisibility);
        document.removeEventListener('fullscreenchange', ensureFullscreen);
        window.removeEventListener('blur', handleBlur);
      };
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
    };
  }, [active, supportsFullscreen]);

  return { request, exit, setViolationHandler, isSupported: supportsFullscreen };
}
