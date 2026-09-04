export type InstallMode = 'installed' | 'installable' | 'instructions' | 'unsupported';

export type InstallGuide = 'ios' | 'safari-macos' | 'firefox-android';

export type AudioUnlockKind = 'tap' | 'any';

function isChromium(ua: string): boolean {
  return /Chrome|Edg\//i.test(ua) || /CriOS|EdgiOS|OPiOS/i.test(ua);
}

export function isIosWebKit(ua: string): boolean {
  if (/iphone|ipod|ipad/i.test(ua)) return true;
  if (/CriOS|EdgiOS|OPiOS/i.test(ua)) return true;
  return /Macintosh/i.test(ua) && /Mobile/i.test(ua) && /Safari/i.test(ua) && !isChromium(ua);
}

export function detectGuide(ua: string): InstallGuide | null {
  if (/iphone|ipod/i.test(ua)) return 'ios';
  if (/Macintosh/i.test(ua) && /Mobile/i.test(ua) && /Safari/i.test(ua) && !isChromium(ua)) {
    return 'ios';
  }
  if (/Macintosh/i.test(ua) && /Safari/i.test(ua) && !/Mobile/i.test(ua) && !isChromium(ua)) {
    return 'safari-macos';
  }
  if (/Android/i.test(ua) && /Firefox/i.test(ua)) return 'firefox-android';
  return null;
}

// On WebKit-based iOS audio only unlocks after a completed tap. On every other
// platform any ordinary interaction (or no gesture at all for an installed
// Chrome PWA) is enough, so no hint is needed.
export function detectAudioUnlock(ua: string): AudioUnlockKind {
  return isIosWebKit(ua) ? 'tap' : 'any';
}

export function detectInstallMode(
  ua: string,
  standalone: boolean,
  hasBip: boolean,
): InstallMode {
  if (standalone) return 'installed';
  if (hasBip) return 'installable';
  return detectGuide(ua) ? 'instructions' : 'unsupported';
}
