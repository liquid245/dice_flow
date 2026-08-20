import type { InstallGuide } from './detect';

export function guideText(guide: InstallGuide): string {
  switch (guide) {
    case 'ios':
      return [
        'To install DiceFlow:',
        '',
        '1. Tap the Share button (square with an up arrow).',
        '2. Scroll and tap "Add to Home Screen".',
        '3. Tap "Add" in the top right corner.',
      ].join('\n');
    case 'safari-macos':
      return [
        'To install DiceFlow:',
        '',
        '1. Open the File menu.',
        '2. Choose "Add to Dock".',
        '3. Tap "Add".',
      ].join('\n');
    case 'firefox-android':
      return [
        'To install DiceFlow:',
        '',
        '1. Tap the menu button (three dots).',
        '2. Choose "Install" (or "Add to Home screen").',
        '3. Confirm the installation.',
      ].join('\n');
  }
}
