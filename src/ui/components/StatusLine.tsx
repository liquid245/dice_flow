import { useEffect, useState } from 'react';
import { usePwaUpdate } from '../../app/usePwaUpdate';

type MemoryInfo = { usedJSHeapSize: number } | undefined;

function readMemory(): number | null {
  const memory = (performance as unknown as { memory?: MemoryInfo }).memory;
  return memory ? memory.usedJSHeapSize : null;
}

const DEBUG = import.meta.env.DEV;

export function StatusLine() {
  const [fps, setFps] = useState(0);
  const [memory, setMemory] = useState<number | null>(null);
  const { status, progress } = usePwaUpdate();

  useEffect(() => {
    if (!DEBUG) return;
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
    if (!DEBUG) return;
    const sample = () => setMemory(readMemory());
    sample();
    const id = window.setInterval(sample, 2000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="status-line">
      {status === 'idle' && <span>{__APP_VERSION__}</span>}
      {status === 'downloading' && (
        <span className="update-status">
          <span>Downloading update</span>
          <span className="update-bar">
            <span className="update-bar-fill" style={{ width: `${progress}%` }} />
          </span>
          <span>{progress}%</span>
        </span>
      )}
      {status === 'ready' && <span>New version is ready, reload the page.</span>}
      {DEBUG && <span> · {fps} FPS</span>}
      {DEBUG && memory !== null && <span> · {Math.round(memory / 1024 / 1024)} MB</span>}
    </div>
  );
}
