import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function connectable(): { connect: ReturnType<typeof vi.fn> } {
  return { connect: vi.fn(() => connectable()) };
}

class MockAudioContext {
  state: AudioContextState = 'suspended';
  readonly sampleRate = 44100;
  currentTime = 0;
  readonly destination = {};
  resume = vi.fn(() => {
    this.state = 'running';
    return Promise.resolve();
  });
  createBuffer = vi.fn(() => ({ getChannelData: () => new Float32Array(0) }));
  createBufferSource = vi.fn(() => ({
    buffer: null,
    connect: vi.fn(() => connectable()),
    start: vi.fn(),
  }));
  createGain = vi.fn(() => ({
    gain: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect: vi.fn(() => connectable()),
  }));
  createOscillator = vi.fn(() => ({
    type: '',
    frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect: vi.fn(() => connectable()),
    start: vi.fn(),
    stop: vi.fn(),
  }));
  decodeAudioData = vi.fn(async () => ({}) as AudioBuffer);
}

describe('audio play', () => {
  let audioCtx: MockAudioContext;

  beforeEach(() => {
    vi.useFakeTimers();
    audioCtx = new MockAudioContext();
    vi.stubGlobal('AudioContext', function () {
      return audioCtx;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  async function freshAudio(): Promise<typeof import('./audio')> {
    vi.resetModules();
    return import('./audio');
  }

  it('queues a select click until the context is running', async () => {
    const { play } = await freshAudio();
    play('select');
    expect(audioCtx.createBufferSource).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    expect(audioCtx.createBufferSource).toHaveBeenCalled();
  });

  it('drops sounds queued too long while suspended', async () => {
    audioCtx.resume = vi.fn(() => Promise.resolve());
    const { play } = await freshAudio();
    play('select');
    await vi.advanceTimersByTimeAsync(600);
    audioCtx.state = 'running';
    await vi.advanceTimersByTimeAsync(100);
    expect(audioCtx.createBufferSource).not.toHaveBeenCalled();
  });

  it('plays immediately when the context is already running', async () => {
    audioCtx.state = 'running';
    const { play } = await freshAudio();
    play('select');
    expect(audioCtx.createBufferSource).toHaveBeenCalled();
  });

  it('skips thump when disabled', async () => {
    const { play } = await freshAudio();
    const { config } = await import('../config');
    config.vibration.thump.enabled = false;
    play('thump');
    await vi.advanceTimersByTimeAsync(100);
    expect(audioCtx.createBufferSource).not.toHaveBeenCalled();
  });

  it('preloads and decodes samples via OfflineAudioContext', async () => {
    const decode = vi.fn(async () => ({}) as AudioBuffer);
    vi.stubGlobal(
      'OfflineAudioContext',
      function () {
        return { decodeAudioData: decode };
      } as unknown as typeof OfflineAudioContext,
    );
    vi.stubGlobal('fetch', vi.fn(async () => ({ arrayBuffer: async () => new ArrayBuffer(8) })) as unknown as typeof fetch);
    const { preloadSounds, play } = await freshAudio();
    preloadSounds();
    await vi.advanceTimersByTimeAsync(50);
    expect(decode).toHaveBeenCalledTimes(3);
    audioCtx.state = 'running';
    play('appear');
    expect(audioCtx.createBufferSource).toHaveBeenCalled();
  });
});

describe('audio muted state', () => {
  let audioCtx: MockAudioContext;

  beforeEach(() => {
    vi.useFakeTimers();
    audioCtx = new MockAudioContext();
    vi.stubGlobal('AudioContext', function () {
      return audioCtx;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  async function freshAudio(): Promise<typeof import('./audio')> {
    vi.resetModules();
    return import('./audio');
  }

  it('is muted until a context exists and while it is suspended', async () => {
    const { isAudioMuted, probeAudio } = await freshAudio();
    expect(isAudioMuted()).toBe(true);
    probeAudio();
    expect(isAudioMuted()).toBe(true);
    audioCtx.state = 'running';
    expect(isAudioMuted()).toBe(false);
  });

  it('unlocks on the first gesture and notifies subscribers', async () => {
    const handlers = new Map<string, Array<() => void>>();
    vi.stubGlobal('window', {
      addEventListener: vi.fn((type: string, handler: () => void) => {
        const list = handlers.get(type) ?? [];
        list.push(handler);
        handlers.set(type, list);
      }),
    });

    audioCtx.resume = vi.fn(() => {
      audioCtx.state = 'running';
      const onstate = (audioCtx as unknown as { onstatechange?: () => void }).onstatechange;
      onstate?.();
      return Promise.resolve();
    });

    const { probeAudio, unlockAudio, subscribeAudioState, isAudioMuted } = await freshAudio();
    probeAudio();
    const states: boolean[] = [];
    const unsubscribe = subscribeAudioState(() => states.push(isAudioMuted()));

    unlockAudio();
    const pointerDown = handlers.get('pointerdown');
    expect(pointerDown).toBeDefined();
    pointerDown?.[0]();

    expect(audioCtx.state).toBe('running');
    expect(isAudioMuted()).toBe(false);
    expect(states).toContain(false);
    unsubscribe();
  });
});
