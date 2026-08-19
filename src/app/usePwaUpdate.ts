import { useEffect, useRef, useState } from 'react';

export type UpdateStatus = 'idle' | 'downloading' | 'ready';

const SW_PATH = `${import.meta.env.BASE_URL}sw.js`;
const CHECK_INTERVAL_MS = 600_000;
const DOWNLOAD_MS = 2500;
const MAX_ESTIMATE = 95;

export function usePwaUpdate() {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [progress, setProgress] = useState(0);
  const downloadingRef = useRef(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;
    let animationFrame = 0;
    let startTime = 0;
    let disposed = false;

    const stopAnimation = () => {
      cancelAnimationFrame(animationFrame);
    };

    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / DOWNLOAD_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      setProgress(Math.min(MAX_ESTIMATE, Math.round(eased * MAX_ESTIMATE)));
      if (t < 1) animationFrame = requestAnimationFrame(tick);
    };

    const finishDownload = () => {
      if (!downloadingRef.current) return;
      stopAnimation();
      downloadingRef.current = false;
      setProgress(100);
      setStatus('ready');
    };

    const onUpdateFound = (reg: ServiceWorkerRegistration) => {
      if (!navigator.serviceWorker.controller || downloadingRef.current) return;
      const newWorker = reg.installing;
      if (!newWorker) return;
      downloadingRef.current = true;
      setProgress(0);
      setStatus('downloading');
      startTime = performance.now();
      animationFrame = requestAnimationFrame(tick);
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed') finishDownload();
      });
    };

    const check = async () => {
      if (!registration || disposed) return;
      try {
        await registration.update();
      } catch {
        // ignore offline / unsupported checks
      }
    };

    navigator.serviceWorker
      .register(SW_PATH)
      .then((reg) => {
        if (disposed) return;
        registration = reg;
        reg.addEventListener('updatefound', () => onUpdateFound(reg));
        void check();
      })
      .catch(() => {
        // SW unsupported or failed to register; keep idle
      });

    const visibilityHandler = () => {
      if (document.visibilityState === 'visible') void check();
    };
    const onlineHandler = () => void check();
    document.addEventListener('visibilitychange', visibilityHandler);
    window.addEventListener('online', onlineHandler);
    const interval = window.setInterval(() => void check(), CHECK_INTERVAL_MS);

    return () => {
      disposed = true;
      stopAnimation();
      document.removeEventListener('visibilitychange', visibilityHandler);
      window.removeEventListener('online', onlineHandler);
      window.clearInterval(interval);
    };
  }, []);

  return { status, progress };
}
