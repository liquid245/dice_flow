import { InfoPanel } from '../ui/components/InfoPanel';
import { RendererCanvas } from '../renderer/RendererCanvas';
import { ActionBar } from '../ui/components/ActionBar';
import { StatusLine } from '../ui/components/StatusLine';

export default function App() {
  return (
    <main className="app">
      <InfoPanel />
      <RendererCanvas />
      <ActionBar />
      <StatusLine />
    </main>
  );
}
