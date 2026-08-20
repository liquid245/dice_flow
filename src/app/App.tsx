import { InfoPanel } from '../ui/components/InfoPanel';
import { RendererCanvas } from '../renderer/RendererCanvas';
import { ActionBar } from '../ui/components/ActionBar';
import { useGlassLight } from '../ui/useGlassLight';

export default function App() {
  useGlassLight();

  return (
    <main className="app">
      <InfoPanel />
      <RendererCanvas />
      <ActionBar />
    </main>
  );
}
