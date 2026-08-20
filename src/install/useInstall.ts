import { useEffect, useState } from 'react';
import { detectGuide, detectInstallMode, type InstallGuide, type InstallMode } from './detect';
import { guideText } from './guideText';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function isStandalone(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function useInstall() {
  const [mode, setMode] = useState<InstallMode>(() =>
    detectInstallMode(navigator.userAgent, isStandalone(), false),
  );
  const [guide] = useState<InstallGuide | null>(() => detectGuide(navigator.userAgent));
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setMode('installable');
    };

    const onAppInstalled = () => {
      setDeferred(null);
      setMode('installed');
    };

    const media = window.matchMedia('(display-mode: standalone)');
    const onDisplayModeChange = (event: MediaQueryListEvent) => {
      if (event.matches) setMode('installed');
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    media.addEventListener('change', onDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
      media.removeEventListener('change', onDisplayModeChange);
    };
  }, []);

  const install = async () => {
    if (deferred) {
      try {
        await deferred.prompt();
        const choice = await deferred.userChoice;
        if (choice.outcome === 'dismissed') setDeferred(null);
      } catch {
        setDeferred(null);
        if (guide) window.alert(guideText(guide));
      }
      return;
    }
    if (guide) window.alert(guideText(guide));
  };

  return { mode, guide, install };
}
