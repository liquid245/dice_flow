import { useEffect, useState, useSyncExternalStore } from 'react';
import { useGame } from '../../app/game';
import { usePwaUpdate } from '../../app/usePwaUpdate';
import { isAudioMuted, subscribeAudioState } from '../../services/audio';
import { detectAudioUnlock } from '../../install/detect';
import { config } from '../../config';
import { pickStatusMessage, type StatusMessageActivity } from '../statusMessage';

type MemoryInfo = { usedJSHeapSize: number } | undefined;

function readMemory(): number | null {
  const memory = (performance as unknown as { memory?: MemoryInfo }).memory;
  return memory ? memory.usedJSHeapSize : null;
}

const DEBUG = import.meta.env.DEV;

function selectionKey(selection: { kind: string; ids?: ReadonlySet<string>; min?: number; max?: number }): string {
  if (selection.kind === 'ids' && selection.ids) {
    return `ids:${Array.from(selection.ids).sort().join(',')}`;
  }
  if (selection.kind === 'range') {
    return `range:${selection.min}-${selection.max}`;
  }
  return 'none';
}

function SelectionCountdownBar({ durationMs }: { durationMs: number }) {
  const [pct, setPct] = useState(100);

  useEffect(() => {
    if (durationMs <= 0) return;
    let rafId = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const remaining = Math.max(0, 1 - (now - start) / durationMs);
      setPct(remaining * 100);
      if (remaining > 0) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [durationMs]);

  return (
    <span className="update-bar">
      <span className="update-bar-fill" style={{ width: `${pct}%` }} />
    </span>
  );
}

export function StatusLine() {
  const [fps, setFps] = useState(0);
  const [memory, setMemory] = useState<number | null>(null);
  const { state } = useGame();
  const { status, progress } = usePwaUpdate();
  const audioMuted = useSyncExternalStore(subscribeAudioState, isAudioMuted);
  const unlock = detectAudioUnlock(navigator.userAgent);

  const hasSelection = state.selection.kind !== 'none';

  const active: StatusMessageActivity = {
    downloading: status === 'downloading',
    ready: status === 'ready',
    muted: unlock === 'tap' && audioMuted,
    selection: hasSelection,
  };
  const message = pickStatusMessage(config.ui.statusLine.priority, active);

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
      {message === 'selection' && (
        <SelectionCountdownBar
          key={selectionKey(state.selection)}
          durationMs={config.renderer.shake.durationMs}
        />
      )}
      {message === 'muted' && <span>Tap the screen to enable sound.</span>}
      {message === 'version' && <span>{__APP_VERSION__}</span>}
      {message === 'downloading' && (
        <span className="update-status">
          <span>Downloading update</span>
          <span className="update-bar">
            <span className="update-bar-fill" style={{ width: `${progress}%` }} />
          </span>
          <span>{progress}%</span>
        </span>
      )}
      {message === 'ready' && <span>New version is ready, reload the page.</span>}
      {DEBUG && <span> · {fps} FPS</span>}
      {DEBUG && memory !== null && <span> · {Math.round(memory / 1024 / 1024)} MB</span>}
    </div>
  );
}
