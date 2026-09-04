import { describe, expect, it } from 'vitest';
import { pickStatusMessage } from './statusMessage';
import type { StatusMessageKey } from '../config';

const ALL: readonly StatusMessageKey[] = ['muted', 'ready', 'downloading', 'version'];

const none = { downloading: false, ready: false, muted: false };

describe('pickStatusMessage', () => {
  it('falls back to version when nothing else is active', () => {
    expect(pickStatusMessage(ALL, none)).toBe('version');
  });

  it('returns the first active message in priority order', () => {
    expect(pickStatusMessage(ALL, { ...none, muted: true })).toBe('muted');
    expect(pickStatusMessage(ALL, { ...none, ready: true })).toBe('ready');
    expect(pickStatusMessage(ALL, { ...none, downloading: true })).toBe('downloading');
  });

  it('prefers muted over ready and downloading when muted is on top', () => {
    expect(pickStatusMessage(ALL, { downloading: true, ready: true, muted: true })).toBe('muted');
  });

  it('honours the configured order when it differs', () => {
    const order: readonly StatusMessageKey[] = ['ready', 'downloading', 'muted', 'version'];
    expect(pickStatusMessage(order, { downloading: true, ready: false, muted: true })).toBe(
      'downloading',
    );
    expect(pickStatusMessage(order, { downloading: true, ready: true, muted: true })).toBe('ready');
  });

  it('respects a version entry placed above other messages', () => {
    const order: readonly StatusMessageKey[] = ['version', 'muted'];
    expect(pickStatusMessage(order, { ...none, muted: true })).toBe('version');
  });

  it('returns version for an empty priority list', () => {
    expect(pickStatusMessage([], none)).toBe('version');
  });
});
