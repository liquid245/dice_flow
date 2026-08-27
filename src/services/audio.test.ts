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
});
