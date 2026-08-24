import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../config';
import { playThump } from './audio';
import { vibrate, vibrateSessionStart, vibrateSessionStop } from './vibration';

vi.mock('./audio', () => ({ playThump: vi.fn() }));

describe('vibration', () => {
  const vibrateMock = vi.fn<() => boolean>();

  beforeEach(() => {
    vi.stubGlobal('navigator', { vibrate: vibrateMock });
    vi.useFakeTimers();
    vibrateMock.mockClear();
    config.vibration.enabled = true;
    config.vibration.session.enabled = true;
  });

  afterEach(() => {
    vibrateSessionStop();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('vibrate plays the configured pattern', () => {
    vibrate('roll');
    expect(vibrateMock).toHaveBeenCalledWith(config.vibration.patterns.roll);
  });

  it('vibrate skips when disabled', () => {
    config.vibration.enabled = false;
    vibrate('select');
    expect(vibrateMock).not.toHaveBeenCalled();
  });

  it('session repeats bursts on an interval and stops on stop()', () => {
    vibrateSessionStart();
    expect(vibrateMock).toHaveBeenLastCalledWith(config.vibration.session.burstMs);
    const count = vibrateMock.mock.calls.length;
    vi.advanceTimersByTime(3 * config.vibration.session.intervalMs);
    expect(vibrateMock.mock.calls.length).toBe(count + 3);
    vibrateSessionStop();
    expect(vibrateMock).toHaveBeenLastCalledWith(0);
    const after = vibrateMock.mock.calls.length;
    vi.advanceTimersByTime(10 * config.vibration.session.intervalMs);
    expect(vibrateMock.mock.calls.length).toBe(after);
  });

  it('session start is idempotent', () => {
    vibrateSessionStart();
    vibrateSessionStart();
    vi.advanceTimersByTime(config.vibration.session.intervalMs);
    expect(vibrateMock.mock.calls.length).toBe(2);
  });

  it('session does nothing when session disabled', () => {
    config.vibration.session.enabled = false;
    vibrateSessionStart();
    vi.advanceTimersByTime(3 * config.vibration.session.intervalMs);
    expect(vibrateMock).not.toHaveBeenCalled();
  });
});

describe('vibration fallback to audio thump', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { vibrate: undefined });
    vi.useFakeTimers();
    vi.mocked(playThump).mockClear();
    config.vibration.enabled = true;
    config.vibration.thump.enabled = true;
  });

  afterEach(() => {
    vibrateSessionStop();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('plays a thump when vibration is unsupported', () => {
    vibrate('roll');
    expect(playThump).toHaveBeenCalledTimes(1);
  });

  it('plays a thump alongside vibration when sound is requested', () => {
    const supportedVibrate = vi.fn<() => boolean>();
    vi.stubGlobal('navigator', { vibrate: supportedVibrate });
    vibrate('select', { sound: true });
    expect(supportedVibrate).toHaveBeenCalled();
    expect(playThump).toHaveBeenCalledTimes(1);
  });

  it('does not play a thump when vibration is supported', () => {
    const supportedVibrate = vi.fn<() => boolean>();
    vi.stubGlobal('navigator', { vibrate: supportedVibrate });
    vibrate('roll');
    expect(supportedVibrate).toHaveBeenCalled();
    expect(playThump).not.toHaveBeenCalled();
  });

  it('does not play a thump when vibration is disabled entirely', () => {
    config.vibration.enabled = false;
    vibrate('roll');
    expect(playThump).not.toHaveBeenCalled();
  });

  it('session start is a no-op when unsupported', () => {
    vibrateSessionStart();
    vi.advanceTimersByTime(3 * config.vibration.session.intervalMs);
    expect(playThump).not.toHaveBeenCalled();
  });
});
