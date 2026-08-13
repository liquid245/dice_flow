import { InfoPanel } from '../ui/components/InfoPanel';
import { RendererCanvas } from '../renderer/RendererCanvas';
import { HistoryPanel } from '../ui/components/HistoryPanel';
import { ActionBar } from '../ui/components/ActionBar';

export default function App() {
  return (
    <main className="app">
      <InfoPanel />
      <RendererCanvas />
      <HistoryPanel />
      <ActionBar />
    </main>
  );
}
