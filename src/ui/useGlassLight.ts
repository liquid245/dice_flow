import { useEffect } from 'react';

const hasFinePointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function setGlobalAngle(angle: number): void {
  document.documentElement.style.setProperty('--glass-angle', `${angle.toFixed(1)}deg`);
}

function useMouseLight(): void {
  useEffect(() => {
    if (!hasFinePointer() || prefersReducedMotion()) return;

    let rafId = 0;
    let pendingAngle: number | null = null;
    let lastAngle: number | null = null;

    const apply = () => {
      rafId = 0;
      if (pendingAngle === null) return;
      const angle = pendingAngle;
      pendingAngle = null;
      if (angle === lastAngle) return;
      lastAngle = angle;
      setGlobalAngle(angle);
    };

    const onMove = (event: PointerEvent) => {
      const dx = event.clientX - window.innerWidth / 2;
      const dy = event.clientY - window.innerHeight / 2;
      pendingAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
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
    let pendingAngle: number | null = null;
    let lastAngle: number | null = null;
    let granted = false;
    let listening = false;
    let disposed = false;

    const apply = () => {
      rafId = 0;
      if (pendingAngle === null) return;
      const angle = pendingAngle;
      pendingAngle = null;
      if (angle === lastAngle) return;
      lastAngle = angle;
      setGlobalAngle(angle);
    };

    const schedule = (event: DeviceOrientationEvent) => {
      if (event.beta === null || event.gamma === null) return;
      pendingAngle = (Math.atan2(event.beta, event.gamma) * 180) / Math.PI;
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
      pendingAngle = null;
    };

    const enable = () => {
      granted = true;
      if (document.visibilityState !== 'visible' || prefersReducedMotion()) return;
      start();
    };

    const orientation = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    const needsPermission = typeof orientation.requestPermission === 'function';

    const onProbe = (event: DeviceOrientationEvent) => {
      if (event.beta === null || event.gamma === null) return;
      window.removeEventListener('deviceorientation', onProbe);
      window.removeEventListener('deviceorientationabsolute', onProbe);
      document.removeEventListener('click', onFirstTap);
      enable();
    };

    const onFirstTap = () => {
      document.removeEventListener('click', onFirstTap);
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

    if (needsPermission) {
      window.addEventListener('deviceorientation', onProbe);
      window.addEventListener('deviceorientationabsolute', onProbe);
      document.addEventListener('click', onFirstTap);
    } else {
      enable();
    }
    document.addEventListener('visibilitychange', onVisibility);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    reduced.addEventListener('change', onReducedChange);

    return () => {
      disposed = true;
      window.removeEventListener('deviceorientation', onProbe);
      window.removeEventListener('deviceorientationabsolute', onProbe);
      document.removeEventListener('click', onFirstTap);
      document.removeEventListener('visibilitychange', onVisibility);
      reduced.removeEventListener('change', onReducedChange);
      stop();
    };
  }, []);
}

export function useGlassLight() {
  useMouseLight();
  useGyroLight();
}
