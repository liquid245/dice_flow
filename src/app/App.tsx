import { InfoPanel } from '../ui/components/InfoPanel';
import { GameTable } from '../ui/components/GameTable';
import { HistoryPanel } from '../ui/components/HistoryPanel';
import { ActionBar } from '../ui/components/ActionBar';

export default function App() {
  return (
    <main className="app">
      <InfoPanel />
      <GameTable />
      <HistoryPanel />
      <ActionBar />
    </main>
  );
}
