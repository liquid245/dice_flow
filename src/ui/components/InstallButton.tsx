import { useInstall } from '../../install/useInstall';

export function InstallButton() {
  const { mode, install } = useInstall();

  if (mode === 'installed' || mode === 'unsupported') return null;

  return (
    <div className="action-row action-row--install">
      <button onClick={() => void install()}>Install</button>
    </div>
  );
}
