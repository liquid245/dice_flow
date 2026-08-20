import { useEffect } from 'react';

const TILT_RANGE = 30;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function setTilt(x: number, y: number): void {
  const style = document.documentElement.style;
  style.setProperty('--glass-tilt-x', x.toFixed(3));
  style.setProperty('--glass-tilt-y', y.toFixed(3));
}

export function useDeviceTilt() {
  useEffect(() => {
    if (!('DeviceOrientationEvent' in window)) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduced.matches) return;

    let rafId = 0;
    let pending: DeviceOrientationEvent | null = null;
    let lastX = 0.5;
    let lastY = 0.5;
    let granted = false;
    let listening = false;

    const apply = () => {
      rafId = 0;
      if (!pending) return;
      const event = pending;
      pending = null;
      if (event.beta === null || event.gamma === null) return;
      const x = clamp01((event.gamma + TILT_RANGE) / (TILT_RANGE * 2));
      const y = clamp01((event.beta + TILT_RANGE) / (TILT_RANGE * 2));
      if (x === lastX && y === lastY) return;
      lastX = x;
      lastY = y;
      setTilt(x, y);
    };

    const schedule = (event: DeviceOrientationEvent) => {
      pending = event;
      if (!rafId) rafId = requestAnimationFrame(apply);
    };

    const start = () => {
      if (listening) return;
      listening = true;
      window.addEventListener('deviceorientation', schedule);
    };

    const stop = () => {
      window.removeEventListener('deviceorientation', schedule);
      listening = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      pending = null;
    };

    const enable = () => {
      granted = true;
      if (document.visibilityState !== 'visible' || reduced.matches) return;
      start();
    };

    const onFirstTap = () => {
      window.removeEventListener('pointerdown', onFirstTap);
      const orientation = DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<'granted' | 'denied'>;
      };
      if (typeof orientation.requestPermission === 'function') {
        orientation
          .requestPermission()
          .then((state) => {
            if (state === 'granted') enable();
          })
          .catch(() => {});
      } else {
        enable();
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (granted && !reduced.matches) start();
      } else {
        stop();
      }
    };

    const onReducedChange = () => {
      if (reduced.matches) stop();
    };

    window.addEventListener('pointerdown', onFirstTap);
    document.addEventListener('visibilitychange', onVisibility);
    reduced.addEventListener('change', onReducedChange);

    return () => {
      window.removeEventListener('pointerdown', onFirstTap);
      document.removeEventListener('visibilitychange', onVisibility);
      reduced.removeEventListener('change', onReducedChange);
      stop();
    };
  }, []);
}
