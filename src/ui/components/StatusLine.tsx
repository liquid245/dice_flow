import { useEffect, useState } from 'react';

type MemoryInfo = { usedJSHeapSize: number } | undefined;

function readMemory(): number | null {
  const memory = (performance as unknown as { memory?: MemoryInfo }).memory;
  return memory ? memory.usedJSHeapSize : null;
}

export function StatusLine() {
  const [fps, setFps] = useState(0);
  const [memory, setMemory] = useState<number | null>(null);

  useEffect(() => {
    let frames = 0;
    let last = performance.now();
    let rafId = 0;
    const loop = (now: number) => {
      frames += 1;
      if (now - last >= 1000) {
        setFps(frames);
        frames = 0;
        last = now;
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    const sample = () => setMemory(readMemory());
    sample();
    const id = window.setInterval(sample, 2000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="status-line">
      <span>{__APP_VERSION__}</span>
      <span> · {fps} FPS</span>
      {memory !== null && <span> · {Math.round(memory / 1024 / 1024)} MB</span>}
    </div>
  );
}
