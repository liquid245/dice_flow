import { InfoPanel } from '../ui/components/InfoPanel';
import { RendererCanvas } from '../renderer/RendererCanvas';
import { ActionBar } from '../ui/components/ActionBar';
import { useDeviceTilt } from '../ui/useDeviceTilt';

export default function App() {
  useDeviceTilt();

  return (
    <main className="app">
      <InfoPanel />
      <RendererCanvas />
      <ActionBar />
    </main>
  );
}
