import { useEffect } from 'react';

const TILT_RANGE = 30;

const hasFinePointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function setGlobalTilt(x: number, y: number): void {
  const style = document.documentElement.style;
  style.setProperty('--glass-tilt-x', x.toFixed(3));
  style.setProperty('--glass-tilt-y', y.toFixed(3));
}

function useMouseLight(): void {
  useEffect(() => {
    if (!hasFinePointer() || prefersReducedMotion()) return;

    let rafId = 0;
    let pendingX = 0.5;
    let pendingY = 0.5;
    let lastX = 0.5;
    let lastY = 0.5;
    let hasPending = false;

    const apply = () => {
      rafId = 0;
      if (!hasPending) return;
      hasPending = false;
      if (pendingX === lastX && pendingY === lastY) return;
      lastX = pendingX;
      lastY = pendingY;
      setGlobalTilt(pendingX, pendingY);
    };

    const onMove = (event: PointerEvent) => {
      pendingX = clamp01(event.clientX / window.innerWidth);
      pendingY = clamp01(event.clientY / window.innerHeight);
      hasPending = true;
      if (!rafId) rafId = requestAnimationFrame(apply);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);
}

function useGyroLight(): void {
  useEffect(() => {
    if (hasFinePointer()) return;
    if (!('DeviceOrientationEvent' in window)) return;
    if (prefersReducedMotion()) return;

    let rafId = 0;
    let pending: DeviceOrientationEvent | null = null;
    let lastX = 0.5;
    let lastY = 0.5;
    let granted = false;
    let listening = false;
    let disposed = false;

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
      setGlobalTilt(x, y);
    };

    const schedule = (event: DeviceOrientationEvent) => {
      pending = event;
      if (!rafId) rafId = requestAnimationFrame(apply);
    };

    const start = () => {
      if (listening) return;
      listening = true;
      window.addEventListener('deviceorientation', schedule);
      window.addEventListener('deviceorientationabsolute', schedule);
    };

    const stop = () => {
      window.removeEventListener('deviceorientation', schedule);
      window.removeEventListener('deviceorientationabsolute', schedule);
      listening = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      pending = null;
    };

    const enable = () => {
      granted = true;
      if (document.visibilityState !== 'visible' || prefersReducedMotion()) return;
      start();
    };

    const onFirstTap = () => {
      document.removeEventListener('click', onFirstTap);
      const orientation = DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<'granted' | 'denied'>;
      };
      if (typeof orientation.requestPermission === 'function') {
        orientation
          .requestPermission()
          .then((state) => {
            if (state === 'granted' && !disposed) enable();
          })
          .catch(() => {});
      } else {
        enable();
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (granted && !prefersReducedMotion()) start();
      } else {
        stop();
      }
    };

    const onReducedChange = () => {
      if (prefersReducedMotion()) stop();
    };

    document.addEventListener('click', onFirstTap);
    document.addEventListener('visibilitychange', onVisibility);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    reduced.addEventListener('change', onReducedChange);

    return () => {
      disposed = true;
      document.removeEventListener('click', onFirstTap);
      document.removeEventListener('visibilitychange', onVisibility);
      reduced.removeEventListener('change', onReducedChange);
      stop();
    };
  }, []);
}

function useHoverGlint(): void {
  useEffect(() => {
    if (!hasFinePointer() || prefersReducedMotion()) return;

    let rafId = 0;
    let pendingBtn: HTMLButtonElement | null = null;
    let pendingX = 0.5;
    let pendingY = 0.5;
    let hasPending = false;

    const apply = () => {
      rafId = 0;
      if (!hasPending || !pendingBtn) return;
      hasPending = false;
      pendingBtn.style.setProperty('--glass-mx', `${(pendingX * 100).toFixed(1)}%`);
      pendingBtn.style.setProperty('--glass-my', `${(pendingY * 100).toFixed(1)}%`);
    };

    const onMove = (event: PointerEvent) => {
      const target = event.target as Element | null;
      const btn = target?.closest?.('.action-bar button');
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      pendingX = clamp01((event.clientX - rect.left) / rect.width);
      pendingY = clamp01((event.clientY - rect.top) / rect.height);
      pendingBtn = btn as HTMLButtonElement;
      hasPending = true;
      if (!rafId) rafId = requestAnimationFrame(apply);
    };

    const onOut = (event: PointerEvent) => {
      const target = event.target as Element | null;
      const btn = target?.closest?.('.action-bar button') as HTMLButtonElement | null;
      if (!btn) return;
      btn.style.setProperty('--glass-mx', '50%');
      btn.style.setProperty('--glass-my', '50%');
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerout', onOut, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerout', onOut);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);
}

export function useGlassLight() {
  useMouseLight();
  useGyroLight();
  useHoverGlint();
}
