import { describe, expect, it } from 'vitest';
import { detectAudioUnlock, detectGuide, detectInstallMode } from './detect';
import { guideText } from './guideText';

const IOS_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const IPAD_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const CR_IOS_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1';
const EDGE_IOS_IPAD =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/120.0.0.0 Mobile/15E148 Safari/604.1';
const MAC_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
const CHROME_ANDROID =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const FIREFOX_ANDROID =
  'Mozilla/5.0 (Android 14; Mobile; rv:120.0) Gecko/120.0 Firefox/120.0';
const CHROME_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FIREFOX_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7; rv:120.0) Gecko/20100101 Firefox/120.0';

describe('detectGuide', () => {
  it('returns ios for iPhone Safari', () => {
    expect(detectGuide(IOS_SAFARI)).toBe('ios');
  });

  it('returns ios for iPad Safari with Macintosh UA', () => {
    expect(detectGuide(IPAD_SAFARI)).toBe('ios');
  });

  it('returns safari-macos for desktop Safari', () => {
    expect(detectGuide(MAC_SAFARI)).toBe('safari-macos');
  });

  it('returns firefox-android for Firefox on Android', () => {
    expect(detectGuide(FIREFOX_ANDROID)).toBe('firefox-android');
  });

  it('returns null for Chrome on Android and macOS', () => {
    expect(detectGuide(CHROME_ANDROID)).toBeNull();
    expect(detectGuide(CHROME_MAC)).toBeNull();
  });

  it('returns null for desktop Firefox', () => {
    expect(detectGuide(FIREFOX_MAC)).toBeNull();
  });
});

describe('detectInstallMode', () => {
  it('returns installed when standalone', () => {
    expect(detectInstallMode(CHROME_ANDROID, true, false)).toBe('installed');
    expect(detectInstallMode(IOS_SAFARI, true, false)).toBe('installed');
  });

  it('returns installable when beforeinstallprompt available', () => {
    expect(detectInstallMode(CHROME_ANDROID, false, true)).toBe('installable');
    expect(detectInstallMode(CHROME_MAC, false, true)).toBe('installable');
  });

  it('returns instructions for iOS Safari without BIP', () => {
    expect(detectInstallMode(IOS_SAFARI, false, false)).toBe('instructions');
  });

  it('returns instructions for desktop Safari without BIP', () => {
    expect(detectInstallMode(MAC_SAFARI, false, false)).toBe('instructions');
  });

  it('returns instructions for Firefox on Android without BIP', () => {
    expect(detectInstallMode(FIREFOX_ANDROID, false, false)).toBe('instructions');
  });

  it('returns unsupported for desktop Firefox', () => {
    expect(detectInstallMode(FIREFOX_MAC, false, false)).toBe('unsupported');
  });
});

describe('guideText', () => {
  it('returns a non-empty string for every guide', () => {
    expect(guideText('ios').length).toBeGreaterThan(0);
    expect(guideText('safari-macos').length).toBeGreaterThan(0);
    expect(guideText('firefox-android').length).toBeGreaterThan(0);
  });
});

describe('detectAudioUnlock', () => {
  it('returns tap for iOS Safari and iPadOS Safari', () => {
    expect(detectAudioUnlock(IOS_SAFARI)).toBe('tap');
    expect(detectAudioUnlock(IPAD_SAFARI)).toBe('tap');
  });

  it('returns tap for iOS Chrome and Edge', () => {
    expect(detectAudioUnlock(CR_IOS_IPHONE)).toBe('tap');
    expect(detectAudioUnlock(EDGE_IOS_IPAD)).toBe('tap');
  });

  it('returns any for desktop and Android browsers', () => {
    expect(detectAudioUnlock(MAC_SAFARI)).toBe('any');
    expect(detectAudioUnlock(CHROME_MAC)).toBe('any');
    expect(detectAudioUnlock(FIREFOX_MAC)).toBe('any');
    expect(detectAudioUnlock(CHROME_ANDROID)).toBe('any');
    expect(detectAudioUnlock(FIREFOX_ANDROID)).toBe('any');
  });
});
