import type { StatusMessageKey } from '../config';

export type StatusMessageActivity = {
  downloading: boolean;
  ready: boolean;
  muted: boolean;
  selection: boolean;
};

// Scans messages in priority order (top = highest) and returns the first one
// that is currently active. "version" is the always-on fallback.
export function pickStatusMessage(
  priority: readonly StatusMessageKey[],
  active: StatusMessageActivity,
): StatusMessageKey {
  for (const key of priority) {
    if (key === 'version') return 'version';
    if (active[key]) return key;
  }
  return 'version';
}
