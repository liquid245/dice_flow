export type InstallMode = 'installed' | 'installable' | 'instructions' | 'unsupported';

export type InstallGuide = 'ios' | 'safari-macos' | 'firefox-android';

function isChromium(ua: string): boolean {
  return /Chrome|Edg\//i.test(ua) || /CriOS|EdgiOS|OPiOS/i.test(ua);
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

export function detectInstallMode(
  ua: string,
  standalone: boolean,
  hasBip: boolean,
): InstallMode {
  if (standalone) return 'installed';
  if (hasBip) return 'installable';
  return detectGuide(ua) ? 'instructions' : 'unsupported';
}
